import { describe, expect, it } from 'vitest';
import { describeCallbackError, isEmailNotConfirmedError } from './authConfirmation';

describe('isEmailNotConfirmedError', () => {
    it('recognises the code and the message Supabase returns', () => {
        expect(isEmailNotConfirmedError({ code: 'email_not_confirmed', message: '' })).toBe(true);
        expect(isEmailNotConfirmedError({ message: 'Email not confirmed' })).toBe(true);
    });
    it('ignores other sign-in failures', () => {
        expect(isEmailNotConfirmedError({ message: 'Invalid login credentials' })).toBe(false);
        expect(isEmailNotConfirmedError(null)).toBe(false);
    });
});

describe('describeCallbackError', () => {
    it('explains an expired or used link', () => {
        expect(describeCallbackError('callback_failed')).toMatch(/expired or was already used/);
    });
    it('returns nothing when there is no error', () => {
        expect(describeCallbackError(null)).toBeNull();
    });
    it('falls back to a generic message for anything else', () => {
        expect(describeCallbackError('weird')).toBe('Authentication failed. Please try again.');
    });
});
