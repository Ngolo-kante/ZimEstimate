import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import RequestDeletion from './request-deletion';

const sectionStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-light)',
  borderRadius: '20px',
  padding: '28px',
} as const;
const titleStyle = { margin: '0 0 12px', fontSize: '1.2rem', color: 'var(--color-primary)' } as const;
const bodyStyle = { margin: 0, lineHeight: 1.8, color: 'var(--color-text-secondary)' } as const;

export default function DeleteAccountPage() {
  return (
    <MainLayout title="Delete your ZimEstimate account">
      <div style={{ maxWidth: '840px', margin: '0 auto', display: 'grid', gap: '24px' }}>
        <p style={bodyStyle}>
          You can request deletion of your ZimEstimate account and associated data here,
          without installing or opening the app. Our team handles deletion requests.
          Sending a request does not immediately delete your account.
        </p>

        <section style={sectionStyle}>
          <h2 style={titleStyle}>How to request deletion</h2>
          <ol style={{ ...bodyStyle, paddingLeft: '20px', marginBottom: '20px' }}>
            <li>If you are signed in, press &ldquo;Request deletion&rdquo; below.</li>
            <li>
              If you are signed out,{' '}
              <Link href="/auth/login?redirect=%2Fdelete-account" className="underline">sign in first</Link>,
              or email{' '}
              <a href="mailto:support@zimestimate.com?subject=Account%20deletion%20request" className="underline">
                support@zimestimate.com
              </a>{' '}
              with the subject &ldquo;Account deletion request&rdquo; and your account email address.
            </li>
          </ol>
          <RequestDeletion />
          <p style={{ ...bodyStyle, marginTop: '16px' }}>
            The team may ask for proof of identity before processing your request.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={titleStyle}>What is deleted and when</h2>
          <p style={bodyStyle}>
            Your account and associated projects, bills of quantities (BOQs), uploaded plans
            and photos, and saved settings are included in the deletion request.
            Our Privacy Policy states that closed-account data is kept for 30 days after
            account closure, then deleted, except where legal retention applies.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={titleStyle}>What may be kept</h2>
          <ul style={{ ...bodyStyle, paddingLeft: '20px' }}>
            <li>KYC / AML documents: 5 years after the business relationship ends, for legal compliance.</li>
            <li>Transaction and payment records: 5 years from the transaction date, for tax requirements.</li>
            <li>Marketing consent records: the duration of consent plus 3 years, as evidence of consent.</li>
            <li>Security and audit logs: 12 months, for security and fraud prevention.</li>
            <li>
              Separate copies of floor plans uploaded for reading: 12 months, for testing and
              improving the plan reader. These private copies are not linked to your account or IP address.
            </li>
          </ul>
          <p style={{ ...bodyStyle, marginTop: '12px' }}>
            See our <Link href="/privacy" className="underline">Privacy Policy</Link> for
            retention details and your data rights. For help with a request,{' '}
            <Link href="/support?category=privacy&subject=Account%20deletion%20request" className="underline">
              contact support
            </Link>.
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
