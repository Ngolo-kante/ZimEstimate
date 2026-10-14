'use client';

import { ArrowCounterClockwise, CheckCircle, PencilSimple, Warning, WarningOctagon } from '@phosphor-icons/react';
import { assessPlanReview, type PlanReviewInput } from '@/lib/vision/planReview';

interface Props {
  input: PlanReviewInput;
  /**
   * Where the screen has its own "these numbers look right" step. Leave both
   * out when the page's main button already moves on (the plan-upload flow).
   */
  confirmed?: boolean;
  onConfirm?: () => void;
  onUndo?: () => void;
  onDoorsChange: (value: number) => void;
  onWindowsChange: (value: number) => void;
  onEditRooms: () => void;
  onEditStages: () => void;
}

const metres = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : '0.0'} m`;
const squareMetres = (value: number) => Number.isFinite(value) && value > 0 ? `${value.toFixed(1)} m²` : 'Not measured';
const count = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

export default function PlanReviewCheckpoint({
  input, confirmed, onConfirm, onUndo, onDoorsChange, onWindowsChange, onEditRooms, onEditStages,
}: Props) {
  const findings = assessPlanReview(input);
  const required = findings.filter((finding) => finding.severity === 'required');
  const checks = findings.filter((finding) => finding.severity === 'check');

  return (
    <section id="plan-review-checkpoint" aria-labelledby="plan-review-heading" className="scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-t-4 border-blue-700 bg-slate-50 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.18em] text-blue-700">
              Plan read{confirmed ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 tracking-normal text-emerald-800 normal-case"><CheckCircle size={12} weight="fill" /> Checked</span> : ' · please check'}
            </p>
            <h2 id="plan-review-heading" className="mt-1 text-xl font-bold tracking-tight text-slate-950">Check the quantities behind this BOQ</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Compare these figures with your drawing. They control the material quantities and estimate.</p>
          </div>
          <button type="button" onClick={onEditRooms} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:border-blue-400 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            <PencilSimple size={16} /> Edit rooms
          </button>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-medium text-slate-600">Floor area</dt><dd className="mt-1 text-xl font-bold tabular-nums text-slate-950">{squareMetres(input.area)}</dd></div>
          <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-medium text-slate-600">Rooms read</dt><dd className="mt-1 text-xl font-bold tabular-nums text-slate-950">{input.rooms.length}</dd></div>
          <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-medium text-slate-600">External walls</dt><dd className="mt-1 text-xl font-bold tabular-nums text-slate-950">{metres(input.externalWallLength)}</dd></div>
          <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-medium text-slate-600">Internal walls</dt><dd className="mt-1 text-xl font-bold tabular-nums text-slate-950">{metres(input.internalWallLength)}</dd></div>
        </dl>
        <p className="text-xs leading-5 text-slate-500">Wall lengths are costing assumptions derived from floor area and room count. Scanned wall segments can increase them, but this is not a measured wall takeoff.</p>

        <details className="rounded-xl border border-slate-200 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">Review all {input.rooms.length} rooms and dimensions</summary>
          <ul className="mt-3 divide-y divide-slate-100">
            {input.rooms.map((room, index) => (
              <li key={`${room.name}-${index}`} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-medium text-slate-800">{room.name || `Room ${index + 1}`}</span>
                <span className="tabular-nums text-slate-600">{room.length.toFixed(1)} × {room.width.toFixed(1)} m · {(room.length * room.width).toFixed(1)} m²</span>
              </li>
            ))}
          </ul>
        </details>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-800">Doors in plan
            <input type="number" min="0" step="1" inputMode="numeric" value={input.doors} onChange={(event) => onDoorsChange(count(Number(event.target.value)))} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base tabular-nums text-slate-950 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
          <label className="block text-sm font-semibold text-slate-800">Windows in plan
            <input type="number" min="0" step="1" inputMode="numeric" value={input.windows} onChange={(event) => onWindowsChange(count(Number(event.target.value)))} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base tabular-nums text-slate-950 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Included construction stages</h3>
            <button type="button" onClick={onEditStages} className="text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">Change stages</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {input.stages.length ? input.stages.map((stage) => <span key={stage} className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-900">{stage}</span>) : <span className="text-sm text-amber-900">No stages selected</span>}
            <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{input.includeLabor ? 'Labor included' : 'Materials only'}</span>
          </div>
          {input.stages.length > 0 && input.stages.length < 5 && <p className="mt-2 text-xs font-medium text-amber-900">This is a partial-stage estimate, not a full-house total.</p>}
        </div>

        {required.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
            <div className="flex items-center gap-2 text-sm font-bold text-red-900"><WarningOctagon size={18} /> Fix before continuing</div>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-5 text-red-900">
              {required.map((finding) => <li key={finding.id}>{finding.text}</li>)}
            </ul>
          </div>
        )}
        {checks.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="status">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-950"><Warning size={18} /> Worth a second look</div>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-5 text-amber-950">
              {checks.map((finding) => <li key={finding.id}>{finding.text}</li>)}
            </ul>
          </div>
        )}
        {findings.length === 0 && (
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800"><CheckCircle size={18} /> No missing or unusually low plan quantities found.</div>
        )}

        {onConfirm && required.length === 0 && (
          confirmed ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <span className="flex items-center gap-2 font-semibold"><CheckCircle size={18} weight="fill" /> Plan checked. Your BOQ below uses these numbers.</span>
              {onUndo && (
                <button type="button" onClick={onUndo} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-950">
                  <ArrowCounterClockwise size={14} /> Check again
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">You can still change any line in the BOQ afterwards.</p>
              <button type="button" onClick={onConfirm} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                <CheckCircle size={18} /> These numbers look right
              </button>
            </div>
          )
        )}
      </div>
    </section>
  );
}
