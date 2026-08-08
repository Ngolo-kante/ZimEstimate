import { describe, expect, it } from 'vitest';
import { sanitizeAuthRedirect } from './authRedirect';

describe('sanitizeAuthRedirect', () => {
  it('keeps canonical internal paths', () => {
    expect(sanitizeAuthRedirect('/projects/123?tab=boq#items')).toBe('/projects/123?tab=boq#items');
  });

  it.each([
    'https://attacker.example/steal',
    '//attacker.example/steal',
    '/\\attacker.example/steal',
    'javascript:alert(1)',
    'data:text/html,boom',
    'projects/123',
    '/projects\n/123',
  ])('rejects unsafe redirect %s', (value) => {
    expect(sanitizeAuthRedirect(value)).toBeNull();
  });
});
