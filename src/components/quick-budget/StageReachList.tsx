'use client';

// How far the budget goes, stage by stage.
//
// One list rather than five tinted cards: each stage is a row with a status
// mark, what it includes, its cost and how much of it the budget covers. A
// row opens to show the stage's main materials, so "Roofing $2,175" can be
// checked against what is in it without generating the whole BOQ. Rows
// start closed — the list is a summary first — except the stage the money
// runs out in, which is the one people want to look at.

import { useState } from 'react';
import { CaretDown, CheckCircle, Circle, CircleHalf } from '@phosphor-icons/react';
import type { StageReachRow } from '@/lib/estimators/stageBudgetEstimator';

export interface StageLine {
  category: string;
  materialName: string;
  quantity: number;
  unit: string;
  totalUsd: number;
}

/** What each stage covers, in a phrase — from what the calculator puts in it. */
const STAGE_SUMMARY: Record<string, string> = {
  substructure: 'Hardcore, foundation concrete and walls, DPC and slab mesh',
  superstructure: 'Wall bricks and mortar, brickforce and ring-beam steel',
  roofing: 'IBR sheets, roof timber, screws and fascia',
  finishing: 'Plaster, paint, tiles, ceiling, doors, windows, wiring and plumbing',
  exterior: 'Boundary wall, gates and paving',
};

const SHOWN_LINES = 6;

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const qty = (n: number) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 });
/** "per 50kg bag" → "bags", "per cube" → "cubes", "each" → "" — as people say them. */
function unitLabel(unit: string, quantity: number): string {
  const base = unit.replace(/^per\s+/i, '').replace(/^\d+\s*kg\s+/i, '').trim();
  if (/^each$/i.test(base)) return '';
  if (Math.abs(quantity - 1) < 1e-9 || /m²|m³|m$|kg$|l$/i.test(base)) return base;
  return /(bag|cube|roll|sheet|length|litre|trip|day|lot)$/i.test(base) ? `${base}s` : base;
}

export default function StageReachList({ rows, lines }: { rows: StageReachRow[]; lines: StageLine[] }) {
  const firstShort = rows.find((row) => !row.affordable)?.id ?? null;
  const [open, setOpen] = useState<Set<string>>(() => new Set(firstShort ? [firstShort] : []));

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <ol className="stages">
      {rows.map((row) => {
        const pct = Math.max(0, Math.min(100, Math.round(row.coveragePercent)));
        const state = row.affordable ? 'covered' : pct > 0 ? 'partial' : 'short';
        const stageLines = lines
          .filter((line) => line.category === row.id && line.totalUsd > 0)
          .sort((a, b) => b.totalUsd - a.totalUsd);
        const isOpen = open.has(row.id);
        const panelId = `stage-panel-${row.id}`;

        return (
          <li key={row.id} className={`stage ${state}`}>
            <button type="button" className="head" onClick={() => toggle(row.id)} aria-expanded={isOpen} aria-controls={panelId}>
              <span className="mark" aria-hidden="true">
                {state === 'covered' ? <CheckCircle size={20} weight="fill" /> : state === 'partial' ? <CircleHalf size={20} weight="fill" /> : <Circle size={20} />}
              </span>
              <span className="copy">
                <span className="name">{row.label}</span>
                <span className="summary">{STAGE_SUMMARY[row.id] ?? ''}</span>
              </span>
              <span className="figures">
                <span className="cost">{usd(row.stageCostUsd)}</span>
                <span className={`pill ${state}`}>
                  {state === 'covered' ? 'Covered' : state === 'partial' ? `${pct}% covered` : 'Not covered'}
                </span>
              </span>
              <CaretDown size={16} weight="bold" className={`caret ${isOpen ? 'up' : ''}`} aria-hidden="true" />
            </button>

            {state === 'partial' && (
              <div className="track" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
            )}

            {isOpen && (
              <div className="panel" id={panelId}>
                <p className="panel-summary">{STAGE_SUMMARY[row.id] ?? ''}</p>
                {stageLines.length === 0 ? (
                  <p className="muted">No materials in this stage for this estimate.</p>
                ) : (
                  <>
                    <ul>
                      {stageLines.slice(0, SHOWN_LINES).map((line) => (
                        <li key={line.materialName}>
                          <span className="item">{line.materialName}</span>
                          <span className="amount">{qty(line.quantity)} {unitLabel(line.unit, line.quantity)}</span>
                          <span className="price">{usd(line.totalUsd)}</span>
                        </li>
                      ))}
                    </ul>
                    {stageLines.length > SHOWN_LINES && (
                      <p className="muted">+ {stageLines.length - SHOWN_LINES} more — Generate BOQ lists every line.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}

      <style jsx>{`
        .stages { list-style: none; margin: 0; padding: 0; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; overflow: hidden; }
        .stage + .stage { border-top: 1px solid #edf1f6; }
        .head {
          display: grid; grid-template-columns: 22px minmax(0, 1fr) auto 16px; align-items: center; gap: 12px;
          width: 100%; padding: 14px 16px; border: none; background: none; text-align: left; cursor: pointer; color: inherit; font: inherit;
        }
        .head:hover { background: #f8fafc; }
        .head:focus-visible { outline: 2px solid #2e6cf6; outline-offset: -2px; }
        .mark { display: inline-flex; }
        .covered .mark { color: #16a34a; }
        .partial .mark { color: #d97706; }
        .short .mark { color: #cbd5e1; }
        .copy { display: grid; gap: 2px; min-width: 0; }
        .name { font-size: 0.92rem; font-weight: 700; color: var(--color-primary); }
        .summary { font-size: 0.76rem; color: var(--color-text-muted); line-height: 1.4; }
        .figures { display: grid; justify-items: end; gap: 4px; }
        .cost { font-size: 0.95rem; font-weight: 800; color: var(--color-primary); font-variant-numeric: tabular-nums; }
        .pill { font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
        .pill.covered { color: #15803d; background: #dcfce7; }
        .pill.partial { color: #b45309; background: #fef3c7; }
        .pill.short { color: #64748b; background: #f1f5f9; }
        .short .name, .short .cost { color: #64748b; }
        :global(.caret) { color: #94a3b8; transition: transform 0.15s ease; }
        :global(.caret.up) { transform: rotate(180deg); }
        .track { height: 4px; margin: -4px 16px 12px 50px; border-radius: 999px; background: #f1f5f9; overflow: hidden; }
        .track span { display: block; height: 100%; border-radius: inherit; background: #f59e0b; }
        .panel { padding: 0 16px 14px 50px; }
        .panel-summary { display: none; }
        .panel ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
        .panel li { display: grid; grid-template-columns: minmax(0, 1fr) auto 72px; gap: 10px; font-size: 0.8rem; color: var(--color-text); }
        .item { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .amount { color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
        .price { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
        .muted { margin: 8px 0 0; font-size: 0.76rem; color: var(--color-text-muted); }
        @media (max-width: 520px) {
          .head { gap: 10px; padding: 12px; }
          .track { margin-left: 44px; margin-right: 12px; }
          .panel { padding: 0 12px 12px 44px; }
          .panel li { grid-template-columns: minmax(0, 1fr) auto; }
          /* On a phone the closed list stays one short row per stage; what a
             stage includes shows once it is opened. */
          .summary { display: none; }
          .panel-summary { display: block; margin: 0 0 8px; font-size: 0.76rem; color: var(--color-text-muted); }
          .amount { display: none; }
        }
      `}</style>
    </ol>
  );
}
