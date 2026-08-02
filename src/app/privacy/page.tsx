import MainLayout from '@/components/layout/MainLayout';

const shellStyle = { maxWidth: '840px', margin: '0 auto', display: 'grid', gap: '24px' } as const;
const introStyle = { color: 'var(--color-text-secondary)', lineHeight: 1.7 } as const;
const sectionStyle = {
  background: 'white',
  border: '1px solid var(--color-border-light)',
  borderRadius: '20px',
  padding: '28px',
} as const;
const titleStyle = { margin: '0 0 12px', fontSize: '1.2rem', color: 'var(--color-primary)' } as const;
const bodyStyle = { margin: 0, lineHeight: 1.8, color: 'var(--color-text-secondary)' } as const;
const listStyle = { margin: '8px 0 0 20px', lineHeight: 1.8, color: 'var(--color-text-secondary)', paddingLeft: 0 } as const;
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.85rem', marginTop: '10px' };
const thStyle = { background: '#f1f5f9', padding: '8px 12px', textAlign: 'left' as const, fontWeight: 600, border: '1px solid #e2e8f0' };
const tdStyle = { padding: '8px 12px', border: '1px solid #e2e8f0', verticalAlign: 'top' as const };

export default function PrivacyPage() {
  return (
    <MainLayout title="Privacy Policy">
      <div style={shellStyle}>
        <p style={introStyle}>
          <strong>Effective date: 1 January 2025 · Last updated: 26 March 2025</strong>
          <br /><br />
          This Privacy Policy explains how <strong>ZimEstimate (Private) Limited</strong> (&ldquo;ZimEstimate&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses, stores, and protects your personal
          data when you use the ZimEstimate platform (&ldquo;Platform&rdquo;). This policy is issued in compliance
          with the Zimbabwe <strong>Cyber and Data Protection Act (CDPA), Chapter 12:07 (2021)</strong>.
        </p>

        {/* 1. Data Controller Identity */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>1. Data Controller Identity</h2>
          <p style={bodyStyle}>
            <strong>Data Controller:</strong> ZimEstimate (Private) Limited<br />
            <strong>CIPA Registration:</strong> [To be inserted upon incorporation]<br />
            <strong>Registered address:</strong> [Physical address, Harare, Zimbabwe]<br />
            <strong>Data Protection Officer (DPO):</strong> privacy@zimestimate.com<br />
            <strong>ZDPA Registration Number:</strong> [To be inserted upon registration with the Zimbabwe Data Protection Authority]
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            We are registered (or in the process of registering) as a <strong>data controller</strong> with
            the Zimbabwe Data Protection Authority (ZDPA) under the CDPA, as required before processing
            personal data at scale.
          </p>
        </section>

        {/* 2. Data We Collect */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>2. Personal Data We Collect</h2>
          <p style={bodyStyle}>We collect the following categories of personal data:</p>
          <ul style={listStyle}>
            <li><strong>Identity data:</strong> Full name, job title, professional role.</li>
            <li><strong>Contact data:</strong> Email address, phone number, WhatsApp number.</li>
            <li><strong>Business data:</strong> Company name, CIPA registration number, ZIMRA TIN, business address, VAT number, material categories handled.</li>
            <li><strong>KYC / verification documents:</strong> Certificate of Incorporation, director national IDs or passports, proof of business address. Collected for supplier verification and AML compliance.</li>
            <li><strong>Financial and transaction data:</strong> Subscription plan, billing history, payment method type (we do not store raw card numbers — card processing is handled by Stripe). Payment reference numbers for Paynow/EcoCash transactions.</li>
            <li><strong>Project and BOQ data:</strong> Estimates, bill-of-quantities records, site locations, materials lists, uploaded floor plans, and project documents you create on the Platform.</li>
            <li><strong>Usage and technical data:</strong> IP address, browser type, device identifiers, session logs, pages visited, features used, error reports.</li>
            <li><strong>Communications data:</strong> Email notification preferences, support tickets, and messages sent to our team.</li>
          </ul>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            We do not collect special category data (health, biometric, racial or ethnic origin, religious beliefs)
            unless voluntarily submitted — in which case we will obtain your explicit consent.
          </p>
        </section>

        {/* 3. Purpose and Lawful Basis */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>3. Purpose &amp; Lawful Basis for Processing</h2>
          <p style={bodyStyle}>We process your data for the following purposes and on the following lawful bases under the CDPA:</p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Purpose</th>
                <th style={thStyle}>Data used</th>
                <th style={thStyle}>Lawful basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Account creation &amp; management</td>
                <td style={tdStyle}>Identity, contact data</td>
                <td style={tdStyle}>Contract performance</td>
              </tr>
              <tr>
                <td style={tdStyle}>Delivering BOQ, estimating &amp; procurement features</td>
                <td style={tdStyle}>Project &amp; BOQ data, usage data</td>
                <td style={tdStyle}>Contract performance</td>
              </tr>
              <tr>
                <td style={tdStyle}>Supplier verification (KYB)</td>
                <td style={tdStyle}>Business data, KYC documents</td>
                <td style={tdStyle}>Legal obligation (AML) &amp; legitimate interests</td>
              </tr>
              <tr>
                <td style={tdStyle}>Processing subscription payments</td>
                <td style={tdStyle}>Financial &amp; transaction data</td>
                <td style={tdStyle}>Contract performance</td>
              </tr>
              <tr>
                <td style={tdStyle}>AML / fraud prevention &amp; sanctions screening</td>
                <td style={tdStyle}>KYC documents, transaction data</td>
                <td style={tdStyle}>Legal obligation (MLPCA, FIU Zimbabwe)</td>
              </tr>
              <tr>
                <td style={tdStyle}>Customer support &amp; complaint handling</td>
                <td style={tdStyle}>Identity, contact, communications data</td>
                <td style={tdStyle}>Contract performance &amp; legitimate interests</td>
              </tr>
              <tr>
                <td style={tdStyle}>Platform security, abuse prevention &amp; audit logging</td>
                <td style={tdStyle}>Usage &amp; technical data</td>
                <td style={tdStyle}>Legitimate interests</td>
              </tr>
              <tr>
                <td style={tdStyle}>Product analytics &amp; improvement</td>
                <td style={tdStyle}>Usage &amp; technical data (aggregated / anonymised)</td>
                <td style={tdStyle}>Legitimate interests</td>
              </tr>
              <tr>
                <td style={tdStyle}>Marketing emails &amp; product updates</td>
                <td style={tdStyle}>Contact data, communications preferences</td>
                <td style={tdStyle}>Consent (opt-in; withdrawable at any time)</td>
              </tr>
              <tr>
                <td style={tdStyle}>Legal compliance &amp; responding to authority requests</td>
                <td style={tdStyle}>Any relevant data</td>
                <td style={tdStyle}>Legal obligation</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 4. Data Retention */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>4. Data Retention</h2>
          <p style={bodyStyle}>We retain personal data only for as long as necessary:</p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Data category</th>
                <th style={thStyle}>Retention period</th>
                <th style={thStyle}>Reason</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>KYC / AML documents</td>
                <td style={tdStyle}>5 years after end of business relationship</td>
                <td style={tdStyle}>MLPCA Section 19 / FIU Zimbabwe requirement</td>
              </tr>
              <tr>
                <td style={tdStyle}>Transaction &amp; payment records</td>
                <td style={tdStyle}>5 years from transaction date</td>
                <td style={tdStyle}>ZIMRA / Income Tax Act requirement</td>
              </tr>
              <tr>
                <td style={tdStyle}>Account data (active users)</td>
                <td style={tdStyle}>Duration of account</td>
                <td style={tdStyle}>Contract performance</td>
              </tr>
              <tr>
                <td style={tdStyle}>Account data (closed accounts)</td>
                <td style={tdStyle}>30 days after closure, then deleted (except where legal retention applies)</td>
                <td style={tdStyle}>CDPA data minimisation</td>
              </tr>
              <tr>
                <td style={tdStyle}>Marketing consent records</td>
                <td style={tdStyle}>Duration of consent + 3 years</td>
                <td style={tdStyle}>Evidential / CDPA best practice</td>
              </tr>
              <tr>
                <td style={tdStyle}>Security &amp; audit logs</td>
                <td style={tdStyle}>12 months rolling</td>
                <td style={tdStyle}>Security &amp; fraud prevention</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 5. Third-Party Processors */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>5. Third-Party Processors &amp; Cross-Border Transfers</h2>
          <p style={bodyStyle}>
            We share personal data with the following sub-processors to operate the Platform.
            Each is bound by a Data Processing Agreement (DPA) with ZimEstimate:
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Processor</th>
                <th style={thStyle}>Country</th>
                <th style={thStyle}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Supabase, Inc.</td>
                <td style={tdStyle}>USA</td>
                <td style={tdStyle}>Database hosting, user authentication, file storage</td>
              </tr>
              <tr>
                <td style={tdStyle}>Stripe, Inc.</td>
                <td style={tdStyle}>USA / Ireland</td>
                <td style={tdStyle}>USD card payment processing &amp; KYB verification</td>
              </tr>
              <tr>
                <td style={tdStyle}>Paynow Zimbabwe / Zimswitch</td>
                <td style={tdStyle}>Zimbabwe</td>
                <td style={tdStyle}>ZWG / EcoCash payment processing</td>
              </tr>
              <tr>
                <td style={tdStyle}>Vercel, Inc.</td>
                <td style={tdStyle}>USA</td>
                <td style={tdStyle}>Platform hosting &amp; edge delivery</td>
              </tr>
              <tr>
                <td style={tdStyle}>Email delivery provider (e.g., Resend)</td>
                <td style={tdStyle}>USA</td>
                <td style={tdStyle}>Transactional emails &amp; notifications</td>
              </tr>
              <tr>
                <td style={tdStyle}>Google (Gemini API)</td>
                <td style={tdStyle}>USA</td>
                <td style={tdStyle}>AI-assisted BOQ and Vision Takeoff features (when used)</td>
              </tr>
            </tbody>
          </table>
          <p style={{ ...bodyStyle, marginTop: '12px' }}>
            <strong>Cross-border transfers:</strong> Several processors are located outside Zimbabwe. The CDPA
            restricts transfers to countries not deemed adequate by the ZDPA unless appropriate safeguards
            are in place. We address this by executing Standard Contractual Clauses (SCCs) or equivalent
            contractual measures with each processor, and by disclosing the transfer in this Privacy Policy.
            By using the Platform, you acknowledge that your data may be transferred to and processed in the USA.
          </p>
        </section>

        {/* 6. Data Subject Rights */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>6. Your Data Subject Rights (CDPA Sections 20–30)</h2>
          <p style={bodyStyle}>Under the CDPA, you have the right to:</p>
          <ul style={listStyle}>
            <li><strong>Access:</strong> Request a copy of the personal data we hold about you (we will respond within 30 days).</li>
            <li><strong>Rectification:</strong> Ask us to correct inaccurate or incomplete data.</li>
            <li><strong>Erasure (&ldquo;right to be forgotten&rdquo;):</strong> Ask us to delete your data, subject to legal retention obligations (AML/ZIMRA data cannot be deleted ahead of schedule).</li>
            <li><strong>Restriction:</strong> Ask us to restrict processing while a correction or objection is being considered.</li>
            <li><strong>Data portability:</strong> Receive a copy of your data in a structured, commonly used, machine-readable format.</li>
            <li><strong>Object:</strong> Object to processing based on legitimate interests, or to direct marketing at any time.</li>
            <li><strong>Withdraw consent:</strong> Where processing is based on consent, withdraw it at any time (withdrawal does not affect lawfulness of prior processing).</li>
            <li><strong>Not to be subject to automated decisions:</strong> Not to be subject to a decision based solely on automated processing that produces significant legal or similar effects, without human review.</li>
          </ul>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            To exercise any right, email <strong>privacy@zimestimate.com</strong> with your name, account email,
            and the right you wish to exercise. We may request proof of identity before processing the request.
            If you are not satisfied with our response, you may lodge a complaint with the
            <strong> Zimbabwe Data Protection Authority (ZDPA)</strong>.
          </p>
        </section>

        {/* 7. Marketing Communications */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>7. Marketing Communications</h2>
          <p style={bodyStyle}>
            We will only send you marketing emails or product update newsletters if you have given us
            explicit consent (opt-in checkbox at registration or via your account settings). You can
            unsubscribe at any time by clicking &ldquo;Unsubscribe&rdquo; in any marketing email, or by
            emailing privacy@zimestimate.com. Transactional and service notifications (invoices,
            security alerts, subscription renewals) are sent as part of our contract with you and cannot
            be opted out of while your account is active.
          </p>
        </section>

        {/* 8. Cookies */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>8. Cookies &amp; Tracking</h2>
          <p style={bodyStyle}>We use the following categories of cookies:</p>
          <ul style={listStyle}>
            <li><strong>Strictly necessary:</strong> Authentication session tokens and security cookies. These cannot be disabled.</li>
            <li><strong>Functional:</strong> User preferences (language, currency). These are set without separate consent as they are necessary for the service to work as intended.</li>
            <li><strong>Analytics:</strong> Anonymised usage statistics (page views, feature engagement). We will request your consent before setting analytics cookies on your first visit.</li>
          </ul>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            We do not use third-party advertising or behavioural targeting cookies. You may manage cookie preferences in your browser settings at any time.
          </p>
        </section>

        {/* 9. Data Security */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>9. Data Security</h2>
          <p style={bodyStyle}>
            We implement appropriate technical and organisational measures to protect personal data against
            unauthorised access, loss, or destruction, including:
          </p>
          <ul style={listStyle}>
            <li>TLS encryption in transit for all Platform communications.</li>
            <li>Encryption at rest for database storage (Supabase AES-256).</li>
            <li>Row-Level Security (RLS) policies so users can only access their own data.</li>
            <li>Audit logs for all admin and sensitive actions.</li>
            <li>Access controls limiting personal data to staff with a need-to-know.</li>
          </ul>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            <strong>Data breach notification:</strong> If a personal data breach occurs that poses a risk to
            data subjects, we will notify the ZDPA within 72 hours of discovery, and notify affected users
            without undue delay where the risk is high, in accordance with CDPA Section 21.
          </p>
        </section>

        {/* 10. Children */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>10. Children&rsquo;s Privacy</h2>
          <p style={bodyStyle}>
            The Platform is not directed at individuals under the age of 18. We do not knowingly collect
            personal data from children. If we become aware that a minor has registered, we will delete
            their account and associated data promptly.
          </p>
        </section>

        {/* 11. Changes */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>11. Changes to This Policy</h2>
          <p style={bodyStyle}>
            We may update this Privacy Policy from time to time. Material changes will be notified by email
            and by displaying a prominent notice on the Platform at least 14 days before the changes take
            effect. The &ldquo;Last updated&rdquo; date at the top of this page reflects the most recent revision.
          </p>
        </section>

        {/* Contact */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>Contact &amp; Data Requests</h2>
          <p style={bodyStyle}>
            <strong>Data Protection Officer:</strong> privacy@zimestimate.com<br />
            <strong>General support:</strong> support@zimestimate.com<br />
            <strong>Postal:</strong> ZimEstimate (Private) Limited, [Registered address, Harare, Zimbabwe]<br />
            <br />
            To exercise your data subject rights or raise a privacy concern, please email
            privacy@zimestimate.com with &ldquo;Privacy Request&rdquo; in the subject line.
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
