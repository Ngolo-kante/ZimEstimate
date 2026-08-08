import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase';

type RequestLike = Request;

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  keyPrefix: string;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// CSRF token configuration
const CSRF_TOKEN_EXPIRY_MS = 3600000; // 1 hour

function getCsrfSecret() {
  const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('CSRF_SECRET must be configured for CSRF token operations.');
  }
  return secret;
}

const DEFAULT_ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_VERCEL_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
].filter(Boolean) as string[];

function normalizeOrigin(value: string) {
  if (!value) return value;

  // Trailing whitespace is invisible in a dashboard field and survives a paste.
  // NEXT_PUBLIC_SITE_URL once held "https://zimestimate.com\n", which made the
  // allow-list entry unequal to the Origin header the browser actually sends,
  // so every origin-checked POST returned "Invalid request origin" — including
  // the support form, from the real domain. Also strip a trailing slash: an
  // Origin header never carries one, so "https://site.com/" would never match.
  const cleaned = value.trim().replace(/\/+$/, '');
  if (!cleaned) return cleaned;

  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) return cleaned;
  return `https://${cleaned}`;
}

export function getClientIp(req: RequestLike): string {
  const headerValue = (name: string) => req.headers.get(name) || '';
  const forwarded = headerValue('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return (
    headerValue('x-real-ip') ||
    headerValue('cf-connecting-ip') ||
    'unknown'
  );
}

function computeRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + options.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.limit - 1, resetAt };
  }

  const nextCount = entry.count + 1;
  entry.count = nextCount;

  return {
    allowed: nextCount <= options.limit,
    remaining: Math.max(options.limit - nextCount, 0),
    resetAt: entry.resetAt,
  };
}

async function computeDistributedRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc('consume_api_rate_limit' as never, {
    p_bucket_key: key,
    p_limit: options.limit,
    p_window_ms: options.windowMs,
  } as never);

  if (error) throw new Error(error.message);
  const value = Array.isArray(data) ? data[0] : data;
  const row = value as { allowed?: boolean; remaining?: number; reset_at?: string } | null;
  const resetAt = row?.reset_at ? new Date(row.reset_at).getTime() : Number.NaN;
  if (!row || typeof row.allowed !== 'boolean' || typeof row.remaining !== 'number' || !Number.isFinite(resetAt)) {
    throw new Error('Invalid distributed rate-limit response.');
  }

  return { allowed: row.allowed, remaining: row.remaining, resetAt };
}

export async function enforceRateLimit(req: RequestLike, options: RateLimitOptions) {
  // SEC-001 FIX: Removed insecure internal header bypass
  // Internal requests should use proper authentication, not spoofable headers

  const ip = getClientIp(req);
  const key = `${options.keyPrefix}:${ip}`;
  let result: RateLimitResult;

  if (process.env.NODE_ENV === 'test') {
    result = computeRateLimit(key, options);
  } else {
    try {
      result = await computeDistributedRateLimit(key, options);
    } catch (error) {
      console.error('Distributed rate limit unavailable:', error);
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Request protection is temporarily unavailable. Please try again.' },
          { status: 503 }
        );
      }
      result = computeRateLimit(key, options);
    }
  }

  if (result.allowed) return null;

  return NextResponse.json(
    {
      error: 'Rate limit exceeded. Please try again later.',
      retryAfterSeconds: Math.ceil((result.resetAt - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
      },
    }
  );
}

function getAllowedOrigins() {
  return DEFAULT_ALLOWED_ORIGINS.map((origin) => normalizeOrigin(origin));
}

export function enforceCsrf(req: RequestLike) {
  const origin = req.headers.get('origin');
  if (!origin) return null;

  const allowed = getAllowedOrigins();
  if (allowed.length === 0) return null;

  const normalized = normalizeOrigin(origin);
  const isAllowed = allowed.some((value) => value === normalized);
  if (isAllowed) return null;

  return NextResponse.json(
    { error: 'Invalid request origin.' },
    { status: 403 }
  );
}

export function sanitizeText(
  value: unknown,
  options?: { maxLength?: number; fallback?: string }
): string {
  const fallback = options?.fallback ?? '';
  if (typeof value !== 'string') return fallback;
  const trimmed = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!options?.maxLength) return trimmed;
  return trimmed.slice(0, options.maxLength);
}

export function sanitizeNumber(value: unknown, options?: { min?: number; max?: number; fallback?: number }) {
  const fallback = options?.fallback ?? 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(parsed)) return fallback;
  const min = options?.min ?? parsed;
  const max = options?.max ?? parsed;
  return Math.min(Math.max(parsed, min), max);
}

export function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = sanitizeText(value, { maxLength: 2000 });
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

// SEC-002 FIX: Proper CSRF token implementation with session binding and HMAC

/**
 * Generate a CSRF token bound to a user session
 * Token format: timestamp.sessionId.hmacSignature
 */
export function generateCsrfToken(sessionId: string): string {
  const csrfSecret = getCsrfSecret();
  const timestamp = Date.now().toString();
  const payload = `${timestamp}.${sessionId}`;
  const signature = crypto
    .createHmac('sha256', csrfSecret)
    .update(payload)
    .digest('hex');
  return `${payload}.${signature}`;
}

/**
 * Validate a CSRF token
 * Returns true if token is valid, not expired, and matches the session
 */
export function validateCsrfToken(token: string, sessionId: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const csrfSecret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
  if (!csrfSecret) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [timestamp, tokenSessionId, signature] = parts;

  // Verify session binding
  if (tokenSessionId !== sessionId) return false;

  // Verify expiration
  const tokenTime = parseInt(timestamp, 10);
  if (Number.isNaN(tokenTime) || Date.now() - tokenTime > CSRF_TOKEN_EXPIRY_MS) {
    return false;
  }

  // Verify HMAC signature
  const payload = `${timestamp}.${tokenSessionId}`;
  const expectedSignature = crypto
    .createHmac('sha256', csrfSecret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Enhanced CSRF protection middleware
 * Validates both origin and CSRF token for state-changing requests
 */
export function enforceCsrfWithToken(req: RequestLike, sessionId?: string | null) {
  // First check origin
  const originCheck = enforceCsrf(req);
  if (originCheck) return originCheck;

  // For non-safe methods, also validate CSRF token if session exists
  const method = req.method.toUpperCase();
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

  if (!safeMethods.includes(method) && sessionId) {
    const csrfToken = req.headers.get('x-csrf-token');
    if (!csrfToken || !validateCsrfToken(csrfToken, sessionId)) {
      return NextResponse.json(
        { error: 'Invalid or expired CSRF token.' },
        { status: 403 }
      );
    }
  }

  return null;
}
