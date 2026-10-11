# Setting up email and WhatsApp reminders

Email and WhatsApp are the priority: nearly everyone here has both. SMS is
ready as an optional extra for people without data. (Telegram was built and
then set aside; its server routes in `src/app/api/telegram` are unused.)

Each channel starts working the moment its settings are added in Vercel
(Project → Settings → Environment Variables → Production) and the site is
redeployed. Until then, Settings shows it as "Not available yet" instead of
offering it.

After each one, open **Settings → Notifications → Where reminders can reach
you** and press **Test** next to it.

---

## 1. Email — already working

Reminders and notifications go out from `noreply@zimestimate.com` through
Resend, which is already set up (`RESEND_API_KEY`). Nothing to do.

## 2. WhatsApp — Meta Cloud API, about half a US cent a message

Zimbabwe is billed at Meta's "Rest of Africa" utility rate (about
$0.004–0.005 per reminder; Meta publishes the current card on its pricing
page). No reseller in between.

What you need:
- A **Meta Business account** (business.facebook.com). Business verification
  is needed to message more than 250 people a day.
- A **phone number not already on WhatsApp** (a new Econet/NetOne SIM works;
  it must receive one SMS or call to verify).

Steps:
1. developers.facebook.com → **Create app** → type **Business** → add
   **WhatsApp**.
2. **WhatsApp → API Setup**: add your phone number and verify it. Note the
   **Phone number ID**.
3. **Business settings → System users**: create a system user (Admin), assign
   it the app and the WhatsApp account, and **generate a token** with
   `whatsapp_business_messaging` and `whatsapp_business_management`, set to
   never expire.
4. **WhatsApp Manager → Message templates → Create**:
   - Category: **Utility**
   - Name: `zimestimate_reminder`
   - Language: **English**
   - Body (Meta rejects a template that starts or ends with a variable, or
     is mostly variables, so keep the fixed words):

     ```
     Hello from ZimEstimate. {{1}}

     {{2}}

     Open zimestimate.com to see your project or change your reminders.
     ```

     Samples: `Project reminder: Harare Home` and
     `Savings reminder: set aside $150 this week.`
   - Footer (optional): `Reply STOP to opt out`

   Approval usually takes minutes to a day.
5. In Vercel add:

   | Name | Value |
   |---|---|
   | `WHATSAPP_TOKEN` | the system-user token |
   | `WHATSAPP_PHONE_ID` | the Phone number ID |
   | `WHATSAPP_TEMPLATE_NAME` | `zimestimate_reminder` (the default) |
   | `WHATSAPP_TEMPLATE_LANGUAGE` | `en` (the default) |

## 3. SMS (optional) — SMSPoP (smspop.co.zw), about $0.02–0.03 a message

Chosen because it is Zimbabwean, has a documented API, takes EcoCash/Paynow,
and costs a tenth of Twilio ($0.32 a message to Zimbabwe). It reaches
**Econet and NetOne** numbers; it does not send to Telecel.

1. Register at smspop.co.zw and verify your phone number.
2. **Billing**: buy credits ($5 ≈ 200 messages; $10 ≈ 500).
3. **Sender ID**: request `ZimEstimate` (3–13 letters/numbers) and wait for
   approval — messages cannot be sent until it is approved.
4. **API Tokens**: create a token. It is shown once — copy it.
5. In Vercel add:

   | Name | Value |
   |---|---|
   | `SMSPOP_API_TOKEN` | the API token |
   | `SMSPOP_SENDER_ID` | the approved sender ID, e.g. `ZimEstimate` |

Each reminder is one SMS (up to 160 characters; longer ones use 2–3 credits).

## Also tidy up

- `REMINDER_EMAIL_FROM` is no longer read — it pointed at Resend's sandbox
  sender, which is why email reminders never arrived. Safe to delete.
- The Twilio settings (`TWILIO_*`) still work as a fallback but are far more
  expensive for Zimbabwe; leave them unset unless SMSPoP is down.

## When reminders go out

Once a day at 06:00 UTC (08:00 in Harare), from the daily job. The Vercel
Hobby plan allows two daily jobs and both are in use, so reminders cannot be
sent more often without a paid plan or an outside scheduler.
