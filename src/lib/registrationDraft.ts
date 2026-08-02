// ─── Registration drafts ──────────────────────────────────────────────────────
// Supplier and contractor registration can now be filled in before an account
// exists. Creating that account is not always instant: when Supabase requires
// email confirmation, signUp returns no session and the person leaves the page
// to click a link in their inbox. Without somewhere to put the answers, every
// one of those returns to an empty form and most of them do not fill it twice.
//
// localStorage rather than sessionStorage on purpose — the confirmation link
// routinely opens in a different tab, and sessionStorage would already be gone.

const PREFIX = 'zimestimate_reg_draft:';

export type RegistrationDraftKey = 'contractor' | 'supplier';

export function saveRegistrationDraft(key: RegistrationDraftKey, data: unknown): void {
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data));
  } catch {
    // Private browsing or a full quota. The form still works; the round trip
    // through email confirmation is what gets lost, so this is not worth an error.
  }
}

export function loadRegistrationDraft<T>(key: RegistrationDraftKey): T | null {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearRegistrationDraft(key: RegistrationDraftKey): void {
  try {
    window.localStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    /* nothing to clean up */
  }
}

/**
 * Where the email-confirmation callback should return to. /auth/callback reads
 * this key, so setting it before signUp is what brings someone back to the form
 * they were filling in rather than dropping them on /home.
 */
export function setPostAuthRedirect(path: string): void {
  try {
    sessionStorage.setItem('zimestimate_auth_redirect', path);
  } catch {
    /* redirect falls back to the default destination */
  }
}
