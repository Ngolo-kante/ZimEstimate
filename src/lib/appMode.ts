const APP_SESSION_KEY = 'zimestimate_android_app';
const ANDROID_REFERRER = 'android-app://com.zimestimate.app';

/** Detect an installed app without assuming browser APIs are available during SSR. */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  // Capture the launch referrer before a full page navigation replaces it.
  if (document.referrer.startsWith(ANDROID_REFERRER)) {
    try {
      window.sessionStorage.setItem(APP_SESSION_KEY, 'true');
    } catch {
      // Storage can be blocked; the launch referrer still identifies the app.
    }
    return true;
  }

  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;

  try {
    return window.sessionStorage.getItem(APP_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}
