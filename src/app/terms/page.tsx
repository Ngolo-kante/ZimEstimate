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
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem', marginTop: '10px' };
const thStyle = { background: '#f1f5f9', padding: '8px 12px', textAlign: 'left' as const, fontWeight: 600, border: '1px solid #e2e8f0' };
const tdStyle = { padding: '8px 12px', border: '1px solid #e2e8f0', verticalAlign: 'top' as const };

export default function TermsPage() {
  return (
    <MainLayout title="Terms of Service">
      <div style={shellStyle}>
        <p style={introStyle}>
          <strong>Effective date: 1 January 2025 · Last updated: 26 March 2025</strong>
          <br /><br />
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the ZimEstimate platform
          (&ldquo;Platform&rdquo;, &ldquo;Service&rdquo;), operated by <strong>ZimEstimate (Private) Limited</strong>
          (&ldquo;ZimEstimate&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By creating an account
          or using the Platform you agree to be bound by these Terms. If you do not agree, do not use the Platform.
        </p>

        {/* 1. Company Identity */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>1. Company Identity &amp; Contact</h2>
          <p style={bodyStyle}>
            <strong>Legal name:</strong> ZimEstimate (Private) Limited<br />
            <strong>CIPA registration:</strong> [Registration number — to be inserted upon incorporation]<br />
            <strong>Registered address:</strong> [Physical address, Harare, Zimbabwe]<br />
            <strong>Primary email:</strong> support@zimestimate.com<br />
            <strong>ZIMRA TIN:</strong> [Tax Identification Number — to be inserted upon registration]<br />
            <strong>Data Protection Officer:</strong> privacy@zimestimate.com
          </p>
        </section>

        {/* 2. Nature of the Platform */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>2. Nature of the Platform</h2>
          <p style={bodyStyle}>
            ZimEstimate is a <strong>B2B technology marketplace and project-management tool</strong> that connects
            builders, contractors, and quantity surveyors with construction material suppliers in Zimbabwe.
            ZimEstimate is an <strong>intermediary only</strong>: we do not manufacture, stock, supply, or warrant
            the quality, safety, or fitness for purpose of any materials listed by suppliers on the Platform.
          </p>
          <ul style={listStyle}>
            <li>All procurement contracts are concluded directly between the buyer and the supplier.</li>
            <li>Bill-of-quantities outputs, pricing estimates, and AI-generated figures are decision-support tools and must be independently verified before use in tendering, contracting, or procurement.</li>
            <li>ZimEstimate does not hold funds on behalf of buyers or suppliers. Payment processing is handled by Stripe (USD) and Paynow Zimbabwe (ZWG/EcoCash) as independent payment service providers.</li>
          </ul>
        </section>

        {/* 3. Account Registration */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>3. Account Registration &amp; Eligibility</h2>
          <p style={bodyStyle}>
            To use the Platform you must:
          </p>
          <ul style={listStyle}>
            <li>Be at least 18 years old and legally capable of entering contracts under Zimbabwe law.</li>
            <li>Provide accurate, current, and complete registration information.</li>
            <li>Maintain the confidentiality of your login credentials. You are responsible for all activity under your account.</li>
            <li>Notify us immediately at support@zimestimate.com of any unauthorised access to your account.</li>
          </ul>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            Supplier accounts additionally require: valid CIPA registration, a ZIMRA Tax Identification Number,
            and completion of our Know Your Business (KYB) verification process. We reserve the right to
            suspend or terminate accounts that fail KYB verification or that we reasonably suspect involve fraud,
            money laundering, or sanctions evasion.
          </p>
        </section>

        {/* 4. Subscription Plans & Payments */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>4. Subscription Plans, Billing &amp; Payments</h2>
          <p style={bodyStyle}><strong>Supplier subscription tiers:</strong></p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Plan</th>
                <th style={thStyle}>Price</th>
                <th style={thStyle}>Key inclusions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Basic</td>
                <td style={tdStyle}>Free</td>
                <td style={tdStyle}>Up to 10 product listings, RFQ leads only</td>
              </tr>
              <tr>
                <td style={tdStyle}>Pro</td>
                <td style={tdStyle}>USD 15 / month</td>
                <td style={tdStyle}>Unlimited products, contact requests, verified badge, analytics</td>
              </tr>
              <tr>
                <td style={tdStyle}>Premium</td>
                <td style={tdStyle}>USD 35 / month</td>
                <td style={tdStyle}>Everything in Pro + featured listing, API access, product packages</td>
              </tr>
            </tbody>
          </table>
          <ul style={{ ...listStyle, marginTop: '16px' }}>
            <li><strong>Auto-renewal:</strong> Paid subscriptions renew automatically each calendar month on your billing date unless you cancel before the renewal date.</li>
            <li><strong>Cancellation:</strong> You may cancel at any time from &ldquo;Billing &amp; Plan&rdquo; in your supplier dashboard. Cancellation takes effect at the end of the current billing period; no partial refunds are issued for unused time within a paid period.</li>
            <li><strong>Cooling-off right:</strong> Under the Zimbabwe Consumer Protection Act (Chapter 14:44), you have the right to cancel a new paid subscription within <strong>5 business days</strong> of first payment and receive a full refund, provided you have not materially used the features exclusive to that paid tier.</li>
            <li><strong>Price changes:</strong> We will give you at least <strong>30 days&rsquo; written notice</strong> (by email to your registered address) before increasing subscription fees. Continued use after the effective date constitutes acceptance of the new price.</li>
            <li><strong>Currency:</strong> USD prices are charged via Stripe (card). ZWG equivalent payments are available via Paynow Zimbabwe (EcoCash). The applicable exchange rate for ZWG transactions is determined at the time of payment using the prevailing RBZ interbank rate.</li>
            <li><strong>Failed payments:</strong> If a payment fails, we will retry up to three times over 7 days. If payment remains outstanding, your account may be downgraded to Basic tier until payment is resolved.</li>
            <li><strong>Taxes:</strong> Prices are exclusive of VAT. We will add VAT at the applicable rate once ZimEstimate is VAT-registered with ZIMRA. If your business is VAT-registered, you may request a VAT invoice from billing@zimestimate.com.</li>
          </ul>
        </section>

        {/* 5. Use of Service & Acceptable Use */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>5. Acceptable Use</h2>
          <p style={bodyStyle}>You must not:</p>
          <ul style={listStyle}>
            <li>Use the Platform for any unlawful purpose under Zimbabwe law or applicable international law.</li>
            <li>Attempt to gain unauthorised access to any part of the Platform, its databases, servers, or connected systems.</li>
            <li>List prohibited goods — weapons, controlled substances, goods requiring import licences you do not hold, or goods in breach of Zimbabwe Standards Association (SAZ) regulations.</li>
            <li>Submit false, misleading, or fraudulent information in listings, KYC submissions, or transaction records.</li>
            <li>Use the Platform to facilitate money laundering, terrorist financing, or sanctions evasion.</li>
            <li>Scrape, crawl, or systematically copy platform data without our prior written consent.</li>
            <li>Interfere with or disrupt Platform availability, security, or performance.</li>
            <li>Impersonate any person or organisation, or misrepresent your affiliation with any entity.</li>
          </ul>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            We cooperate fully with the Zimbabwe Republic Police, the Financial Intelligence Unit (FIU) Zimbabwe,
            and other competent authorities. We will disclose user information where required by law.
          </p>
        </section>

        {/* 6. Supplier Obligations */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>6. Supplier-Specific Obligations</h2>
          <p style={bodyStyle}>Suppliers on the Platform warrant and undertake that:</p>
          <ul style={listStyle}>
            <li>They are validly registered with CIPA and hold a current ZIMRA TIN.</li>
            <li>All product listings, pricing, stock availability, and lead times are accurate and kept current.</li>
            <li>Products comply with all applicable Zimbabwe standards (SAZ standards where published), import regulations, and consumer safety requirements.</li>
            <li>They will not post pricing that facilitates price-fixing, market allocation, or collusion with competing suppliers on the Platform — such conduct is prohibited under the Competition Act (Chapter 14:28).</li>
            <li>They hold, or will promptly obtain, any sector-specific licence required for their business category (e.g., building materials dealer, contractor registration with the Construction Industry Federation of Zimbabwe).</li>
            <li>The KYC and business documents submitted during registration are genuine, current, and belong to the registering entity.</li>
          </ul>
        </section>

        {/* 7. Intellectual Property */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>7. Intellectual Property</h2>
          <p style={bodyStyle}>
            The Platform software, design, trademarks, and all ZimEstimate-authored content are owned by
            ZimEstimate (Private) Limited and protected under Zimbabwe&rsquo;s Intellectual Property Act
            (Chapter 26:04) and related legislation. You may not copy, reproduce, distribute, or create
            derivative works without our prior written consent.
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            By uploading product listings, images, pricing data, or other content to the Platform, you grant
            ZimEstimate a non-exclusive, royalty-free, worldwide licence to display, reproduce, and distribute
            that content on the Platform for the purpose of operating the Service. You retain ownership of
            your content and may remove it by deleting listings or closing your account.
          </p>
        </section>

        {/* 8. Data Protection */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>8. Data Protection</h2>
          <p style={bodyStyle}>
            We process personal data in accordance with the Zimbabwe <strong>Cyber and Data Protection Act
            (CDPA), Chapter 12:07</strong> and our <a href="/privacy" style={{ color: 'var(--color-primary)' }}>Privacy
            Policy</a>, which is incorporated into these Terms by reference. Our Data Protection Officer can
            be contacted at <strong>privacy@zimestimate.com</strong>. By using the Platform you acknowledge
            that we collect and process data as described in the Privacy Policy.
          </p>
        </section>

        {/* 9. Limitation of Liability */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>9. Limitation of Liability</h2>
          <p style={bodyStyle}>
            To the maximum extent permitted by Zimbabwe law (including the Consumer Protection Act where
            applicable):
          </p>
          <ul style={listStyle}>
            <li><strong>Platform intermediary:</strong> ZimEstimate is not a party to any transaction between a builder and a supplier. We are not liable for the quality, safety, or delivery of goods, or for disputes between buyers and suppliers.</li>
            <li><strong>Estimate accuracy:</strong> BOQ outputs, AI-generated pricing, and analytics are indicative only. ZimEstimate is not liable for any loss arising from reliance on these figures without independent verification.</li>
            <li><strong>Liability cap:</strong> Our total liability to you for any claim arising from or related to the Platform shall not exceed the subscription fees paid by you in the <strong>12 months preceding the claim</strong>.</li>
            <li><strong>Excluded losses:</strong> We exclude liability for indirect, consequential, special, punitive, or loss-of-profit damages, to the extent permitted by law.</li>
            <li><strong>Non-exclusion:</strong> Nothing in these Terms excludes or limits our liability for death or personal injury caused by our negligence, fraud, or any liability that cannot be excluded under Zimbabwe law.</li>
          </ul>
        </section>

        {/* 10. Termination */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>10. Termination</h2>
          <p style={bodyStyle}>
            <strong>By you:</strong> You may close your account at any time via your account settings. Paid
            subscriptions remain active until the end of the current billing period.
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            <strong>By us:</strong> We may suspend or terminate your account immediately if you breach these
            Terms, fail KYB/AML checks, engage in fraud or unlawful activity, or if required by a competent
            authority. For termination without cause, we will give you at least <strong>30 days&rsquo; notice</strong>.
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            <strong>Effect of termination:</strong> On termination, your right to use the Platform ceases.
            We will retain data for the periods specified in the Privacy Policy (minimum 5 years for AML/ZIMRA
            purposes), then delete or anonymise it. Sections 7, 8, 9, 11, and 12 survive termination.
          </p>
        </section>

        {/* 11. Dispute Resolution */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>11. Dispute Resolution</h2>
          <p style={bodyStyle}>
            <strong>Internal complaints:</strong> Contact support@zimestimate.com. We will acknowledge within
            2 business days and endeavour to resolve complaints within 14 business days.
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            <strong>Governing law:</strong> These Terms are governed by the laws of <strong>Zimbabwe</strong>.
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            <strong>Jurisdiction:</strong> Disputes not resolved internally shall be subject to the
            exclusive jurisdiction of the <strong>High Court of Zimbabwe</strong>. For B2B disputes,
            either party may elect binding arbitration under the Arbitration Act (Chapter 7:15)
            and the UNCITRAL Arbitration Rules, seated in Harare.
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            Consumers (individuals acting outside a business capacity) retain the right to refer unresolved
            complaints to the <strong>Consumer Protection Commission of Zimbabwe</strong>.
          </p>
        </section>

        {/* 12. General */}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>12. General Provisions</h2>
          <ul style={listStyle}>
            <li><strong>Updates to Terms:</strong> We may update these Terms at any time. Material changes will be notified by email at least 14 days before taking effect. Continued use after the effective date constitutes acceptance.</li>
            <li><strong>Severability:</strong> If any provision is found unenforceable, the remainder of the Terms continues in force.</li>
            <li><strong>Entire agreement:</strong> These Terms, together with the Privacy Policy and any supplemental policies published on the Platform, constitute the entire agreement between you and ZimEstimate.</li>
            <li><strong>Force majeure:</strong> We are not liable for failure or delay caused by events outside our reasonable control (power outages, government action, natural disasters, internet infrastructure failures).</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={titleStyle}>Support &amp; Legal Contact</h2>
          <p style={bodyStyle}>
            Questions about these Terms: <strong>legal@zimestimate.com</strong><br />
            General support: <strong>support@zimestimate.com</strong><br />
            Data protection / privacy: <strong>privacy@zimestimate.com</strong>
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
