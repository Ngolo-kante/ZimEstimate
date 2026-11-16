import { describe, expect, it } from 'vitest';
import { initialsFor } from './initials';

describe('initialsFor', () => {
  it('takes first and last initials', () => expect(initialsFor('Tendai Rudo Moyo')).toBe('TM'));
  it('uses one letter for one word', () => expect(initialsFor('tendai')).toBe('T'));
  it('reads the part of an email before @', () => expect(initialsFor('tendai.moyo@example.com')).toBe('TM'));
  it('is empty for nothing', () => expect(initialsFor('  ')).toBe(''));
});
