'use client';

// ─── What to do with an estimate ──────────────────────────────────────────────
// An estimate is a means, not an end. Someone who has priced a borehole wants
// to find someone to drill it, price the parts, or get quotes — and the app
// used to leave them on a total with nowhere to go.

import Link from 'next/link';
import { HardHat, Storefront, Envelope, CaretRight } from '@phosphor-icons/react';
import { contractorSearchHref } from '@/components/contractors/FindContractorCTA';

interface NextStepsCardProps {
  projectType: string;
  /** Free-text location from the estimate; ignored unless it names a service area. */
  area?: string;
  /** Null while quotes are still loading, so the row can say nothing rather than lie. */
  quoteSummary: { open: number; quoted: number } | null;
  onRequestQuotes: () => void;
  requestingQuotes: boolean;
}

export default function NextStepsCard({
  projectType,
  area,
  quoteSummary,
  onRequestQuotes,
  requestingQuotes,
}: NextStepsCardProps) {
  // Knowing you are still waiting is the whole point — that was the question
  // asked of this screen. Two things it must not do: read a confident zero
  // while still loading, and count requests as if they were suppliers. One
  // request may sit with several suppliers or with none, so it is described as
  // a request.
  const quoteLine =
    quoteSummary === null
      ? 'Checking…'
      : quoteSummary.quoted > 0
        ? `${quoteSummary.quoted} priced${quoteSummary.open > 0 ? `, ${quoteSummary.open} still out` : ''}`
        : quoteSummary.open > 0
          ? `${quoteSummary.open} request${quoteSummary.open === 1 ? '' : 's'} sent — no prices back yet`
          : 'Ask suppliers to price this list';

  return (
    <section className="steps-card">
      <h2>Next steps</h2>

      <div className="steps">
        <Link href={contractorSearchHref(projectType, area)} className="step">
          <HardHat size={20} weight="duotone" />
          <span className="step-text">
            <span className="step-title">Find a contractor</span>
            <span className="step-sub">Installers who do this kind of work</span>
          </span>
          <CaretRight size={16} />
        </Link>

        <Link href="/marketplace" className="step">
          <Storefront size={20} weight="duotone" />
          <span className="step-text">
            <span className="step-title">Buy the materials</span>
            <span className="step-sub">Compare suppliers and prices</span>
          </span>
          <CaretRight size={16} />
        </Link>

        <button type="button" onClick={onRequestQuotes} disabled={requestingQuotes} className="step">
          <Envelope size={20} weight="duotone" />
          <span className="step-text">
            <span className="step-title">{requestingQuotes ? 'Sending…' : 'Request quotes'}</span>
            <span className="step-sub">{quoteLine}</span>
          </span>
          <CaretRight size={16} />
        </button>
      </div>

      <style jsx>{`
        .steps-card {
          border: 1px solid var(--color-border); border-radius: 12px;
          background: var(--color-surface); padding: 20px; margin-bottom: 16px;
        }
        .steps-card h2 { margin: 0 0 14px; font-size: 1rem; font-weight: 700; color: var(--color-text); }
        .steps { display: grid; gap: 8px; }
        .steps :global(.step) {
          display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
          padding: 12px 14px; border-radius: 10px; cursor: pointer; text-decoration: none;
          border: 1px solid var(--color-border); background: var(--color-background);
          color: var(--color-text); transition: border-color 0.15s, background 0.15s;
        }
        .steps :global(.step:hover) { border-color: var(--color-accent); background: var(--color-surface); }
        .steps :global(.step:disabled) { opacity: 0.6; cursor: default; }
        .step-text { display: grid; gap: 2px; flex: 1; min-width: 0; }
        .step-title { font-size: 0.9rem; font-weight: 600; }
        .step-sub { font-size: 0.78rem; color: var(--color-text-secondary); }
      `}</style>
    </section>
  );
}
