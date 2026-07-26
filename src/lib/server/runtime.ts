// Env vars the app cannot run correctly without: core data/auth, public URLs,
// headline AI/scraper features, security secrets, and the scheduled cron.
const REQUIRED_RUNTIME_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'GOOGLE_GEMINI_API_KEY',
  'CSRF_SECRET',
  'REMINDER_DISPATCH_SECRET',
  'CRON_SECRET',
] as const;

// Optional notification channels. The dispatch code skips these gracefully when
// unset, so a missing value must NOT make the app report "not ready".
const OPTIONAL_RUNTIME_ENV = [
  'WHATSAPP_API_URL',
  'WHATSAPP_PHONE_ID',
  'WHATSAPP_TOKEN',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
] as const;

export function getMissingRuntimeEnv(): string[] {
  return REQUIRED_RUNTIME_ENV.filter((key) => !process.env[key]);
}

export function getMissingOptionalRuntimeEnv(): string[] {
  return OPTIONAL_RUNTIME_ENV.filter((key) => !process.env[key]);
}

export function getRuntimeEnvironment() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
}
