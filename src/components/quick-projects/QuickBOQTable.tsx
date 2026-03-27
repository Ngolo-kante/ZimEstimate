'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Download,
  FloppyDisk,
  Lock,
  Minus,
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuickBOQTableProps {
  projectType: ProjectType;
  initialItems: BOQItem[];
  labor: LaborConfig;
  onLaborChange: (l: LaborConfig) => void;
  isContractor?: boolean;
  onSave?: (items: BOQItem[]) => void;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function BOQRow({
  item,
  currency,
  zwgRate,
  onToggle,
  onQtyChange,
  onPriceChange,
}: {
  item: BOQItem;
  currency: 'USD' | 'ZWG';
  zwgRate: number;
  onToggle: (id: string) => void;
  onQtyChange: (id: string, qty: number) => void;
  onPriceChange: (id: string, price: number) => void;
}) {
  const displayQty = item.quantity;
  const displayUnit = currency === 'ZWG' ? item.unitCostUsd * zwgRate : item.unitCostUsd;
  const displayTotal = currency === 'ZWG' ? item.totalCostUsd * zwgRate : item.totalCostUsd;
  const sym = currency === 'ZWG' ? 'ZWG' : '$';
  const dimmed = item.owned || !item.included;

  return (
    <tr className={`boq-row ${dimmed ? 'boq-row--dimmed' : ''} ${item.owned ? 'boq-row--owned' : ''}`}>
      <td className="boq-cell boq-cell--desc">
        <div className="boq-desc">
          {item.description}
          {item.brand && <span className="boq-brand-tag">{item.brand}</span>}
          {item.owned && <span className="boq-owned-tag">Owned</span>}
          {item.optional && <span className="boq-optional-tag">Optional</span>}
          {item.notes && <span className="boq-notes">{item.notes}</span>}
        </div>
      </td>
      <td className="boq-cell boq-cell--qty">
        <input
          type="number"
          className="boq-qty-input"
          value={displayQty}
          min={0}
          step={0.01}
          disabled={dimmed}
          onChange={(e) => onQtyChange(item.id, parseFloat(e.target.value) || 0)}
        />
        <span className="boq-unit">{item.unit}</span>
      </td>
      <td className="boq-cell boq-cell--price">
        <input
          type="number"
          className="boq-price-input"
          value={parseFloat(displayUnit.toFixed(2))}
          min={0}
          step={0.01}
          disabled={dimmed}
          onChange={(e) => onPriceChange(item.id, parseFloat(e.target.value) || 0)}
        />
        <span className="boq-sym">{sym}</span>
      </td>
      <td className="boq-cell boq-cell--total">
        {dimmed ? '—' : `${sym} ${displayTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </td>
      <td className="boq-cell boq-cell--toggle">
        {!item.owned && (
          <button
            type="button"
            className="boq-toggle-btn"
            title={item.included ? 'Remove from BOQ' : 'Add to BOQ'}
            onClick={() => onToggle(item.id)}
          >
            {item.included
              ? <ToggleRight size={22} weight="fill" className="text-green-500" />
              : <ToggleLeft size={22} className="text-gray-400" />
            }
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────

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
  const [currency, setCurrency] = useState<'USD' | 'ZWG'>('USD');
  const [clientView, setClientView] = useState(false);
  const zwgRate = 27; // TODO: pull from Supabase settings

  // ── Mutations ────────────────────────────────────────────────────────────
  const toggleItem = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, included: !i.included } : i));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: qty, totalCostUsd: qty * i.unitCostUsd } : i));
  }, []);

  const updatePrice = useCallback((id: string, priceDisplay: number) => {
    const priceUsd = currency === 'ZWG' ? priceDisplay / zwgRate : priceDisplay;
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, unitCostUsd: priceUsd, totalCostUsd: i.quantity * priceUsd } : i));
  }, [currency, zwgRate]);

  // ── Labor items ──────────────────────────────────────────────────────────
  const materialsTotal = useMemo(() =>
    items.filter((i) => i.included && !i.owned && !i.optional).reduce((s, i) => s + i.totalCostUsd, 0),
    [items]
  );
  const laborItems = useMemo(() => calculateLaborItems(labor, materialsTotal), [labor, materialsTotal]);

  const allItems = useMemo(() => [...items, ...laborItems], [items, laborItems]);

  // ── Totals ───────────────────────────────────────────────────────────────
  const totals = useMemo(
    () => calculateGrandTotal(allItems, markupPct, currency, zwgRate),
    [allItems, markupPct, currency, zwgRate]
  );

  const grouped = useMemo(() => groupByCategory(allItems), [allItems]);
  const sym = currency === 'ZWG' ? 'ZWG' : '$';

  // ── Auth gate ────────────────────────────────────────────────────────────
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
    if (action === 'pdf') window.print(); // basic fallback
  }

  // ── Client view (contractor feature) ────────────────────────────────────
  if (isContractor && clientView) {
    return (
      <div className="boq-client-view">
        <div className="boq-client-view__header">
          <h2>Project Cost Summary</h2>
          <button className="boq-back-btn" onClick={() => setClientView(false)}>Back to full BOQ</button>
        </div>
        <table className="boq-client-table">
          <tbody>
            {Object.entries(grouped).map(([cat, catItems]) => {
              const catTotal = catItems.filter((i) => i.included && !i.owned).reduce((s, i) => s + i.totalCostUsd, 0);
              if (!catTotal) return null;
              return (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td className="boq-cell--total">{sym} {(currency === 'ZWG' ? catTotal * zwgRate : catTotal).toLocaleString()}</td>
                </tr>
              );
            })}
            {markupPct > 0 && (
              <tr className="boq-markup-row">
                <td>Contractor markup ({markupPct}%)</td>
                <td>{sym} {(currency === 'ZWG' ? totals.markupUsd * zwgRate : totals.markupUsd).toLocaleString()}</td>
              </tr>
            )}
            <tr className="boq-grand-total-row">
              <td><strong>Total</strong></td>
              <td><strong>{sym} {totals.grandTotalDisplay.toLocaleString()}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="boq-table-wrapper">
      {/* Header actions */}
      <div className="boq-header">
        <h2 className="boq-title">Bill of Quantities</h2>
        <div className="boq-header__actions">
          {/* Currency toggle */}
          <button
            className={`currency-toggle-btn ${currency === 'ZWG' ? 'currency-toggle-btn--zwg' : ''}`}
            onClick={() => setCurrency((c) => c === 'USD' ? 'ZWG' : 'USD')}
          >
            {currency}
          </button>

          {isContractor && (
            <button className="boq-action-btn" onClick={() => setClientView(true)}>
              Client view
            </button>
          )}

          <button
            className="boq-action-btn boq-action-btn--secondary"
            onClick={() => handleAuthGatedAction('pdf')}
          >
            {!isAuthenticated && <Lock size={14} />}
            <Download size={14} />
            PDF
          </button>

          <button
            className="boq-action-btn boq-action-btn--primary"
            onClick={() => handleAuthGatedAction('save')}
          >
            {!isAuthenticated && <Lock size={14} />}
            <FloppyDisk size={14} />
            Save BOQ
          </button>
        </div>
      </div>

      {/* Warning: owned items excluded */}
      {items.some((i) => i.owned) && (
        <div className="boq-notice">
          <Warning size={14} />
          Items you already own are shown but excluded from the total cost.
        </div>
      )}

      {/* Table */}
      <div className="boq-table-scroll">
        <table className="boq-table">
          <thead>
            <tr>
              <th className="boq-th boq-th--desc">Description</th>
              <th className="boq-th boq-th--qty">Qty</th>
              <th className="boq-th boq-th--price">Unit Cost ({sym})</th>
              <th className="boq-th boq-th--total">Total ({sym})</th>
              <th className="boq-th boq-th--toggle" />
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([category, catItems]) => (
              <>
                <tr key={`cat-${category}`} className="boq-category-row">
                  <td colSpan={5}>{category}</td>
                </tr>
                {catItems.map((item) => (
                  <BOQRow
                    key={item.id}
                    item={item}
                    currency={currency}
                    zwgRate={zwgRate}
                    onToggle={toggleItem}
                    onQtyChange={updateQty}
                    onPriceChange={updatePrice}
                  />
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Labor section */}
      <LaborSection labor={labor} materialsTotal={materialsTotal} onChange={onLaborChange} currency={currency} zwgRate={zwgRate} />

      {/* Contractor markup */}
      {isContractor && (
        <ContractorMarkup markupPct={markupPct} subtotalUsd={totals.subtotalUsd} currency={currency} zwgRate={zwgRate} onChange={setMarkupPct} />
      )}

      {/* Grand total */}
      <div className="boq-totals">
        <div className="boq-totals__row">
          <span>Materials subtotal</span>
          <span>{sym} {(currency === 'ZWG' ? totals.subtotalUsd * zwgRate : totals.subtotalUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        {markupPct > 0 && (
          <div className="boq-totals__row">
            <span>Markup ({markupPct}%)</span>
            <span>{sym} {(currency === 'ZWG' ? totals.markupUsd * zwgRate : totals.markupUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="boq-totals__row boq-totals__row--grand">
          <span>Grand Total</span>
          <strong>{sym} {totals.grandTotalDisplay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>
    </div>
  );
}
