# Auth emails: confirmation, password reset, email change

Supabase Auth sends these emails itself. They go out through **Resend**, the same provider, verified domain and sender (`noreply@zimestimate.com`) that the app's notifications use (`src/lib/server/email.ts`), so they arrive from ZimEstimate rather than from a supabase.co address.

Every link is built from `{{ .SiteURL }}` and `{{ .TokenHash }}`, so it stays on zimestimate.com and works in whichever browser the email app opens. A PKCE `code` link fails when the link is opened in a different browser from the one that signed up, which is common on phones. `/auth/callback` and `/auth/reset-password` verify the token.

| Dashboard template | Subject | File |
| --- | --- | --- |
| Confirm signup | Confirm your ZimEstimate email | `confirm-signup.html` |
| Reset password | Reset your ZimEstimate password | `reset-password.html` |
| Change email address | Confirm your new ZimEstimate email | `change-email.html` |

## One-time setup in the Supabase dashboard (owner)

The Resend API key goes into the dashboard, never into this repo.

1. **Authentication → Emails → SMTP Settings → Enable custom SMTP**
   - Sender email: `noreply@zimestimate.com`; sender name: `ZimEstimate`
   - Host `smtp.resend.com`, port `465`, username `resend`, password: the Resend API key (the same key as `RESEND_API_KEY` in Vercel, or a new one limited to sending)
   - Save. Supabase's built-in mailer allows only a few emails an hour, so this step matters even without the templates.
2. **Authentication → Emails → Templates**: for each row in the table above, set the subject and paste the file's contents into the body. Save each.
3. **Authentication → URL Configuration**: Site URL `https://zimestimate.com`; Redirect URLs include `https://zimestimate.com/auth/callback` and `https://zimestimate.com/auth/reset-password` (and the `www.` versions if that host serves the site).
4. **Authentication → Sign In / Providers → Email**: turn on **Confirm email**. Existing accounts stay confirmed; Google sign-in is unaffected.
5. **Test**: sign up with a fresh address, check the email arrives from `noreply@zimestimate.com`, open the link on a phone, and check that it lands signed in. Then try signing in before confirming another account: the login page should offer "Resend confirmation email".

## What the app does around it

- Sign-up shows "Check your email" with a resend button (60-second wait between sends).
- Sign-in before confirming says so in plain words and offers the same resend button.
- An expired or used link returns to the login page with "That link has expired or was already used".
- Supplier and contractor sign-up save the form as a draft and continue after the link (unchanged).
