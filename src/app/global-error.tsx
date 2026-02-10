'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'var(--font-geist-sans)', background: '#f8fafc', color: '#0f172a' }}>
        <div style={{ maxWidth: '720px', margin: '10vh auto', padding: '2.5rem', background: '#ffffff', borderRadius: '16px', boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)' }}>
          <h1 style={{ fontSize: '1.75rem', marginTop: 0 }}>Something went wrong</h1>
          <p style={{ color: '#64748b' }}>
            {error?.message || 'A critical error occurred. Please refresh the page.'}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '10px',
              border: 'none',
              background: '#2563eb',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
