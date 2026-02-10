import { describe, expect, it, vi } from 'vitest';
import {
  enforceRateLimit,
  generateCsrfToken,
  sanitizeNumber,
  sanitizeText,
  sanitizeUrl,
  validateCsrfToken,
} from './security';

describe('security helpers', () => {
  it('generates and validates session-bound CSRF tokens', () => {
    const token = generateCsrfToken('session-123');
    expect(validateCsrfToken(token, 'session-123')).toBe(true);
    expect(validateCsrfToken(token, 'other-session')).toBe(false);
  });

  it('rejects expired CSRF tokens', () => {
    const start = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(start);
    const token = generateCsrfToken('session-exp');
    nowSpy.mockReturnValue(start + 3_600_000 + 1);
    expect(validateCsrfToken(token, 'session-exp')).toBe(false);
    nowSpy.mockRestore();
  });

  it('sanitizes text input', () => {
    expect(sanitizeText('  hello\u0000 ')).toBe('hello');
  });

  it('sanitizes number input with bounds', () => {
    expect(sanitizeNumber('10', { min: 0, max: 5, fallback: 1 })).toBe(5);
    expect(sanitizeNumber('bad', { fallback: 3 })).toBe(3);
  });

  it('validates URLs', () => {
    expect(sanitizeUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
  });

  it('enforces rate limits after the threshold', async () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '127.0.0.1' },
    });

    const first = enforceRateLimit(req, { keyPrefix: 'test', limit: 1, windowMs: 60_000 });
    expect(first).toBeNull();

    const second = enforceRateLimit(req, { keyPrefix: 'test', limit: 1, windowMs: 60_000 });
    expect(second).not.toBeNull();
    expect(second?.status).toBe(429);
  });
});
