'use client';

// ─── Quote check ─────────────────────────────────────────────────────────────
// "Is my builder's quote fair?" Photograph the quote, check the lines were read
// right, and see each price against the market range.
//
// Three steps, each with a person in the loop where it matters: the quote is
// read by the same reader as the BOQ scanner (/api/vision/scan-boq), the lines
// are shown for correction before anything is judged — a misread $1.90 as
// $19.00 would otherwise become an accusation — and only then are prices
// compared (/api/quote-check). The comparison itself is arithmetic on
// catalogue prices; the AI only says which catalogue item a line is.
//
// Worded as a guide to what to ask, not a verdict on the builder: delivery,
// small quantities and a fair margin all put a line above shelf prices.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useToast } from '@/components/ui/Toast';
import { validateDocumentFile } from '@/lib/documentFiles';
import PdfViewer from '@/components/ui/PdfViewer';
import { prepareImageForUpload } from '@/lib/compressImage';
import { captureProductEvent } from '@/lib/productAnalytics';
import type { ScannedBoq } from '@/lib/vision/boq-scan';
import type { CheckedLine, QuoteCheckSummary, QuoteLine, Verdict } from '@/lib/quotes/marketCheck';
import { ArrowLeft, UploadSimple, Camera, Trash, CircleNotch, Plus, Scales } from '@phosphor-icons/react';

type Stage = 'upload' | 'reading' | 'lines' | 'checking' | 'result';

interface EditableLine extends QuoteLine {
  /** Set when the reader was unsure of this line. */
  unsure?: boolean;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  high: 'Above market',
  fair: 'Within market',
  low: 'Below market',
  unchecked: 'Not checked',
};

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const wholeMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;

function QuoteCheckContent() {
  const { error: showError } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [checked, setChecked] = useState<CheckedLine[]>([]);
  const [summary, setSummary] = useState<QuoteCheckSummary | null>(null);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const chooseFile = useCallback(async (chosen: File) => {
    const prepared = await prepareImageForUpload(chosen, 'reading');
    const error = validateDocumentFile(prepared);
    if (error) { showError(error); return; }
    setFile(prepared);
  }, [showError]);

  const readQuote = useCallback(async () => {
    if (!file) return;
    setStage('reading');
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/vision/scan-boq', { method: 'POST', body: form });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Could not read that quote.');
      const scanned = result.data as ScannedBoq;
      if (scanned.notABoq || scanned.items.length === 0) {
        showError('We could not find priced lines in that image. Try a clearer photo, or type the lines in.');
        setStage('upload');
        return;
      }
      setLines(scanned.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceUsd: item.unitPriceUsd,
        unsure: item.confidence < 70,
      })));
      setStage('lines');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not read that quote.');
      setStage('upload');
    }
  }, [file, showError]);

  const typeInstead = () => {
    setLines([{ description: '', quantity: 1, unit: '', unitPriceUsd: null }]);
    setStage('lines');
  };

  const updateLine = (index: number, patch: Partial<EditableLine>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch, unsure: false } : line)));

  const usableLines = useMemo(() => lines.filter((l) => l.description.trim()), [lines]);

  const checkPrices = useCallback(async () => {
    if (usableLines.length === 0) return;
    setStage('checking');
    try {
      const response = await fetch('/api/quote-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: usableLines.map(({ description, quantity, unit, unitPriceUsd }) => ({ description, quantity, unit, unitPriceUsd })),
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Could not check the quote.');
      setChecked(result.data.lines);
      setSummary(result.data.summary);
      setStage('result');
      captureProductEvent('ai_scan_used', {
        tool: 'quote_check',
        outcome: 'success',
        lines: result.data.summary.lines,
        checked: result.data.summary.checked,
        high: result.data.summary.high,
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not check the quote.');
      captureProductEvent('ai_scan_used', { tool: 'quote_check', outcome: 'failed' });
      setStage('lines');
    }
  }, [usableLines, showError]);

  const startOver = () => {
    setStage('upload'); setFile(null); setLines([]); setChecked([]); setSummary(null);
  };

  return (
    <div className="wrap">
      <span className="crumb-wrap"><Link href="/estimate" className="crumb"><ArrowLeft size={16} /> Start your estimate</Link></span>

      <header className="head">
        <h1>Check a quote</h1>
        <p>
          Got a quote from a builder or hardware? Photograph it and see each price against what
          materials cost in Harare right now.
        </p>
      </header>

      {(stage === 'upload' || stage === 'reading') && (
        <section className="card">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void chooseFile(f); e.target.value = ''; }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void chooseFile(f); e.target.value = ''; }} />

          {previewUrl ? (
            file?.type === 'application/pdf' ? <PdfViewer source={file} title="Quote to check" height="50vh" /> :
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={previewUrl} alt="The quote to check" className="preview" />
          ) : (
            <div className="drop">
              <UploadSimple size={32} weight="duotone" />
              <p>Take a photo or upload the quote</p>
              <span>PNG, JPG or PDF, up to 10MB · handwritten is fine</span>
            </div>
          )}

          <div className="actions">
            <button type="button" onClick={() => cameraRef.current?.click()} disabled={stage === 'reading'}><Camera size={16} /> Take photo</button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={stage === 'reading'}>
              <UploadSimple size={16} weight="bold" /> {file ? 'Choose another' : 'Choose file'}
            </button>
            <button type="button" className="primary" onClick={() => void readQuote()} disabled={!file || stage === 'reading'}>
              {stage === 'reading' ? <><CircleNotch size={16} weight="bold" className="spin" /> Reading…</> : 'Read the quote'}
            </button>
          </div>
          {stage === 'reading'
            ? <p className="note">Reading the quote. This usually takes a few seconds.</p>
            : <p className="note">Quote on WhatsApp as text? <button type="button" className="link" onClick={typeInstead}>Type the lines in instead</button>.</p>}
        </section>
      )}

      {(stage === 'lines' || stage === 'checking') && (
        <section>
          <p className="notice">
            Check these match the quote — especially the prices — before we compare them.
            {lines.some((l) => l.unsure) && ' Highlighted lines were hard to read.'}
          </p>
          <div className="lines-head" aria-hidden="true">
            <span>Item</span><span>Qty</span><span>Unit</span><span>Price each (US$)</span><span />
          </div>
          <div className="lines">
            {lines.map((line, index) => (
              <div key={index} className={`line${line.unsure ? ' unsure' : ''}`}>
                <input className="desc" value={line.description} placeholder="e.g. PPC cement 42.5R"
                  onChange={(e) => updateLine(index, { description: e.target.value })} aria-label={`Item on line ${index + 1}`} />
                <input type="number" min="0" step="any" value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })} aria-label={`Quantity on line ${index + 1}`} />
                <input value={line.unit} placeholder="bags"
                  onChange={(e) => updateLine(index, { unit: e.target.value })} aria-label={`Unit on line ${index + 1}`} />
                <input type="number" min="0" step="any" value={line.unitPriceUsd ?? ''} placeholder="—"
                  onChange={(e) => updateLine(index, { unitPriceUsd: e.target.value === '' ? null : Number(e.target.value) })}
                  aria-label={`Price each on line ${index + 1}`} />
                <button type="button" className="remove" aria-label={`Remove line ${index + 1}`}
                  onClick={() => setLines((c) => c.filter((_, i) => i !== index))}><Trash size={15} /></button>
              </div>
            ))}
          </div>
          <div className="actions">
            <button type="button" onClick={() => setLines((c) => [...c, { description: '', quantity: 1, unit: '', unitPriceUsd: null }])}>
              <Plus size={16} /> Add a line
            </button>
            <span className="spacer" />
            <button type="button" onClick={startOver} disabled={stage === 'checking'}>Start over</button>
            <button type="button" className="primary" onClick={() => void checkPrices()} disabled={usableLines.length === 0 || stage === 'checking'}>
              {stage === 'checking' ? <><CircleNotch size={16} weight="bold" className="spin" /> Checking…</> : <><Scales size={16} weight="bold" /> Check prices</>}
            </button>
          </div>
        </section>
      )}

      {stage === 'result' && summary && (
        <section>
          <div className={`verdict-card${summary.high > 0 ? ' has-high' : ''}`}>
            {summary.checked === 0 ? (
              <p className="big">We could not compare any of these lines with our prices yet.</p>
            ) : summary.high > 0 ? (
              <>
                <p className="big">
                  {summary.high} of {summary.checked} checked line{summary.checked === 1 ? '' : 's'} {summary.high === 1 ? 'is' : 'are'} above the market range
                </p>
                <p>
                  Together about <strong>{wholeMoney(summary.overByUsd)}</strong> more than the top of the range,
                  on a quote of {wholeMoney(summary.quotedTotalUsd)}. Worth asking about.
                </p>
              </>
            ) : (
              <p className="big">All {summary.checked} checked line{summary.checked === 1 ? '' : 's'} are within or below the market range.</p>
            )}
            {summary.unchecked > 0 && (
              <p className="muted">{summary.unchecked} line{summary.unchecked === 1 ? '' : 's'} could not be compared — shown at the bottom.</p>
            )}
          </div>

          <ul className="results">
            {[...checked]
              .map((line, i) => ({ line, i }))
              .sort((a, b) => order(a.line.verdict) - order(b.line.verdict) || b.line.overByUsd - a.line.overByUsd || a.i - b.i)
              .map(({ line, i }) => (
                <li key={i} className={`result ${line.verdict}`}>
                  <div className="result-top">
                    <span className="desc">{line.description}</span>
                    <span className={`chip ${line.verdict}`}>{VERDICT_LABEL[line.verdict]}</span>
                  </div>
                  <div className="result-meta">
                    {line.quantity.toLocaleString()} {line.unit}
                    {line.unitPriceUsd !== null && <> × {money(line.unitPriceUsd)}</>}
                    {line.materialName && line.materialName.toLowerCase() !== line.description.toLowerCase() && (
                      <> · compared with <em>{line.materialName}</em></>
                    )}
                  </div>
                  <p className="reason">
                    {line.reason}
                    {line.verdict === 'high' && line.overByUsd >= 1 && <> About <strong>{wholeMoney(line.overByUsd)}</strong> over on this line.</>}
                  </p>
                </li>
              ))}
          </ul>

          <p className="fine">
            Market ranges come from prices listed by Harare suppliers{checked.find((l) => l.market?.verified)?.market?.checkedOn
              ? `, checked ${checked.find((l) => l.market?.verified)?.market?.checkedOn}` : ''}. A price above the range is
            a question to ask, not proof of overcharging — delivery, small quantities and a builder&rsquo;s margin are all
            fair reasons for a higher price.
          </p>

          <div className="actions">
            <button type="button" onClick={() => setStage('lines')}>Edit lines</button>
            <span className="spacer" />
            <button type="button" className="primary" onClick={startOver}>Check another quote</button>
          </div>
        </section>
      )}

      <style jsx>{`
        .wrap { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
        .crumb-wrap { display: inline-block; margin-bottom: 20px; }
        .crumb-wrap :global(.crumb) {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 0.875rem; font-weight: 500; color: var(--color-text-secondary); text-decoration: none;
        }
        .head { margin-bottom: 20px; }
        .head h1 { font-size: 1.6rem; font-weight: 700; color: var(--color-text); margin: 0 0 6px; }
        .head p { font-size: 0.95rem; color: var(--color-text-secondary); margin: 0; max-width: 60ch; }

        .card { border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); padding: 24px; }
        .drop {
          display: grid; place-items: center; gap: 6px; padding: 44px 20px;
          border: 2px dashed var(--color-border); border-radius: 10px; color: var(--color-text-secondary); text-align: center;
        }
        .drop p { margin: 0; font-weight: 600; color: var(--color-text); }
        .drop span { font-size: 0.8rem; }
        .preview { max-width: 100%; max-height: 60vh; border-radius: 10px; border: 1px solid var(--color-border); }
        .note { margin: 12px 0 0; font-size: 0.85rem; color: var(--color-text-secondary); }

        .actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; align-items: center; }
        .spacer { flex: 1; }
        button {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 0.875rem; font-weight: 600;
          border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text);
        }
        button.primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; }
        button.link { padding: 0; border: none; background: none; color: var(--color-accent); font-weight: 600; font-size: inherit; display: inline; text-decoration: underline; }
        button:disabled { opacity: 0.55; cursor: default; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .notice {
          margin: 0 0 12px; padding: 10px 14px; border-radius: 8px;
          background: var(--color-background); color: var(--color-text-secondary); font-size: 0.85rem;
        }
        .lines-head, .line { display: grid; grid-template-columns: 1fr 80px 80px 120px 36px; gap: 6px; align-items: center; }
        .lines-head { padding: 0 6px 4px; font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); }
        .lines { display: grid; gap: 4px; }
        .line { padding: 6px; border-radius: 8px; border: 1px solid transparent; }
        .line.unsure { border-color: var(--color-warning); background: var(--color-warning-muted, #fffbeb); }
        .line input {
          padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px;
          background: var(--color-surface); color: var(--color-text); min-width: 0;
          font-size: max(0.85rem, 16px);
        }
        .line .remove { padding: 7px; border: none; background: none; color: var(--color-text-muted); }

        .verdict-card {
          padding: 18px 20px; border-radius: 12px; margin-bottom: 16px;
          border: 1px solid var(--color-border); background: var(--color-surface);
        }
        .verdict-card.has-high { border-color: var(--color-warning); }
        .verdict-card p { margin: 0; color: var(--color-text-secondary); font-size: 0.92rem; }
        .verdict-card p + p { margin-top: 6px; }
        .verdict-card .big { font-size: 1.15rem; font-weight: 700; color: var(--color-text); }
        .verdict-card strong { color: var(--color-text); }
        .muted { font-size: 0.85rem; }

        .results { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        .result { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-surface); }
        .result.high { border-left: 4px solid var(--color-warning); }
        .result.unchecked { opacity: 0.8; }
        .result-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
        .result-top .desc { font-weight: 600; color: var(--color-text); }
        .chip { flex-shrink: 0; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
        .chip.high { background: var(--color-warning-muted, #fffbeb); color: var(--color-warning); }
        .chip.fair { background: var(--color-success-muted, #ecfdf5); color: var(--color-success); }
        .chip.low { background: var(--color-background); color: var(--color-accent); }
        .chip.unchecked { background: var(--color-background); color: var(--color-text-muted); }
        .result-meta { margin-top: 2px; font-size: 0.82rem; color: var(--color-text-secondary); }
        .reason { margin: 6px 0 0; font-size: 0.86rem; color: var(--color-text-secondary); }
        .reason strong { color: var(--color-text); }
        .fine { margin: 16px 0 0; font-size: 0.8rem; color: var(--color-text-muted); max-width: 70ch; }

        @media (max-width: 640px) {
          .wrap { padding: 20px 16px; }
          .lines-head { display: none; }
          .line { grid-template-columns: 1fr 1fr 1fr; }
          .line .desc { grid-column: 1 / -1; }
          .line .remove { grid-column: 3; justify-self: end; }
          .actions button { flex: 1; }
          .spacer { display: none; }
        }
      `}</style>
    </div>
  );
}

/* High first (the reason people came), then low, fair, and lines we could not check. */
function order(verdict: Verdict): number {
  return { high: 0, low: 1, fair: 2, unchecked: 3 }[verdict];
}

export default function QuoteCheckClient() {
  return (
    <MainLayout>
      <QuoteCheckContent />
    </MainLayout>
  );
}
