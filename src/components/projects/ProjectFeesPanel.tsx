'use client';

import { useEffect, useState } from 'react';
import type { BOQItem } from '@/lib/database.types';
import { OWN_FIGURE_NOTE } from '@/lib/projectFees';

const dollars = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function FeeRow({ item, onUpdate }: { item: BOQItem; onUpdate: (id: string, updates: Partial<BOQItem>) => Promise<void> }) {
  const [amount, setAmount] = useState(String(item.unit_price_usd));
  const [saving, setSaving] = useState(false);
  useEffect(() => setAmount(String(item.unit_price_usd)), [item.unit_price_usd]);

  const save = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setAmount(String(item.unit_price_usd));
      return;
    }
    if (parsed === Number(item.unit_price_usd)) return;
    setSaving(true);
    try {
      // The note tells the BOQ builder this is the user's figure, not the tariff's.
      await onUpdate(item.id, { unit_price_usd: parsed, unit_price_zwg: parsed * 30, notes: OWN_FIGURE_NOTE });
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="flex flex-col gap-2 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--color-text)]">{item.material_name}</span>
        {item.notes && <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-secondary)]">{item.notes}</span>}
        {Number(item.quantity) > 1 && <span className="mt-0.5 block text-xs font-semibold text-[var(--color-text-secondary)]">{Number(item.quantity)} {item.unit}s · {dollars(Number(item.quantity) * Number(item.unit_price_usd))}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 focus-within:border-[var(--color-accent)]">
        <span className="text-sm text-[var(--color-text-secondary)]">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          aria-label={`${item.material_name} cost in USD`}
          value={amount}
          disabled={saving}
          onChange={(event) => setAmount(event.target.value)}
          onBlur={() => void save()}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          className="w-28 bg-transparent py-2 text-right text-sm font-semibold text-[var(--color-text)] outline-none disabled:opacity-50"
        />
        {Number(item.quantity) > 1 && <span className="text-xs text-[var(--color-text-secondary)]">/{item.unit}</span>}
      </span>
    </label>
  );
}

export default function ProjectFeesPanel({ items, onUpdate }: { items: BOQItem[]; onUpdate: (id: string, updates: Partial<BOQItem>) => Promise<void> }) {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price_usd), 0);
  const unpriced = items.filter((item) => Number(item.unit_price_usd) <= 0).length;

  return (
    <section aria-labelledby="saved-project-fees-title" className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="saved-project-fees-title" className="text-lg font-bold text-[var(--color-text)]">Professional & council fees</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Drawings, plan approval, inspections and certificate. Replace any line with the figure you are quoted.</p>
        </div>
        <strong className="text-lg text-[var(--color-text)]">{dollars(total)}</strong>
      </div>
      {unpriced > 0 && <p className="mt-3 text-sm text-[var(--color-warning-fg)]">{unpriced} fee {unpriced === 1 ? 'line is' : 'lines are'} unpriced. Confirm which charges apply locally before relying on the total.</p>}
      <div className="mt-4 grid gap-2">
        {items.map((item) => <FeeRow key={item.id} item={item} onUpdate={onUpdate} />)}
      </div>
    </section>
  );
}
