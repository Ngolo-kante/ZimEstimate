'use client';

// "Why?" under an estimate line: the calculator's own note at once, then a
// plain-words explanation (/api/explain-line) built from this estimate's
// numbers. The note is shown first and on its own because it needs no
// network and is exactly what was calculated; the explanation is labelled
// as written by AI from those numbers.

import { useEffect, useState } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import { useBoqWizardStore, type BOQItem } from '@/store/boqWizardStore';
import { captureProductEvent } from '@/lib/productAnalytics';
import type { LineExplanation } from '@/lib/explain/explainLine';

/* Kept for the visit, so reopening a line does not ask again. */
const explained = new Map<string, LineExplanation>();

const stripTag = (note?: string) => note?.replace(/\[Enablement Cost\]\s*/g, '').trim() || '';

export function LineWhyButton({ open, onToggle, name }: { open: boolean; onToggle: () => void; name: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'Show'} why ${name} is on this estimate`}
      className={`mt-0.5 inline-flex items-center rounded px-1 text-[11px] font-bold transition ${
        open ? 'text-[var(--color-text)]' : 'text-[var(--color-accent)] hover:underline'
      }`}
    >
      {open ? 'Hide why' : 'Why?'}
    </button>
  );
}

export function LineWhyPanel({ item, stage }: { item: BOQItem; stage: string }) {
  const projectDetails = useBoqWizardStore((s) => s.projectDetails);
  const selectedStages = useBoqWizardStore((s) => s.selectedStages);
  const key = [item.materialId, item.quantity, item.actualPriceUsd, stage].join('|');
  const [explanation, setExplanation] = useState<LineExplanation | null>(() => explained.get(key) ?? null);
  const [failed, setFailed] = useState(false);
  const note = stripTag(item.description);

  useEffect(() => {
    if (explained.has(key)) { setExplanation(explained.get(key)!); return; }
    let cancelled = false;
    setExplanation(null); setFailed(false);
    void (async () => {
      try {
        const response = await fetch('/api/explain-line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line: {
              materialId: item.materialId,
              materialName: item.materialName,
              quantity: item.quantity ?? 0,
              unit: item.unit,
              unitPriceUsd: item.actualPriceUsd,
              stage,
              note,
              calculatedQuantity: item.calculatedQuantity,
            },
            project: {
              floorAreaM2: Number(projectDetails.floorPlanSize) || undefined,
              wallHeightM: Number(projectDetails.wallHeight) || undefined,
              locationType: projectDetails.locationType || undefined,
              finishLevel: projectDetails.finishLevel && projectDetails.finishLevel !== 'not_sure' ? projectDetails.finishLevel : undefined,
              brickType: projectDetails.brickTypes?.[0],
              stages: selectedStages,
            },
          }),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        explained.set(key, result.data);
        if (!cancelled) setExplanation(result.data);
        captureProductEvent('ai_scan_used', { tool: 'explain_line', outcome: 'success', stage });
      } catch {
        if (!cancelled) setFailed(true);
        captureProductEvent('ai_scan_used', { tool: 'explain_line', outcome: 'failed', stage });
      }
    })();
    return () => { cancelled = true; };
    // The line's identity is the key; the rest is read when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-background)] px-3 py-2.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
      {note && (
        <p>
          <span className="font-bold text-[var(--color-text)]">Worked out from: </span>
          {note}
        </p>
      )}
      {explanation ? (
        <div className={note ? 'mt-2' : ''}>
          <p className="text-[var(--color-text)]">{explanation.why}</p>
          {explanation.onSite && <p className="mt-1.5">{explanation.onSite}</p>}
          {explanation.changesIt.length > 0 && (
            <p className="mt-1.5">
              <span className="font-bold text-[var(--color-text)]">Changes if you change: </span>
              {explanation.changesIt.join(' · ')}
            </p>
          )}
          <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">Written by AI from this estimate&rsquo;s own numbers.</p>
        </div>
      ) : failed ? (
        <p className={note ? 'mt-2' : ''}>A fuller explanation is not available right now.</p>
      ) : (
        <p className={`inline-flex items-center gap-1.5 ${note ? 'mt-2' : ''}`}>
          <CircleNotch size={12} weight="bold" className="animate-spin" /> Explaining…
        </p>
      )}
    </div>
  );
}
