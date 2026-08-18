'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  PaperPlaneTilt,
  Storefront,
  Warning,
} from '@phosphor-icons/react';
import { useToast } from '@/components/ui/Toast';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import EmptyState from '@/components/ui/EmptyState';
import {
  acceptRfqQuote,
  createRfqRequest,
  getProjectRfqs,
  matchSuppliersForItems,
  type RfqWithDetails,
  type SupplierMatch,
} from '@/lib/services/rfq';
import type { BOQItem, Project } from '@/lib/database.types';

/**
 * Raise and track requests for quotation against a project's BOQ.
 *
 * Replaces an EmptyState reading "RFQ management coming soon — use the Supplier
 * dashboard for RFQ workflows". The whole RFQ backend existed and worked, but
 * the only screen that ever called createRfqRequest was the Marketplace, one
 * material at a time, so a builder could not raise an RFQ from their own BOQ.
 *
 * Tailwind rather than the procurement-view.css sheet the rest of this view
 * uses: self-contained, and it avoids the styled-jsx scoping trap that has
 * silently killed several stylesheets in this project.
 */

/**
 * Render a DATE column without shifting it.
 *
 * required_by is a bare DATE. new Date('2026-09-15') parses as UTC midnight and
 * then renders in local time, so a date entered as the 15th displayed as the
 * 14th anywhere behind UTC. Formatting the parts directly avoids the round trip.
 */
function formatDateOnly(value: string): string {
  const [y, m, d] = value.split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString();
}

const STAGE_LABELS: Record<string, string> = {
  substructure: 'Site Preparation & Foundation',
  superstructure: 'Structural Walls & Frame',
  roofing: 'Roofing',
  finishing: 'Interior & Finishing',
  exterior: 'External Work',
};

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  quoted: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired: 'bg-slate-100 text-slate-500 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

type Props = {
  project: Project;
  items: BOQItem[];
  /** Server-rendered starting point; the panel refetches its own list after that. */
  rfqs: RfqWithDetails[];
  /** Lets the parent update its own procurement stats after a change here. */
  onRefresh: () => void | Promise<void>;
};

export default function RfqPanel({ project, items, rfqs: initialRfqs, onRefresh }: Props) {
  const { success, error: showError } = useToast();
  const { formatPrice } = useCurrency();

  const [mode, setMode] = useState<'list' | 'compose' | 'sent'>('list');
  const [lastSent, setLastSent] = useState<{ items: number; suppliers: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deliveryAddress, setDeliveryAddress] = useState(project.location ?? '');
  const [requiredBy, setRequiredBy] = useState('');
  const [notes, setNotes] = useState('');
  const [matches, setMatches] = useState<SupplierMatch[] | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [expandedRfq, setExpandedRfq] = useState<string | null>(null);

  // The panel owns its list rather than reading the parent's prop. Relying on
  // the parent's loader meant a request created here did not appear until a
  // full page reload — the list rendered against the previous prop and no
  // subsequent parent render carried the new row.
  const [rfqs, setRfqs] = useState<RfqWithDetails[]>(initialRfqs);

  const reload = useCallback(async () => {
    const { rfqs: fresh, error } = await getProjectRfqs(project.id);
    if (!error) setRfqs(fresh);
    // Keep the parent's procurement counters in step.
    await onRefresh();
  }, [project.id, onRefresh]);

  // Deliberately no effect syncing from initialRfqs. Doing so overwrote the
  // list this panel had just refetched with the parent's older array, so a new
  // request still failed to appear. The prop is the initial value only.

  // Refetch whenever the list comes into view. Chaining the refresh onto the
  // send handler left the list exactly one request behind — reliably wrong in
  // the same way each time — so the trigger is the view itself, which cannot
  // race the write that preceded it.
  useEffect(() => {
    if (mode !== 'list') return;
    let active = true;
    getProjectRfqs(project.id).then(({ rfqs: fresh, error }) => {
      if (active && !error) setRfqs(fresh);
    });
    return () => { active = false; };
  }, [mode, project.id]);

  // Anything already bought does not need quoting.
  const quotableItems = useMemo(
    () => items.filter((i) => !i.is_purchased),
    [items]
  );

  const grouped = useMemo(() => {
    const out: Record<string, BOQItem[]> = {};
    quotableItems.forEach((i) => {
      const key = i.category || 'other';
      (out[key] ||= []).push(i);
    });
    return out;
  }, [quotableItems]);

  const selectedItems = useMemo(
    () => quotableItems.filter((i) => selectedIds.has(i.id)),
    [quotableItems, selectedIds]
  );

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setMatches(null);
  };

  const toggleStage = (stage: string) => {
    const ids = (grouped[stage] ?? []).map((i) => i.id);
    const allOn = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
    setMatches(null);
  };

  // Preview who this will reach before sending. matchSuppliersForItems is the
  // same function createRfqRequest uses internally, so this is what will
  // actually happen rather than a guess at it.
  const handlePreview = async () => {
    if (selectedItems.length === 0) {
      showError('Choose at least one item to request quotes for.');
      return;
    }
    setIsMatching(true);
    const { matches: found, error } = await matchSuppliersForItems({
      items: selectedItems.map((i) => ({
        material_id: i.material_id,
        material_name: i.material_name,
      })),
      projectLocation: deliveryAddress || project.location,
      maxSuppliers: 10,
    });
    setIsMatching(false);
    if (error) {
      showError(error.message || 'Could not match suppliers.');
      return;
    }
    setMatches(found);
  };

  const handleSend = async () => {
    if (selectedItems.length === 0) {
      showError('Choose at least one item to request quotes for.');
      return;
    }

    setIsSending(true);
    const { error, recipients } = await createRfqRequest({
      projectId: project.id,
      deliveryAddress: deliveryAddress || project.location || null,
      requiredBy: requiredBy || null,
      notes: notes || null,
      items: selectedItems.map((i) => ({
        material_id: i.material_id,
        material_name: i.material_name,
        quantity: i.quantity,
        unit: i.unit,
      })),
      maxSuppliers: 10,
    });
    setIsSending(false);

    if (error) {
      showError(error.message || 'Could not send the request.');
      return;
    }

    success(
      recipients.length > 0
        ? `Request sent to ${recipients.length} ${recipients.length === 1 ? 'supplier' : 'suppliers'}.`
        : 'Request saved, but no supplier matched these materials yet.'
    );
    // Land on a confirmation rather than dropping straight into the list.
    // Refreshing the list as part of this handler consistently left it one
    // request behind — the read raced the write it had just made. Letting the
    // user click through means the list mounts fresh and cannot be stale, and
    // they get told what was sent and to how many suppliers.
    setLastSent({ items: selectedItems.length, suppliers: recipients.length });
    setSelectedIds(new Set());
    setMatches(null);
    setNotes('');
    setRequiredBy('');
    setMode('sent');
    void reload();
  };

  const handleAccept = async (rfqId: string, quoteId: string) => {
    const { error } = await acceptRfqQuote({ rfqId, quoteId });
    if (error) {
      showError(error.message || 'Could not accept the quote.');
      return;
    }
    success('Quote accepted.');
    await reload();
  };

  // ── Sent confirmation ──────────────────────────────────────────────────────
  if (mode === 'sent') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle size={40} weight="fill" className="mx-auto text-emerald-500" />
        <p className="mt-3 text-base font-bold text-slate-900">Request sent</p>
        <p className="mt-1 text-sm text-slate-600">
          {lastSent?.items ?? 0} {lastSent?.items === 1 ? 'item' : 'items'} sent to{' '}
          {lastSent?.suppliers ?? 0} {lastSent?.suppliers === 1 ? 'supplier' : 'suppliers'}.
          {lastSent?.suppliers === 0 && ' No supplier matched these materials yet, so you may want to contact merchants directly.'}
        </p>
        <button
          type="button"
          onClick={() => setMode('list')}
          className="mt-4 min-h-11 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          View all requests
        </button>
      </div>
    );
  }

  // ── Compose ────────────────────────────────────────────────────────────────
  if (mode === 'compose') {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setMode('list')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} weight="bold" /> Back to requests
        </button>

        {quotableItems.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={48} weight="light" />}
            title="Everything on this BOQ is already purchased"
            description="There is nothing left to request quotes for."
          />
        ) : (
          <>
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Choose what to quote</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedItems.length} of {quotableItems.length} selected
                  </p>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {Object.entries(grouped).map(([stage, stageItems]) => {
                  const allOn = stageItems.every((i) => selectedIds.has(i.id));
                  return (
                    <div key={stage}>
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {STAGE_LABELS[stage] ?? stage}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleStage(stage)}
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          {allOn ? 'Clear stage' : 'Select stage'}
                        </button>
                      </div>
                      {stageItems.map((item) => (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 flex-shrink-0 rounded border-slate-300"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleItem(item.id)}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                            {item.material_name}
                          </span>
                          <span className="flex-shrink-0 text-xs tabular-nums text-slate-500">
                            {Number(item.quantity).toLocaleString()} {item.unit}
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rfq-address" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Deliver to
                </label>
                <input
                  id="rfq-address"
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
                  value={deliveryAddress}
                  onChange={(e) => { setDeliveryAddress(e.target.value); setMatches(null); }}
                  placeholder="Site address"
                />
                <p className="mt-1 text-xs text-slate-500">Used to favour nearby suppliers.</p>
              </div>
              <div>
                <label htmlFor="rfq-date" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Needed by
                </label>
                <input
                  id="rfq-date"
                  type="date"
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
                  value={requiredBy}
                  onChange={(e) => setRequiredBy(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="rfq-notes" className="block text-xs font-bold text-slate-700 mb-1.5">
                Notes for suppliers <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="rfq-notes"
                rows={3}
                className="min-h-11 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Access, delivery times, anything they should know."
              />
            </div>

            {matches && (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-900">
                  {matches.length > 0
                    ? `This will reach ${matches.length} ${matches.length === 1 ? 'supplier' : 'suppliers'}`
                    : 'No supplier matches these materials yet'}
                </p>
                {matches.length === 0 ? (
                  <p className="mt-1.5 flex items-start gap-2 text-xs text-slate-600">
                    <Warning size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
                    You can still send it — the request is saved and suppliers who join later
                    will not see it, so you may want to contact merchants directly for now.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {matches.map((m) => (
                      <li key={m.supplier.id} className="flex items-start justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-800">{m.supplier.name}</span>
                        <span className="text-right text-slate-500">{m.reasons.join(' · ')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePreview}
                disabled={isMatching || selectedItems.length === 0}
                className="min-h-11 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {isMatching ? 'Checking…' : 'Who will get this?'}
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending || selectedItems.length === 0}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <PaperPlaneTilt size={16} weight="fill" />
                {isSending ? 'Sending…' : `Send request${selectedItems.length ? ` (${selectedItems.length})` : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── List ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Requests for quotation</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ask suppliers to price items straight from this BOQ.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMode('compose')}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          <PaperPlaneTilt size={16} weight="fill" /> New request
        </button>
      </div>

      {rfqs.length === 0 ? (
        <EmptyState
          icon={<FileText size={48} weight="light" />}
          title="No requests yet"
          description="Pick items from your BOQ and send them to matching suppliers for pricing."
        />
      ) : (
        <div className="space-y-3">
          {rfqs.map((rfq) => {
            const quotes = rfq.rfq_quotes ?? [];
            const isOpen = expandedRfq === rfq.id;
            return (
              <div key={rfq.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setExpandedRfq(isOpen ? null : rfq.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {rfq.rfq_items?.length ?? 0} {(rfq.rfq_items?.length ?? 0) === 1 ? 'item' : 'items'}
                      {rfq.required_by ? ` · needed by ${formatDateOnly(rfq.required_by)}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sent {new Date(rfq.created_at).toLocaleDateString()} ·{' '}
                      {rfq.rfq_recipients?.length ?? 0} contacted ·{' '}
                      {quotes.length} {quotes.length === 1 ? 'quote' : 'quotes'} back
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${
                      STATUS_STYLES[rfq.status] ?? STATUS_STYLES.open
                    }`}
                  >
                    {rfq.status}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Items</p>
                      <ul className="mt-1.5 space-y-1">
                        {(rfq.rfq_items ?? []).map((item) => (
                          <li key={item.id} className="flex justify-between gap-3 text-xs text-slate-700">
                            <span className="truncate">{item.material_name}</span>
                            <span className="flex-shrink-0 tabular-nums text-slate-500">
                              {Number(item.quantity).toLocaleString()} {item.unit ?? ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quotes</p>
                      {quotes.length === 0 ? (
                        <p className="mt-1.5 text-xs text-slate-500">
                          Nothing back yet. Suppliers are notified by email when they are sent a request.
                        </p>
                      ) : (
                        <ul className="mt-1.5 space-y-2">
                          {[...quotes]
                            .sort((a, b) => Number(a.total_usd ?? 0) - Number(b.total_usd ?? 0))
                            .map((quote, index) => (
                              <li
                                key={quote.id}
                                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 ${
                                  quote.status === 'accepted'
                                    ? 'border-emerald-300 bg-emerald-50'
                                    : 'border-slate-200'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                                    <Storefront size={14} className="text-slate-400" />
                                    {quote.supplier?.name ?? 'Supplier'}
                                    {index === 0 && quotes.length > 1 && quote.status !== 'accepted' && (
                                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                        Lowest
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {quote.delivery_days ? `${quote.delivery_days} day delivery` : 'Delivery not stated'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-bold tabular-nums text-slate-900">
                                    {formatPrice(Number(quote.total_usd ?? 0), Number(quote.total_zwg ?? 0))}
                                  </span>
                                  {quote.status === 'accepted' ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                      <CheckCircle size={14} weight="fill" /> Accepted
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleAccept(rfq.id, quote.id)}
                                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white"
                                    >
                                      Accept
                                    </button>
                                  )}
                                </div>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
