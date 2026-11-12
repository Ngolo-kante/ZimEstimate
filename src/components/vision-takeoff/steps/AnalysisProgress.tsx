'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check, FilePdf } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import type { AnalysisPhase } from '@/lib/vision/analyzePlan';

/* What the person sees while their plan is read: the plan itself, so a wrong
   page is noticed at once, and the two things that are really happening. The
   ring that stood here showed a percentage worked out from the clock, not
   from the reading. */

/** When a quiet "carry on without the plan" is first offered. A read usually takes 5 to 20 s. */
const OFFER_OTHER_WAY_AFTER_S = 25;
/** When the wait is long enough that the other way becomes the main offer. */
const LONG_WAIT_S = 75;

export default function AnalysisProgress({ onCancel, retrying = false, phase = 'preparing', planImageUrl = null, fileName }: {
  onCancel: () => void;
  retrying?: boolean;
  phase?: AnalysisPhase;
  /** A picture of the plan being read, once there is one. */
  planImageUrl?: string | null;
  fileName?: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  const preparing = phase === 'preparing';
  const longWait = elapsed >= LONG_WAIT_S;

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const stages = [
    { id: 'prepare', label: 'Getting your file ready', done: !preparing, active: preparing },
    { id: 'read', label: retrying ? 'Reading the rooms and sizes again' : 'Reading the rooms and sizes', done: false, active: !preparing },
  ];

  return (
    <div className="analysis-progress">
      <Card className="progress-card">
        <div className="plan-preview" aria-hidden="true">
          {planImageUrl
            // The person's own file, from a blob URL: next/image has nothing to optimise.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={planImageUrl} alt="" />
            : <span className="plan-placeholder"><FilePdf size={40} weight="light" /></span>}
          <span className="scan-sweep" />
        </div>
        {fileName && <p className="file-name">{fileName}</p>}

        <h1 tabIndex={-1}>{preparing ? 'Preparing your plan' : 'Reading your plan'}</h1>

        <ol className="stages">
          {stages.map((stage) => (
            <li key={stage.id} className={stage.done ? 'done' : stage.active ? 'active' : ''}>
              <span className="marker" aria-hidden="true">{stage.done ? <Check size={12} weight="bold" /> : null}</span>
              {stage.label}
            </li>
          ))}
        </ol>

        <p className="time-note" role="status">
          {longWait
            ? 'This is taking much longer than usual.'
            : elapsed >= 45
              ? 'Detailed plans can take up to a minute. Still working.'
              : `Usually 5 to 20 seconds. ${Math.floor(elapsed)}s so far.`}
        </p>

        {retrying && (
          <p className="retry-note" role="status">
            The plan reader was busy, so we&apos;re trying again. This can take up to a minute.
          </p>
        )}

        <div className="choices">
          {longWait && <Link href="/boq/new?method=manual" className="manual-button" onClick={onCancel}>Type the floor area instead</Link>}
          <button type="button" className="cancel-button" onClick={onCancel}>{longWait ? 'Stop and choose what to do' : 'Stop reading'}</button>
          {!longWait && elapsed >= OFFER_OTHER_WAY_AFTER_S && (
            <p className="other-way">Stopping keeps your file. You can then read it again, mark the rooms yourself or type the floor area.</p>
          )}
        </div>
      </Card>

      <style jsx>{`
        .analysis-progress {
          max-width: 520px;
          margin: 0 auto;
          padding: var(--spacing-md) 0 var(--spacing-xl);
        }

        .analysis-progress :global(.progress-card) {
          text-align: center;
        }

        .plan-preview {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 220px;
          margin-bottom: 12px;
          overflow: hidden;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-mist);
        }

        .plan-preview img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .plan-placeholder {
          color: var(--color-text-muted);
        }

        /* A soft band passing down the plan: it says "being read", nothing more. */
        .scan-sweep {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 36%;
          background: linear-gradient(180deg, rgba(46, 108, 246, 0), rgba(46, 108, 246, 0.16) 80%, rgba(46, 108, 246, 0.45));
          border-bottom: 2px solid var(--color-accent);
          transform: translateY(-100%);
          animation: sweep 2.4s ease-in-out infinite;
          will-change: transform;
        }

        @keyframes sweep {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(280%); }
        }

        .file-name {
          margin: 0 0 var(--spacing-md);
          overflow: hidden;
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        h1 {
          margin: 0 0 var(--spacing-md);
          color: var(--color-text);
          font-size: 1.25rem;
          font-weight: 600;
          outline: none;
        }

        .stages {
          display: grid;
          gap: 10px;
          max-width: 320px;
          margin: 0 auto var(--spacing-md);
          padding: 0;
          list-style: none;
          text-align: left;
        }

        .stages li {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--color-text-secondary);
          font-size: 0.9375rem;
        }

        .stages li.active {
          color: var(--color-text);
          font-weight: 600;
        }

        .marker {
          display: inline-flex;
          flex: none;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border: 2px solid var(--color-border-dark);
          border-radius: 50%;
          color: var(--color-text-inverse);
        }

        .done .marker {
          border-color: var(--color-emerald);
          background: var(--color-emerald);
        }

        .active .marker {
          border-color: var(--color-accent-muted);
          border-top-color: var(--color-accent);
          animation: turn 0.9s linear infinite;
        }

        @keyframes turn {
          to { transform: rotate(360deg); }
        }

        .time-note {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
        }

        .retry-note {
          margin: 12px 0 0;
          border-radius: 10px;
          background: #fff7e6;
          padding: 10px 12px;
          color: #8a5300;
          font-size: 0.85rem;
          line-height: 1.45;
        }

        .choices {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          margin-top: var(--spacing-lg);
        }

        .analysis-progress :global(.manual-button) {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          padding: 0 18px;
          border-radius: var(--radius-md);
          background: var(--color-accent);
          color: white;
          font-size: 0.9375rem;
          font-weight: 600;
          text-decoration: none;
        }

        .cancel-button {
          min-height: 44px;
          padding: 0 16px;
          border: 1px solid var(--color-border-dark);
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--color-slate-light);
          font: inherit;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
        }

        .cancel-button:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .cancel-button:focus-visible,
        .analysis-progress :global(.manual-button:focus-visible) {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .other-way {
          max-width: 360px;
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          line-height: 1.45;
        }

        @media (prefers-reduced-motion: reduce) {
          .scan-sweep {
            display: none;
          }

          .active .marker {
            animation: none;
            border-color: var(--color-accent);
          }
        }

        @media (max-width: 520px) {
          .plan-preview {
            height: 180px;
          }
        }
      `}</style>
    </div>
  );
}
