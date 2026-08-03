'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Download,
  FloppyDisk,
  Lock,
  Plus,
  ToggleLeft,
  ToggleRight,
  Warning,
} from '@phosphor-icons/react';
import { groupByCategory, calculateGrandTotal, calculateLaborItems } from '@/lib/quick-projects/engine/boqEngine';
import type { BOQItem, LaborConfig, ProjectType } from '@/lib/quick-projects/engine/types';
import LaborSection from './LaborSection';
import ContractorMarkup from './ContractorMarkup';
import { useAuth } from '@/components/providers/AuthProvider';
import { persistQuickBOQSession } from '@/lib/services/quickBoq';
import FindContractorCTA from '@/components/contractors/FindContractorCTA';
import ContactSupportLink from '@/components/support/ContactSupportLink';

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuickBOQTableProps {
  projectType: ProjectType;
  initialItems: BOQItem[];
  labor: LaborConfig;
  onLaborChange: (l: LaborConfig) => void;
  isContractor?: boolean;
  onSave?: (items: BOQItem[]) => void;
}

// ─── Currency formatter ───────────────────────────────────────────────────────

function fmt(amount: number, currency: 'USD' | 'ZWG', zwgRate: number): string {
  const val = currency === 'ZWG' ? amount * zwgRate : amount;
  const sym = currency === 'ZWG' ? 'ZiG' : '$';
  return `${sym} ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function QuickBOQTable({
  projectType,
  initialItems,
  labor,
  onLaborChange,
  isContractor = false,
  onSave,
}: QuickBOQTableProps) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<BOQItem[]>(initialItems);
  const [markupPct, setMarkupPct] = useState(0);
  const [currency] = useState<'USD' | 'ZWG'>('USD');
  const [clientView, setClientView] = useState(false);
  const zwgRate = 27;

  // ── Mutations ────────────────────────────────────────────────────────────
  const toggleItem = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, included: !i.included } : i)));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: qty, totalCostUsd: qty * i.unitCostUsd } : i)),
    );
  }, []);

  const updatePrice = useCallback(
    (id: string, priceDisplay: number) => {
      const priceUsd = currency === 'ZWG' ? priceDisplay / zwgRate : priceDisplay;
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, unitCostUsd: priceUsd, totalCostUsd: i.quantity * priceUsd } : i)),
      );
    },
    [currency, zwgRate],
  );

  const addCustomItem = useCallback((category: string) => {
    const id = `custom-${category}-${Date.now()}`;
    setItems((prev) => [
      ...prev,
      {
        id,
        category,
        description: 'Custom item',
        quantity: 1,
        unit: 'each',
        unitCostUsd: 0,
        totalCostUsd: 0,
        included: true,
        owned: false,
        optional: true,
      },
    ]);
  }, []);

  // ── Labor items ────────────────────────────────────────────────────────
  // Basis for the labour percentage: excludes optional extras such as plant
  // hire, which should not attract a builder's percentage.
  const materialsTotal = useMemo(
    () =>
      items
        .filter((i) => i.included && !i.owned && !i.optional)
        .reduce((s, i) => s + i.totalCostUsd, 0),
    [items],
  );

  // Everything the grand total actually counts. calculateGrandTotal keeps
  // optional items in, so showing materialsTotal as "Materials" made the
  // labour breakdown disagree with the Grand Total by the value of those
  // extras — $1,230 + $307.50 displayed against a $1,687.50 total.
  const materialsSubtotal = useMemo(
    () =>
      items
        .filter((i) => i.included && !i.owned)
        .reduce((s, i) => s + i.totalCostUsd, 0),
    [items],
  );
  const laborItems = useMemo(() => calculateLaborItems(labor, materialsTotal), [labor, materialsTotal]);
  const allItems = useMemo(() => [...items, ...laborItems], [items, laborItems]);

  // ── Totals ─────────────────────────────────────────────────────────────
  const totals = useMemo(
    () => calculateGrandTotal(allItems, markupPct, currency, zwgRate),
    [allItems, markupPct, currency, zwgRate],
  );
  const grouped = useMemo(() => groupByCategory(allItems), [allItems]);

  // ── Auth gate ──────────────────────────────────────────────────────────
  function handleAuthGatedAction(action: 'save' | 'pdf') {
    if (!isAuthenticated) {
      persistQuickBOQSession({
        projectType,
        answers: {},
        boqItems: items,
        labor,
        markupPct,
        currency,
      });
      window.location.href = `/auth/login?redirect=/quick-projects/${projectType}`;
      return;
    }
    if (action === 'save' && onSave) onSave(items);
    if (action === 'pdf') window.print();
  }

  // ── Client view (contractor feature) ───────────────────────────────────
  if (isContractor && clientView) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Project Cost Summary</h2>
          <button
            onClick={() => setClientView(false)}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Back to full BOQ
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="min-w-full text-sm">
            <tbody>
              {Object.entries(grouped).map(([cat, catItems]) => {
                const catTotal = catItems
                  .filter((i) => i.included && !i.owned)
                  .reduce((s, i) => s + i.totalCostUsd, 0);
                if (!catTotal) return null;
                return (
                  <tr key={cat} className="border-t border-slate-100 first:border-t-0">
                    <td className="px-4 py-3 font-medium text-slate-700">{cat}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {fmt(catTotal, currency, zwgRate)}
                    </td>
                  </tr>
                );
              })}
              {markupPct > 0 && (
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">Contractor markup ({markupPct}%)</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {fmt(totals.markupUsd, currency, zwgRate)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <p className="text-xs uppercase tracking-wider text-slate-400">Grand Total</p>
          <p className="text-2xl font-bold">
            {fmt(totals.grandTotalUsd, currency, zwgRate)}
          </p>
        </div>
      </div>
    );
  }

  // ── Full BOQ view ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 className="text-xl font-bold text-slate-900">Bill of Quantities</h2>
        <div className="flex items-center gap-2">

          {isContractor && (
            <button
              onClick={() => setClientView(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Client view
            </button>
          )}

          <button
            onClick={() => handleAuthGatedAction('pdf')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {!isAuthenticated && <Lock size={12} />}
            <Download size={14} />
            PDF
          </button>

          <button
            onClick={() => handleAuthGatedAction('save')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            {!isAuthenticated && <Lock size={12} />}
            <FloppyDisk size={14} />
            Save BOQ
          </button>
        </div>
      </div>

      {/* ── Owned items notice ──────────────────────────────────────────── */}
      {items.some((i) => i.owned) && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <Warning size={16} className="flex-shrink-0" />
          Items you already own are shown but excluded from the total cost.
        </div>
      )}

      {/* ── Flat item list ──────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Description</th>
                <th className="px-4 py-2.5 text-left w-24">Qty</th>
                <th className="px-4 py-2.5 text-left">Unit</th>
                <th className="px-4 py-2.5 text-left w-28">Unit Price</th>
                <th className="px-4 py-2.5 text-left">Line Total</th>
                <th className="px-4 py-2.5 text-center w-12" />
              </tr>
            </thead>
            <tbody>
              {allItems.map((item) => {
                const dimmed = item.owned || !item.included;
                const displayUnit =
                  currency === 'ZWG' ? item.unitCostUsd * zwgRate : item.unitCostUsd;
                const lineTotal = item.totalCostUsd;

                return (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 ${dimmed ? 'opacity-40' : ''}`}
                  >
                    {/* Description */}
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-800">{item.description}</span>
                        {item.brand && (
                          <span className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                            {item.brand}
                          </span>
                        )}
                        {item.owned && (
                          <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            Owned
                          </span>
                        )}
                        {item.optional && (
                          <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                            Optional
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="mt-0.5 text-[11px] text-slate-400">{item.notes}</p>
                      )}
                    </td>

                    {/* Qty */}
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={item.quantity}
                        min={0}
                        step={0.01}
                        disabled={dimmed}
                        onChange={(e) =>
                          updateQty(item.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-2.5 text-slate-600">{item.unit}</td>

                    {/* Unit price */}
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={parseFloat(displayUnit.toFixed(2))}
                        min={0}
                        step={0.01}
                        disabled={dimmed}
                        onChange={(e) =>
                          updatePrice(item.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                      />
                    </td>

                    {/* Line total */}
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {dimmed ? '\u2014' : fmt(lineTotal, currency, zwgRate)}
                    </td>

                    {/* Toggle */}
                    <td className="px-4 py-2.5 text-center">
                      {!item.owned && (
                        <button
                          type="button"
                          title={item.included ? 'Remove from BOQ' : 'Add to BOQ'}
                          onClick={() => toggleItem(item.id)}
                          className="p-1 rounded hover:bg-slate-100 transition-colors"
                        >
                          {item.included ? (
                            <ToggleRight
                              size={22}
                              weight="fill"
                              className="text-green-500"
                            />
                          ) : (
                            <ToggleLeft size={22} className="text-slate-400" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Add custom item */}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={() => addCustomItem('Custom')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Plus size={12} /> Add Item
            </button>
          </div>
        </div>
      </div>

      {/* ── Labor section ──────────────────────────────────────────────── */}
      <LaborSection
        labor={labor}
        materialsTotal={materialsTotal}
        materialsSubtotal={materialsSubtotal}
        onChange={onLaborChange}
        currency={currency}
        zwgRate={zwgRate}
      />

      {/* ── Contractor markup ──────────────────────────────────────────── */}
      {isContractor && (
        <ContractorMarkup
          markupPct={markupPct}
          subtotalUsd={totals.subtotalUsd}
          currency={currency}
          zwgRate={zwgRate}
          onChange={setMarkupPct}
        />
      )}

      {/* ── Grand Total (dark box — matching manual builder) ──────────── */}
      <div className="rounded-xl border border-slate-200 bg-slate-900 px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Grand Total</p>
            <p className="text-2xl font-bold mt-0.5">
              {fmt(totals.grandTotalUsd, currency, zwgRate)}
            </p>
          </div>
          {markupPct > 0 && (
            <div className="text-right text-sm">
              <p className="text-slate-400">
                Materials: {fmt(totals.subtotalUsd - totals.markupUsd, currency, zwgRate)}
              </p>
              <p className="text-slate-400">
                Markup ({markupPct}%): {fmt(totals.markupUsd, currency, zwgRate)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Next step ──────────────────────────────────────────────────── */}
      <FindContractorCTA projectType={projectType} />

      {/* ── Disclaimer ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 leading-relaxed">
        <p className="font-medium text-slate-600 mb-1">Disclaimer</p>
        <p>
          This estimate is based on typical Zimbabwe market rates and may vary based on
          site-specific conditions, ground composition, and material availability. Final
          costs are subject to a professional site assessment and hydrogeologist&apos;s
          report. Prices are indicative as of Q1 2026 and subject to change.
        </p>
        {/* Users spot bad prices before we do — a face brick was priced per
            thousand against a per-brick count for a long time before anyone
            noticed. This makes reporting one a single click. */}
        <p className="mt-2">
          Spotted a price that looks wrong?{' '}
          <ContactSupportLink category="bug" subject="Price looks wrong" showIcon={false}>
            Tell us
          </ContactSupportLink>
        </p>
      </div>
    </div>
  );
}
