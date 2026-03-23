const REQUIRED_RUNTIME_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'GOOGLE_GEMINI_API_KEY',
  'FIRECRAWL_API_KEY',
  'WHATSAPP_API_URL',
  'WHATSAPP_PHONE_ID',
  'WHATSAPP_TOKEN',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'CSRF_SECRET',
  'REMINDER_DISPATCH_SECRET',
] as const;

export function getMissingRuntimeEnv(): string[] {
  return REQUIRED_RUNTIME_ENV.filter((key) => !process.env[key]);
}

export function getRuntimeEnvironment() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
}
