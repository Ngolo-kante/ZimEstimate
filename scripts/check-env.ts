const requiredEnv = [
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
];

const optionalReminderEnv = [
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
