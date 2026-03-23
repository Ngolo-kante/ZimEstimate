import MainLayout from '@/components/layout/MainLayout';

const shellStyle = { maxWidth: '840px', margin: '0 auto', display: 'grid', gap: '24px' } as const;
const introStyle = { color: 'var(--color-text-secondary)', lineHeight: 1.7 } as const;
const sectionStyle = {
  background: 'white',
  border: '1px solid var(--color-border-light)',
  borderRadius: '20px',
  padding: '24px',
} as const;
const titleStyle = { margin: '0 0 12px', fontSize: '1.2rem', color: 'var(--color-primary)' } as const;
const bodyStyle = { margin: 0, lineHeight: 1.7, color: 'var(--color-text-secondary)' } as const;

const sections = [
  {
    title: 'Information We Collect',
    body: 'ZimEstimate stores account details, project data, supplier submissions, BOQ records, usage data, and files you upload to support estimating, procurement, and project workflows.',
  },
  {
    title: 'How We Use It',
    body: 'We use this information to run the application, generate estimates, process notifications, improve product quality, support supplier workflows, and monitor system health and fraud risk.',
  },
  {
    title: 'Third-Party Services',
    body: 'Depending on the feature you use, data may be processed by Supabase, Vercel, Google Gemini, Firecrawl, WhatsApp/Twilio/Telegram, and email delivery providers configured by ZimEstimate.',
  },
  {
    title: 'Retention and Deletion',
    body: 'Project, supplier, and operational records are retained for product continuity, legal compliance, and auditability. Contact support if you need account-level data deletion or export assistance.',
  },
];

export default function PrivacyPage() {
  return (
    <MainLayout title="Privacy Policy">
      <div style={shellStyle}>
        <p style={introStyle}>
          This policy explains the data ZimEstimate collects and how it is used to deliver construction estimating and procurement workflows.
        </p>
        {sections.map((section) => (
          <section key={section.title} style={sectionStyle}>
            <h2 style={titleStyle}>{section.title}</h2>
            <p style={bodyStyle}>{section.body}</p>
          </section>
        ))}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>Contact</h2>
          <p style={bodyStyle}>For privacy requests, email support@zimestimate.co.zw.</p>
        </section>
      </div>
    </MainLayout>
  );
}
