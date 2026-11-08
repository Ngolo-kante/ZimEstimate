# Google Play listing draft — ZimEstimate

Prepared from the website source on 8 November 2026. This is a draft for the
`com.zimestimate.app` Trusted Web Activity; the Android package is being built
separately and has not been inspected here. Configuration, provider contracts,
and actual production retention cannot be established from this repository.
No environment files or live database were inspected.

## Listing copy

Character counts include spaces and punctuation, and include internal newlines
in the full description, but exclude the Markdown fences and trailing newline.

### App name

```text
ZimEstimate
```

Count: **11 / 30**.

### Short description

```text
Estimate building costs in Zimbabwe, create BOQs and track your projects.
```

Count: **73 / 80**.

### Full description

```text
Plan your next building project in Zimbabwe with ZimEstimate. Explore construction budgets, prepare a bill of quantities (BOQ), and keep your project details together.

START WITH A BUDGET
Explore what your budget could cover and see estimated costs across building stages. Adjust your choices as you plan.

BUILD A BILL OF QUANTITIES
Create an estimate using the guided building wizard. Enter your project details and room dimensions, or upload a floor plan for assisted reading. Check the extracted rooms and measurements before using them in your estimate.

ESTIMATE SMALLER PROJECTS
Use guided calculators for solar systems, boreholes, water tanks, septic tanks, fencing and boundary walls, and paving. Review quantities, materials and labour as you compare options.

SAVE AND FOLLOW YOUR WORK
Sign in to save projects and estimates. Track stages, purchases and material usage, add progress photos, and invite people to follow or help with your project.

FIND MATERIALS AND CONTACT BUSINESSES
Browse the materials marketplace, explore supplier and contractor listings, and send enquiries or requests for quotes. Review material pricing and project costs in USD and ZWG where available.

SHARE YOUR ESTIMATES
Download BOQs as PDFs and share estimates when you need to discuss a project with a builder, supplier or client.

Estimates are planning guides, not guaranteed prices or engineering advice. Check quantities, site conditions, supplier quotes and local approval requirements before buying or building. Floor plan reading can make mistakes and needs your review.

You can try estimating tools before signing in. An account is needed to save your work. An internet connection is required for account services, uploads and online pricing.
```

Count: **1745 / 4000**.

Copy evidence: [`/quick-budget`](../../src/app/quick-budget/page.tsx),
[`/boq/new`](../../src/app/boq/new/page.tsx),
[quick project flows](../../src/app/quick-projects/[type]/page.tsx),
[project and document services](../../src/lib/services/projects.ts),
[site services](../../src/lib/services/site.ts),
[progress photos](../../src/app/api/projects/[id]/photos/route.ts),
[enquiries](../../src/app/api/enquiries/route.ts), and
[RFQs](../../src/lib/services/rfq.ts).

- App type: **App**.
- Suggested category: **House & Home** (12 characters).
- Suggested tags: **Home improvement**, **Calculator**, **Productivity**
  (16, 10 and 12 characters respectively). These are proposed descriptors;
  select only the matching tags actually available for this category in Play
  Console. Tag availability was not verified.
- Contact email: **support@zimestimate.com** — the default team inbox in
  [`src/lib/server/email.ts`](../../src/lib/server/email.ts), also published in
  [`src/app/privacy/page.tsx`](../../src/app/privacy/page.tsx).
- Privacy policy: **https://zimestimate.com/privacy**.
- Account deletion: **https://zimestimate.com/delete-account**.

## Data safety form draft

Google requires disclosure of off-device collection, including third-party SDK
flows. Service-provider transfers and certain user-initiated transfers can be
excluded from its definition of sharing when their conditions are met. These
exceptions need evidence; merely calling a vendor a processor is insufficient.
Use the [official Data safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
when transferring these answers into Play Console.

### Top-level answers

| Question | Proposed answer and source |
| --- | --- |
| Does the app collect or share user data? | **Yes.** Auth, database writes, file uploads, analytics, support and optional messaging transmit data off device. Sources are itemised below. |
| Is all collected user data encrypted in transit? | **Yes, intended website answer; confirm production before submission.** [Privacy §9](../../src/app/privacy/page.tsx) states TLS for all platform communications. [Next configuration](../../next.config.ts) sets HSTS and upgrades insecure requests. The [AI caller](../../src/lib/ai/gemini.ts), [other readers](../../src/lib/ai/planReaders.ts), [PostHog default](../../src/lib/productAnalytics.ts), [email](../../src/lib/server/email.ts) and [messaging](../../src/lib/server/messaging.ts) use HTTPS. The [Supabase URL](../../src/lib/supabase.ts) and PostHog host are configurable; source alone does not prove deployed values or the separately built Android app's network configuration. This is TLS, not end-to-end encryption. |
| Can users request deletion? | **Yes**, via https://zimestimate.com/delete-account or the published support email. The [request component](../../src/app/delete-account/request-deletion.tsx) creates a privacy ticket in the [existing support API](../../src/app/api/support/route.ts). Team-handled request, not automatic deletion. |
| How can accounts be created? | **Email and password; Google sign-in.** [AuthProvider](../../src/components/providers/AuthProvider.tsx) implements both through Supabase. |
| Is deletion available without deleting the account? | **By request**, subject to legal retention: [privacy §6](../../src/app/privacy/page.tsx) allows erasure and other data-rights requests; the [support page](../../src/app/support/page.tsx) accepts signed-out privacy requests. No self-service selective erasure is implemented here. |
| Independent security review / certification? | **Do not claim one.** No evidence of one was found in the reviewed source. |

### Data types, purposes and controls

“Optional” below means users can avoid the feature; email and account identifiers
are required when creating/saving to an account, though guest tools are available.
Mark retained server data **not ephemeral**. Memory-only analytics IDs do not make
the collected analytics events ephemeral on the receiving service.

| Play data type | Collected data and purpose | Required / optional; sharing assessment | File evidence |
| --- | --- | --- | --- |
| Personal info → Email address, Name, User IDs | Account email, optional full name, Supabase user ID; authentication, account management, saved-work ownership and support. Password is handled by Supabase Auth; do not describe it as a project-table field. Google sign-in also passes identity through Supabase. | Email/ID required for accounts; name optional. Sent to Supabase; identity/contact can also appear in enquiries, invitations and notifications. Treat external sharing conservatively until the provider/user-action exceptions below are confirmed. | [AuthProvider](../../src/components/providers/AuthProvider.tsx), [Supabase client](../../src/lib/supabase.ts), [support API](../../src/app/api/support/route.ts), [project invites](../../src/app/api/projects/[id]/invite/route.ts). |
| Personal info → Phone number, Address, Other info | Optional profile phone and notification preferences; supplier business/contact details, registration number, physical address, city, delivery area and customer references; contractor company, trade, service area and biography. Account management, listings, enquiries, fraud prevention and verification. | Optional by role/feature. Public supplier/contractor listings disclose business/contact data to visitors; enquiry contact details reach the selected business. References may contain another person's details. Do not claim blanket “no sharing.” | [Settings](../../src/app/settings/page.tsx), [supplier registration](../../src/app/supplier/register/page.tsx), [supplier service](../../src/lib/services/suppliers.ts), [contractor service](../../src/lib/services/contractors.ts), [enquiry API](../../src/app/api/enquiries/route.ts). |
| Photos and videos → Photos | Uploaded plan images and site-progress photographs, associated captions, upload dates and uploader IDs. App functionality; plan-reader improvement for the separate plan-sample copies. | Optional. Stored in Supabase; project owners/invitees can access progress photos. Plan images can go to AI providers. No video-upload flow was found in the reviewed photo routes. | [Project photos](../../src/app/api/projects/[id]/photos/route.ts), [quick estimate photos](../../src/app/api/quick-estimates/[id]/photos/route.ts), [vision API](../../src/app/api/vision/analyze/route.ts), [plan samples](../../src/lib/server/planSamples.ts). |
| Files and docs | Uploaded PDFs, plans, project documents/receipts and supplier verification documents. App functionality and supplier verification. Registration currently offers business licence, tax clearance and proof of address uploads. | Optional by feature/role. Supabase storage; floor plans can also go to Google, NVIDIA and OpenRouter/downstream models when configured. Privacy policy also mentions director IDs/passports, but the reviewed registration screen does not explicitly request those; confirm operational collection. | [Project document upload](../../src/lib/services/projects.ts), [supplier uploads](../../src/lib/services/suppliers.ts), [registration documents](../../src/app/supplier/register/page.tsx), [AI readers](../../src/lib/ai/planReaders.ts), [privacy §2](../../src/app/privacy/page.tsx). |
| App activity → Other user-generated content | Project names, site descriptions/locations, room measurements, BOQ quantities/prices, saved quick-estimate answers, stages, reminders, quote requests, quotes and plan-reader results. App functionality; reader testing where samples are retained. | Optional until saving/submitting. Stored in Supabase; selected collaborators or quote recipients receive relevant data. Descriptions, plan content and quote images may reach AI providers. | [Project service](../../src/lib/services/projects.ts), [quick BOQs](../../src/lib/services/quickBoq.ts), [site service](../../src/lib/services/site.ts), [RFQs](../../src/lib/services/rfq.ts), [describe API](../../src/app/api/describe-project/route.ts), [quote check](../../src/app/api/quote-check/route.ts). |
| Messages → Other in-app messages (and Email where delivered by email) | Support/deletion tickets, enquiry text, notification bodies and quote communications. Support, developer communications and app functionality. This is structured business communication, not an unrestricted chat product. | Optional. Support reaches the team through Resend; enquiries/RFQs reach the requested supplier/contractor; optional reminders can go through messaging providers. Classify actual email content as Email if the Console definition applies to the enabled delivery flow. | [Support API](../../src/app/api/support/route.ts), [enquiry API](../../src/app/api/enquiries/route.ts), [RFQ service](../../src/lib/services/rfq.ts), [email](../../src/lib/server/email.ts), [notification dispatch](../../src/lib/server/notificationDispatch.ts), [messaging](../../src/lib/server/messaging.ts). |
| Financial info → Purchase history, Other financial info | Material purchase records, amounts/currencies, supplier subscription status and payment history/provider reference IDs; budgeting, procurement and subscription management. | Optional by feature. Stored in Supabase; selected business transactions involve suppliers. Payment history storage is implemented, but this does not prove live Stripe/Paynow checkout. No raw card-storage implementation was found. Confirm “User payment info” if checkout is enabled in the submitted product. | [Purchase records](../../src/lib/services/projects.ts), [subscription/payment service](../../src/lib/services/subscriptions.ts), [billing page](../../src/app/supplier/billing/page.tsx), [privacy §§2, 5](../../src/app/privacy/page.tsx). |
| App activity → App interactions | Page views, feature events, acquisition/referring domain and UTM context; analytics and product improvement. PostHog only initialises when configured. Vercel Analytics is also mounted. | No in-app analytics opt-out was found. Do not mark optional solely because the developer can omit a key. Sent to analytics vendors. Source disables PostHog autocapture, recording, persistent storage and person profiles; identifyAnalyticsUser is a no-op. | [Product analytics](../../src/lib/productAnalytics.ts), [analytics provider](../../src/components/providers/ProductAnalyticsProvider.tsx), [root layout / Vercel Analytics](../../src/app/layout.tsx). |
| Device or other IDs | PostHog's in-memory visitor identifier and technical metadata; IP-derived rate-limit identifiers; optional push subscription endpoint/keys and Telegram chat ID. Analytics, fraud prevention and notifications. | Analytics/security collection during relevant requests; push/Telegram optional. No evidence here of collecting Android Advertising ID or IMEI. Do not infer that absence of persistent cookies means no identifiers are transmitted. | [Product analytics](../../src/lib/productAnalytics.ts), [rate limiter](../../src/lib/server/security.ts), [push registration](../../src/lib/services/notifications.ts), [Telegram webhook](../../src/app/api/telegram/webhook/route.ts). |
| App info and performance → Diagnostics | Operational error reports, action/resource metadata and optional IP in audit records; security, fraud prevention and troubleshooting. Exact hosting/analytics diagnostic payloads need production verification. | Security logging is operational, with no user opt-out in the reviewed code. Hosting and database processors receive applicable records. Do not assert an Android crash-reporting SDK exists. | [Audit service](../../src/lib/services/audit.ts), [logger](../../src/lib/logger.ts), [security](../../src/lib/server/security.ts), [privacy §§2, 4, 9](../../src/app/privacy/page.tsx). |
| Location → Approximate location (provisional) | Entered cities/service areas/site locations exist, and analytics/hosting receive requests that can expose IP-derived location. These are not proof of device GPS collection. | Confirm whether vendors derive/store user location before the final form. Conservatively include approximate location if they do. Physical addresses are also covered above as personal information; a project location need not be the user's location. | [Supplier registration](../../src/app/supplier/register/page.tsx), [project service](../../src/lib/services/projects.ts), [analytics configuration](../../src/lib/productAnalytics.ts), [root layout](../../src/app/layout.tsx), [permissions policy](../../next.config.ts). |

No deliberate collection flows for contacts/address books, health/fitness, audio,
SMS inbox, calendar, installed-app inventory or precise device GPS were found in
the reviewed website code. Do not select those solely because free-text uploads
could contain them. Do review the Android manifest/SDKs separately. The website's
Permissions-Policy disables camera, microphone and geolocation; choosing a file
for upload still collects the selected file ([next.config.ts](../../next.config.ts)).
Page views of this app are app interactions, not evidence of collecting a user's
general web-browsing history.

### Sharing: proposed entries and unresolved provider conditions

- **Collected: Yes** for each confirmed row above. For **Shared**, conservatively
  use **Yes** for personal info, messages, files/photos, project content,
  financial transactions and analytics/identifiers where they reach outside
  parties, unless the applicable Google exception has been established for
  that exact flow. This is deliberately not a final blanket “no sharing” claim.
- **Supabase / Vercel / PostHog / Resend:** database, auth, hosting, analytics
  and transactional email are provider transfers. They may meet Google's
  service-provider exception if processing is solely on ZimEstimate's behalf.
  The [privacy policy](../../src/app/privacy/page.tsx) states processor/DPA
  arrangements; this review cannot verify the contracts or deployed settings.
- **AI providers:** [planReaders.ts](../../src/lib/ai/planReaders.ts) can send
  plan images/prompts to Google Gemini, NVIDIA and OpenRouter; OpenRouter may
  route to downstream model providers. Readers race, so multiple providers may
  receive a plan even though only one result is used. [gemini.ts](../../src/lib/ai/gemini.ts)
  handles other Gemini calls. Check provider retention/training terms before
  claiming service-provider exceptions or ephemeral processing. The current
  privacy processor table names Gemini but does not name NVIDIA/OpenRouter.
- **Messaging providers:** [messaging.ts](../../src/lib/server/messaging.ts)
  supports SMSPoP or Twilio for SMS, Meta WhatsApp or Twilio for WhatsApp, and
  Telegram for linked reminders; [notification dispatch](../../src/lib/server/notificationDispatch.ts)
  sends email via Resend and WhatsApp when configured. Phone/chat identifiers
  and message bodies leave the platform. Activation and contracts were not
  verified. The privacy processor table does not enumerate all these providers.
- **User-directed disclosures:** public business profiles, enquiries/RFQs,
  invitations, shared estimates and PDFs disclose information to people the
  user chooses. Google's user-initiated-sharing exception may apply where
  users expect the disclosure. Verify each flow before excluding it. Sources:
  [contractors](../../src/lib/services/contractors.ts),
  [supplier profiles](../../src/app/marketplace/suppliers/[id]/page.tsx),
  [enquiries](../../src/app/api/enquiries/route.ts), [RFQs](../../src/lib/services/rfq.ts),
  [invites](../../src/app/api/projects/[id]/invite/route.ts),
  [share sheet](../../src/components/share/ShareSheet.tsx).
- **Payments:** privacy lists Stripe and Paynow; [billing](../../src/app/supplier/billing/page.tsx)
  and [subscriptions](../../src/lib/services/subscriptions.ts) support provider
  labels/payment records. Do not infer that live payment collection or processor
  transfers are enabled from those records alone.
- No advertising SDK or sale-of-data flow was found in the reviewed source.
  [Privacy §8](../../src/app/privacy/page.tsx) says no third-party advertising or
  behavioural targeting. Use Analytics, App functionality, Account management,
  Developer communications, and Fraud prevention/security/compliance purposes
  as applicable above, rather than Advertising or marketing by default.

### Deletion and retention answers

- Account-associated projects, BOQs, uploaded plans/photos and saved settings
  are included in the team-handled request. The [new page](../../src/app/delete-account/page.tsx)
  reuses [privacy §4](../../src/app/privacy/page.tsx): account data is deleted
  **30 days after closure**, except legal retention. That is not a promise that
  every request is completed 30 days after submission. Identity verification
  may be required under privacy §6. Operational fulfilment was not tested.
- Keep only the exceptions already stated in privacy §4: KYC/AML documents
  for 5 years after the relationship ends; transaction/payment records for
  5 years from the transaction; marketing consent evidence for consent duration
  plus 3 years; security/audit logs for 12 months.
- Production plan-reader samples, including failed reads, are a separate
  retained copy: private storage for **365 days / 12 months** with no account/IP
  metadata, then pruning by the existing scheduled job. The file itself can
  contain identifying text; absence of account metadata is not proof of full
  anonymisation. Do not promise these unlinked copies can be found from an
  account ID. Sources: [planSamples.ts](../../src/lib/server/planSamples.ts),
  [vision API](../../src/app/api/vision/analyze/route.ts),
  [reminders job](../../src/app/api/reminders/dispatch/route.ts).
- Anonymous analytics is not linked to account identity in
  [productAnalytics.ts](../../src/lib/productAnalytics.ts). Vendor retention and
  deletion capabilities are not established by that configuration; confirm
  before claiming all analytics is immediately removed on account deletion.
- Device-only drafts exist in [quickBoq.ts](../../src/lib/services/quickBoq.ts)
  and auth sessions persist through the [Supabase client](../../src/lib/supabase.ts).
  The request button does not itself clear browser storage or vendor data.

## Suggested content-rating questionnaire answers

Use the actual [Play Console questionnaire](https://support.google.com/googleplay/android-developer/answer/9859655?hl=en)
for the submitted app; Google/IARC assigns the regional ratings. These are
suggestions from source, not an awarded rating.

| Topic | Suggested answer and evidence |
| --- | --- |
| App kind | Utility / other non-game app for construction planning. [Budget estimator](../../src/app/quick-budget/page.tsx), [BOQ wizard](../../src/app/boq/new/page.tsx). |
| Violence, sexual content/nudity, horror, profanity, drugs/alcohol/tobacco, gambling or simulated gambling | **No intentionally supplied content** found in the reviewed estimating/marketplace screens. User-uploaded content remains possible; answer the separate user-content questions accurately. |
| User communication / user-generated content | **Yes where asked**: supplier/contractor profiles, enquiries, RFQs, shared projects and uploaded photos/documents. Do not answer “no interaction” because this is not a social network. [Enquiries](../../src/app/api/enquiries/route.ts), [RFQs](../../src/lib/services/rfq.ts), [photos](../../src/app/api/projects/[id]/photos/route.ts), [public contractors](../../src/lib/services/contractors.ts). |
| Sharing personal information with other users | **Yes**, for public business profiles and contact details in enquiries or quote flows. Same sources as above. |
| Location shared with other users | Entered site/delivery addresses or service areas may be shared in project/business flows; **yes if asked about any location sharing**. No live device-location sharing was found. [Projects](../../src/lib/services/projects.ts), [RFQs](../../src/lib/services/rfq.ts), [supplier registration](../../src/app/supplier/register/page.tsx). |
| Purchases | Physical-material procurement/quote flows exist; supplier subscription/payment records also exist. Answer purchase questions for whichever paid flows are actually enabled; **no randomised purchases/loot boxes found**. [RFQs](../../src/lib/services/rfq.ts), [subscriptions](../../src/lib/services/subscriptions.ts), [billing](../../src/app/supplier/billing/page.tsx). |
| Unrestricted internet access / web browser | **No** general browsing interface found. Specific business/social/external links exist. [Main layout](../../src/components/layout/MainLayout.tsx), [supplier page](../../src/app/marketplace/suppliers/[id]/page.tsx). |
| Advertising | **No** advertising integration found; do not confuse product analytics with ads. [Privacy §8](../../src/app/privacy/page.tsx), [analytics](../../src/lib/productAnalytics.ts). |
| Target audience | **18+**, matching [privacy §10](../../src/app/privacy/page.tsx). Target audience is separate from the automatically assigned content rating. |

## Six screenshots to capture

Use a phone-sized viewport in the finished TWA, with fictional sample work and
no real account details, private plans or contact information.

1. **`/home` — signed-out starting screen.** Show the main estimating entry
   points and navigation, with the install banner suppressed inside the app.
2. **`/quick-budget` — populated estimate.** Enter a representative budget and
   show the resulting stage-cost breakdown and build assumptions.
3. **`/boq/new` — floor-plan review.** Use a synthetic plan and show the extracted
   rooms/measurements for review, before confirming them.
4. **`/boq/new` — completed review estimate.** Show material quantities, line
   costs and the total with PDF/share actions available.
5. **`/quick-projects/solar` — completed calculator result.** Show a configured
   solar package and its cost/BOQ breakdown after answering the guided steps.
6. **`/projects/[id]` — saved sample project.** Show the progress/photos state
   with sample construction photos and stage information; use a test account
   with no identifying information visible.

## Items to resolve before submitting the form

- Confirm which configurable analytics, AI and messaging providers are live,
  their independent uses of data, and the corresponding sharing answers.
  Reconcile privacy disclosures for NVIDIA/OpenRouter and optional messaging
  providers with actual deployment.
- Confirm vendor diagnostic/identifier/IP-derived location collection and
  retention, including Vercel Analytics, rather than treating anonymous traffic
  as no collection.
- Confirm all deployed endpoints use HTTPS, review the separate Android
  manifest/SDKs, and verify the team can fulfil the published deletion/retention
  process across stored files and processors.
- Confirm whether paid checkout and additional KYC collection are live; neither
  the privacy text nor database types alone establish that they are.
- The privacy page still has company/address/registration placeholders.
  Resolve them with real company details; none were invented in this draft.
- Check category/tag availability in Play Console. Capture the six screenshots
  from the final Android build. This task supplies the list, not screenshots.
