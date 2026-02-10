import { NextResponse } from 'next/server';
import crypto from 'crypto';

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
const CSRF_SECRET = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-csrf-secret-change-in-production';

const DEFAULT_ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_VERCEL_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
].filter(Boolean) as string[];

function normalizeOrigin(value: string) {
  if (!value) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value}`;
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

export function enforceRateLimit(req: RequestLike, options: RateLimitOptions) {
  // SEC-001 FIX: Removed insecure internal header bypass
  // Internal requests should use proper authentication, not spoofable headers

  const ip = getClientIp(req);
  const key = `${options.keyPrefix}:${ip}`;
  const result = computeRateLimit(key, options);

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
  const timestamp = Date.now().toString();
  const payload = `${timestamp}.${sessionId}`;
  const signature = crypto
    .createHmac('sha256', CSRF_SECRET)
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
    .createHmac('sha256', CSRF_SECRET)
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
