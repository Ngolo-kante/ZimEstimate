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
    title: 'Use of Service',
    body: 'ZimEstimate is provided for professional estimating, procurement, supplier, and project-management workflows. Users are responsible for validating project assumptions, supplier decisions, and final contractual outputs.',
  },
  {
    title: 'Accounts and Access',
    body: 'You are responsible for maintaining the confidentiality of your account credentials and for activities carried out under your account, supplier profile, or admin access.',
  },
  {
    title: 'Pricing and AI Outputs',
    body: 'Material prices, AI-generated outputs, and analytics are decision-support tools. They may change over time and must be reviewed before procurement, contracting, or submission to clients.',
  },
  {
    title: 'Acceptable Use',
    body: 'You must not misuse the platform, interfere with service availability, submit unlawful content, attempt unauthorized access, or abuse admin and scraping workflows.',
  },
];

export default function TermsPage() {
  return (
    <MainLayout title="Terms of Service">
      <div style={shellStyle}>
        <p style={introStyle}>
          These terms govern the use of ZimEstimate for estimating, procurement, supplier, and project workflows.
        </p>
        {sections.map((section) => (
          <section key={section.title} style={sectionStyle}>
            <h2 style={titleStyle}>{section.title}</h2>
            <p style={bodyStyle}>{section.body}</p>
          </section>
        ))}
        <section style={sectionStyle}>
          <h2 style={titleStyle}>Support</h2>
          <p style={bodyStyle}>Questions about these terms can be sent to support@zimestimate.co.zw.</p>
        </section>
      </div>
    </MainLayout>
  );
}
