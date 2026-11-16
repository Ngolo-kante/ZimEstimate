// Email confirmation at sign-up.
//
// Supabase sends the confirmation email itself (through Resend's SMTP, from
// noreply@zimestimate.com, with the templates in supabase/templates/). These
// helpers cover the two places a person can get stuck: signing in before they
// have clicked the link, and a link that never arrived or expired.

/** Seconds between "resend" presses; Supabase also limits sends per hour. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** True when sign-in failed only because the address is not confirmed yet. */
export function isEmailNotConfirmedError(error: { message?: string; code?: string } | null | undefined): boolean {
    if (!error) return false;
    if (error.code === 'email_not_confirmed') return true;
    return /email not confirmed/i.test(error.message ?? '');
}

/** A plain-language message for the ?error= values /auth/callback sends back. */
export function describeCallbackError(value: string | null): string | null {
    if (!value) return null;
    if (value === 'callback_failed') {
        return 'That link has expired or was already used. Sign in below, or ask for a new confirmation email.';
    }
    if (value === 'no_session') return 'We could not finish signing you in. Please sign in again.';
    return 'Authentication failed. Please try again.';
}
