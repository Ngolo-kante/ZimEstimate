import MainLayout from '@/components/layout/MainLayout';

const shellStyle = { maxWidth: '980px', margin: '0 auto', display: 'grid', gap: '24px' } as const;
const cardStyle = {
  background: 'white',
  border: '1px solid var(--color-border-light)',
  borderRadius: '20px',
  padding: '24px',
} as const;
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' } as const;
const titleStyle = { margin: '0 0 12px', color: 'var(--color-primary)' } as const;
const textStyle = { margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.7 } as const;
const detailStyle = { fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' } as const;

const supportChannels = [
  {
    title: 'General Support',
    detail: 'support@zimestimate.com',
    helper: 'Use for account access, project issues, pricing questions, and launch support.',
  },
  {
    title: 'Supplier Support',
    detail: 'support@zimestimate.com',
    helper: 'Use for supplier registration, product catalogue issues, and profile verification questions.',
  },
  {
    title: 'Operational Incidents',
    detail: 'Include subject: INCIDENT',
    helper: 'Use for failed reminder dispatch, scraper failures, broken production flows, or major data problems.',
  },
];

export default function SupportPage() {
  return (
    <MainLayout title="Support">
      <div style={shellStyle}>
        <section style={cardStyle}>
          <h2 style={titleStyle}>Need help with ZimEstimate?</h2>
          <p style={textStyle}>
            Contact the support team for account issues, production incidents, supplier questions, or help with project workflows.
          </p>
        </section>
        <div style={gridStyle}>
          {supportChannels.map((channel) => (
            <article key={channel.title} style={cardStyle}>
              <h3 style={titleStyle}>{channel.title}</h3>
              <p style={detailStyle}>{channel.detail}</p>
              <p style={textStyle}>{channel.helper}</p>
            </article>
          ))}
        </div>
        <section style={cardStyle}>
          <h2 style={titleStyle}>What to include</h2>
          <p style={textStyle}>Include your account email, route or feature name, the project or supplier record involved, and screenshots or timestamps where possible.</p>
        </section>
      </div>
    </MainLayout>
  );
}
