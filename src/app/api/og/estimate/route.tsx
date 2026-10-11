import { ImageResponse } from 'next/og';
import { summariseSharedEstimate } from '@/lib/og/sharedEstimate';

/**
 * The picture WhatsApp shows when a Budget Estimator link is shared.
 *
 * A shared estimate used to preview as the site's generic card, so the one
 * moment someone decides whether to tap — before they have opened anything —
 * said nothing about the estimate. This draws the estimate itself: "What
 * $2,500 buys in solar", with the system and its backup hours.
 *
 * Takes the same query string as the page, and gets its figures from the same
 * calculation (see summariseSharedEstimate), so the card cannot promise a
 * different estimate from the one the link opens.
 */

const NAVY = '#0B1F3B';
const NAVY_LIGHT = '#1A3A5C';
const ACCENT = '#2E6CF6';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const summary = summariseSharedEstimate(params);

  const kicker = summary?.kicker ?? 'BUDGET ESTIMATOR';
  const headline = summary?.headline ?? 'What can your budget build?';
  const lines = summary?.lines ?? ['House builds, solar, boreholes, fencing and paving', 'Priced for Zimbabwe'];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`,
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              fontSize: 26,
              letterSpacing: 4,
              color: '#BFD3FF',
              border: `2px solid ${ACCENT}`,
              borderRadius: 999,
              padding: '8px 22px',
            }}
          >
            {kicker}
          </div>
          <div style={{ display: 'flex', marginTop: 36, fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
            {headline}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 32 }}>
            {lines.map((line) => (
              <div key={line} style={{ display: 'flex', fontSize: 34, lineHeight: 1.35, color: '#DCE6FA', marginTop: 8 }}>
                {line}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>ZimEstimate</div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 700,
              background: ACCENT,
              borderRadius: 14,
              padding: '14px 26px',
            }}
          >
            Open and adjust →
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Same link, same picture: let WhatsApp's fetcher and the CDN keep it.
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
      },
    },
  );
}
