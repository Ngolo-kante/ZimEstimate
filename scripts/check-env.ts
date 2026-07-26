import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load env files (.env.local wins) without adding a dependency. Values already
// present in process.env (e.g. CI/Vercel-provided) are never overwritten.
function loadEnvFile(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

['.env.local', '.env'].forEach(loadEnvFile);

const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'GOOGLE_GEMINI_API_KEY',
  'FIRECRAWL_API_KEY',
  'CSRF_SECRET',
  'REMINDER_DISPATCH_SECRET',
  'CRON_SECRET',
];

// Optional notification channels — the app skips these gracefully when unset.
// Keep this in sync with OPTIONAL_RUNTIME_ENV in src/lib/server/runtime.ts.
const optionalReminderEnv = [
  'WHATSAPP_API_URL',
  'WHATSAPP_PHONE_ID',
  'WHATSAPP_TOKEN',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'RESEND_API_KEY',
  'REMINDER_EMAIL_FROM',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_SMS_FROM',
  'TWILIO_WHATSAPP_FROM',
  'TELEGRAM_BOT_TOKEN',
];

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('Missing required environment variables:');
  missing.forEach((key) => console.error(`- ${key}`));
  process.exit(1);
}

const missingOptional = optionalReminderEnv.filter((key) => !process.env[key]);

console.log('All required environment variables are set.');
if (missingOptional.length > 0) {
  console.warn('Optional reminder provider variables not set (only needed for those channels):');
  missingOptional.forEach((key) => console.warn(`- ${key}`));
}
