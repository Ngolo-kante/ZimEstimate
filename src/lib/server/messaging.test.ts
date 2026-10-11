import { describe, expect, it } from 'vitest';
import { toInternationalPhone } from './messaging';

describe('reading phone numbers as people type them', () => {
  it('treats local Zimbabwean numbers as +263', () => {
    expect(toInternationalPhone('0771234567')).toBe('+263771234567');
    expect(toInternationalPhone('077 123 4567')).toBe('+263771234567');
    expect(toInternationalPhone('771234567')).toBe('+263771234567');
    expect(toInternationalPhone('0712-345-678')).toBe('+263712345678');
  });

  it('keeps numbers already in international form', () => {
    expect(toInternationalPhone('+263 77 123 4567')).toBe('+263771234567');
    expect(toInternationalPhone('263771234567')).toBe('+263771234567');
    expect(toInternationalPhone('0027821234567')).toBe('+27821234567');
    expect(toInternationalPhone('+27821234567')).toBe('+27821234567');
  });

  it('gives nothing for nothing', () => {
    expect(toInternationalPhone('')).toBe('');
    expect(toInternationalPhone('n/a')).toBe('');
  });
});
