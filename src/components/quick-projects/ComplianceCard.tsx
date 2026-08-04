'use client';

// ─── Compliance for a quick project ───────────────────────────────────────────
// "Compliance still applies for quick projects but stages are not applicable."
//
// The house checklist is keyed by build stage. A borehole has no stages — it has
// a drilling permit and a groundwater registration that apply to the whole job.
// This renders the type-keyed catalogue and lets the user mark where each one is.

import { useMemo } from 'react';
import { ShieldCheck, CaretDown } from '@phosphor-icons/react';
import {
  getQuickComplianceRequirements,
  getComplianceProgress,
  COMPLIANCE_STATUS_LABELS,
  type ComplianceStatus,
} from '@/lib/quick-projects/compliance';

interface ComplianceCardProps {
  projectType: string;
  answers: Record<string, unknown>;
  statuses: Record<string, ComplianceStatus>;
  onChange: (id: string, status: ComplianceStatus) => void;
}

const STATUSES: ComplianceStatus[] = ['not_started', 'in_progress', 'done', 'not_applicable'];

export default function ComplianceCard({
  projectType,
  answers,
  statuses,
  onChange,
}: ComplianceCardProps) {
  const requirements = useMemo(
    () => getQuickComplianceRequirements(projectType, answers),
    [projectType, answers],
  );
  const progress = useMemo(
    () => getComplianceProgress(requirements, statuses),
    [requirements, statuses],
  );

  // Nothing to show beats an empty card claiming everything is fine.
  if (requirements.length === 0) return null;

  return (
    <section className="comp-card">
      <header className="comp-head">
        <h2><ShieldCheck size={18} weight="duotone" /> Compliance</h2>
        <span className={`pill ${progress.clear ? 'clear' : ''}`}>
          {progress.requiredDone}/{progress.requiredTotal} required
        </span>
      </header>

      <ul className="reqs">
        {requirements.map((req) => {
          const status = statuses[req.id] ?? 'not_started';
          return (
            <li key={req.id} className={`req ${status === 'done' ? 'is-done' : ''}`}>
              <div className="req-text">
                <span className="req-label">
                  {req.label}
                  {!req.required && <em className="advisory">recommended</em>}
                </span>
                <span className="req-auth">{req.authority}</span>
                <span className="req-desc">{req.description}</span>
              </div>
              <div className="select-wrap">
                <select
                  value={status}
                  aria-label={`Status for ${req.label}`}
                  onChange={(e) => onChange(req.id, e.target.value as ComplianceStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{COMPLIANCE_STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <CaretDown size={12} weight="bold" />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Said plainly rather than buried in a tooltip. These lists change, and a
          checklist that looks authoritative is worse than one that admits it
          needs checking. */}
      <p className="disclaimer">
        A starting checklist, not legal advice — confirm current requirements with the
        authority before you rely on this.
      </p>

      <style jsx>{`
        .comp-card {
          border: 1px solid var(--color-border); border-radius: 12px;
          background: var(--color-surface); padding: 20px; margin-bottom: 16px;
        }
        .comp-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .comp-head h2 {
          display: inline-flex; align-items: center; gap: 8px; margin: 0;
          font-size: 1rem; font-weight: 700; color: var(--color-text);
        }
        .pill {
          padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700;
          background: var(--color-background); color: var(--color-text-secondary);
        }
        .pill.clear { background: var(--color-success-muted, #dcfce7); color: var(--color-success); }

        .reqs { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
        .req {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          padding-bottom: 12px; border-bottom: 1px solid var(--color-border);
          flex-wrap: wrap;
        }
        .req:last-child { border-bottom: none; padding-bottom: 0; }
        .req.is-done .req-label { text-decoration: line-through; color: var(--color-text-muted); }
        .req-text { display: grid; gap: 3px; min-width: 0; flex: 1 1 240px; }
        .req-label { font-size: 0.9rem; font-weight: 600; color: var(--color-text); }
        .advisory {
          margin-left: 8px; padding: 1px 7px; border-radius: 999px; font-style: normal;
          font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
          background: var(--color-background); color: var(--color-text-muted);
        }
        .req-auth { font-size: 0.75rem; font-weight: 600; color: var(--color-accent); }
        .req-desc { font-size: 0.8rem; color: var(--color-text-secondary); }

        .select-wrap { position: relative; display: inline-flex; align-items: center; flex: 0 0 auto; }
        .select-wrap :global(svg) { position: absolute; right: 10px; pointer-events: none; color: var(--color-text-muted); }
        .select-wrap select {
          appearance: none; padding: 7px 28px 7px 11px; border-radius: 8px; cursor: pointer;
          border: 1px solid var(--color-border); background: var(--color-surface);
          color: var(--color-text); font-weight: 600;
          /* iOS zooms the page when a focused control is under 16px. */
          font-size: max(0.8rem, 16px);
        }

        .disclaimer {
          margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--color-border);
          font-size: 0.75rem; color: var(--color-text-muted);
        }

        @media (max-width: 520px) {
          .select-wrap, .select-wrap select { width: 100%; }
        }
      `}</style>
    </section>
  );
}
