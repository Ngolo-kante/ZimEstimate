'use client';

// ─── BOQ Scanner ──────────────────────────────────────────────────────────────
// Photograph a written bill of quantities and manage it here.
//
// Replaces a page that looked like this one and did nothing: it ran timed fake
// progress and returned the same hardcoded supplier quote whatever you
// uploaded, then navigated to /boq/new with query parameters the builder does
// not read, so even the invented items were discarded. A convincing demo next
// to a real feature under the same "AI Tools" heading.
//
// Different job from Vision Takeoff. That derives quantities the user does not
// have by measuring a drawing; this transcribes numbers that already exist on
// paper. So there is no inference here, the source image stays on screen beside
// the rows, and anything the model found hard to read is flagged for checking
// against the document in the user's hand.

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { createProject, saveProjectWithItems } from '@/lib/services/projects';
import type { ScannedBoq, ScannedBoqItem } from '@/lib/vision/boq-scan';
import {
  ArrowLeft, UploadSimple, Camera, Trash, Warning, CircleNotch, FloppyDisk,
} from '@phosphor-icons/react';

type Stage = 'upload' | 'scanning' | 'review';

/** Below this a line is called out for checking against the paper. */
const REVIEW_THRESHOLD = 70;

const slug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'item';

function BoqScannerContent() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scan, setScan] = useState<ScannedBoq | null>(null);
  const [items, setItems] = useState<ScannedBoqItem[]>([]);
  const [projectName, setProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * (i.unitPriceUsd ?? 0), 0),
    [items],
  );
  const needsReview = useMemo(
    () => items.filter((i) => i.confidence < REVIEW_THRESHOLD).length,
    [items],
  );
  const unpriced = useMemo(() => items.filter((i) => i.unitPriceUsd === null).length, [items]);

  const chooseFile = useCallback((chosen: File) => {
    setFile(chosen);
    // Revoked on replacement rather than left to accumulate for the session.
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return chosen.type === 'application/pdf' ? null : URL.createObjectURL(chosen);
    });
  }, []);

  const runScan = useCallback(async () => {
    if (!file) return;
    setStage('scanning');

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('Please sign in again.');

      const form = new FormData();
      form.append('file', file);

      const response = await fetch('/api/vision/scan-boq', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Could not read that document.');

      const scanned = result.data as ScannedBoq;
      setScan(scanned);
      setItems(scanned.items);
      setProjectName(scanned.title || scanned.supplierName || '');

      if (scanned.notABoq) {
        // Kept on the upload step with the file still selected, so retrying with
        // a better photo does not mean starting over.
        showError('We could not find a bill of quantities in that image. Try a clearer photo.');
        setStage('upload');
        return;
      }
      setStage('review');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not read that document.');
      setStage('upload');
    }
  }, [file, showError]);

  const updateItem = (index: number, patch: Partial<ScannedBoqItem>) => {
    setItems((current) =>
      current.map((item, i) =>
        i === index
          // Editing a line means a human has read it, so it stops being flagged.
          ? { ...item, ...patch, confidence: 100, note: undefined }
          : item,
      ),
    );
  };

  const handleSave = async () => {
    if (items.length === 0) return;
    setIsSaving(true);
    try {
      const { project, error: createError } = await createProject({
        name: projectName.trim() || 'Scanned BOQ',
        location: '',
        scope: 'entire_house',
        labor_preference: 'materials_only',
        selected_stages: null,
        soil_type: null,
        site_slope: null,
        geotech_report_uploaded: false,
        geotech_report_uploaded_at: null,
        geotech_report_document_id: null,
        geotech_analysis_mode: 'manual',
      });
      if (createError || !project) throw createError || new Error('Could not create the project.');

      const { error: saveError } = await saveProjectWithItems(
        project.id,
        { status: 'draft' },
        items.map((item, index) => ({
          // No catalogue match exists for transcribed text. A synthetic id keeps
          // the NOT NULL column honest about where the row came from rather than
          // borrowing an unrelated material's id.
          material_id: `scanned:${slug(item.description)}`,
          material_name: item.description,
          category: 'scanned',
          quantity: item.quantity,
          unit: item.unit,
          unit_price_usd: item.unitPriceUsd ?? 0,
          unit_price_zwg: 0,
          notes: item.note,
          sort_order: index,
        })),
      );
      if (saveError) throw saveError;

      success('Scanned BOQ saved.');
      router.push(`/projects?saved=${project.id}&refresh=1`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not save this BOQ.');
      setIsSaving(false);
    }
  };

  return (
    <div className="wrap">
      <Link href="/ai" className="crumb"><ArrowLeft size={16} /> AI Tools</Link>

      <header className="head">
        <h1>BOQ Scanner</h1>
        <p>
          Photograph a bill of quantities — handwritten on site or printed — and it becomes a
          project you can manage. Figures are read from the page, never estimated.
        </p>
      </header>

      {stage !== 'review' && (
        <section className="upload-card">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) chooseFile(f); }}
          />

          {previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={previewUrl} alt="The document to scan" className="preview" />
          ) : file ? (
            <p className="file-name">{file.name}</p>
          ) : (
            <div className="drop">
              <UploadSimple size={32} weight="duotone" />
              <p>Take a photo or upload your BOQ</p>
              <span>PNG, JPG or PDF, up to 10MB</span>
            </div>
          )}

          <div className="upload-actions">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={stage === 'scanning'}>
              <Camera size={16} weight="bold" /> {file ? 'Choose another' : 'Choose file'}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => void runScan()}
              disabled={!file || stage === 'scanning'}
            >
              {stage === 'scanning'
                ? <><CircleNotch size={16} weight="bold" className="spin" /> Reading…</>
                : 'Scan document'}
            </button>
          </div>

          {/* No fabricated progress bar. The request takes as long as it takes,
              and inventing steps to fill the wait is what the page this replaces
              did instead of working. */}
          {stage === 'scanning' && (
            <p className="scanning-note">Reading the document. This usually takes a few seconds.</p>
          )}
        </section>
      )}

      {stage === 'review' && scan && (
        <>
          <div className="summary">
            <label className="name-field">
              <span>Project name</span>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Scanned BOQ"
              />
            </label>
            <div className="stats">
              <span><strong>{items.length}</strong> items</span>
              {total > 0 && <span><strong>${Math.round(total).toLocaleString()}</strong> total</span>}
              {needsReview > 0 && (
                <span className="warn"><Warning size={14} weight="fill" /> {needsReview} to check</span>
              )}
            </div>
          </div>

          {unpriced > 0 && (
            <p className="notice">
              {unpriced === items.length
                ? 'This document lists quantities without prices, so the total is zero until you add them.'
                : `${unpriced} item${unpriced === 1 ? ' has' : 's have'} no price on the document.`}
            </p>
          )}

          <div className="review">
            {/* The source stays on screen. Checking a flagged line against the
                paper is the whole review, and hiding the image would mean
                trusting the transcription blind. */}
            {previewUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={previewUrl} alt="The scanned document" className="source" />
            )}

            <div className="rows">
              {items.map((item, index) => (
                <div key={index} className={`row${item.confidence < REVIEW_THRESHOLD ? ' flagged' : ''}`}>
                  <input
                    className="desc"
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    aria-label={`Description for line ${index + 1}`}
                  />
                  <input
                    className="num"
                    type="number" min="0" step="any"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 0 })}
                    aria-label={`Quantity for ${item.description}`}
                  />
                  <input
                    className="unit"
                    value={item.unit}
                    onChange={(e) => updateItem(index, { unit: e.target.value })}
                    aria-label={`Unit for ${item.description}`}
                  />
                  <input
                    className="num"
                    type="number" min="0" step="any"
                    value={item.unitPriceUsd ?? ''}
                    placeholder="—"
                    onChange={(e) => updateItem(index, {
                      unitPriceUsd: e.target.value === '' ? null : Number(e.target.value),
                    })}
                    aria-label={`Unit price for ${item.description}`}
                  />
                  <button
                    type="button"
                    className="remove"
                    aria-label={`Remove ${item.description}`}
                    onClick={() => setItems((c) => c.filter((_, i) => i !== index))}
                  >
                    <Trash size={15} />
                  </button>
                  {item.note && <p className="row-note">{item.note}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="save-row">
            <button type="button" onClick={() => { setStage('upload'); setScan(null); setItems([]); }}>
              Start over
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => void handleSave()}
              disabled={isSaving || items.length === 0}
            >
              {isSaving
                ? <><CircleNotch size={16} weight="bold" className="spin" /> Saving…</>
                : <><FloppyDisk size={16} weight="bold" /> Save as project</>}
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
        .crumb {
          display: inline-flex; align-items: center; gap: 6px; margin-bottom: 20px;
          font-size: 0.875rem; font-weight: 500; color: var(--color-text-secondary); text-decoration: none;
        }
        .head { margin-bottom: 24px; }
        .head h1 { font-size: 1.6rem; font-weight: 700; color: var(--color-text); margin: 0 0 6px; }
        .head p { font-size: 0.95rem; color: var(--color-text-secondary); margin: 0; max-width: 60ch; }

        .upload-card {
          border: 1px solid var(--color-border); border-radius: 12px;
          background: var(--color-surface); padding: 24px;
        }
        .drop {
          display: grid; place-items: center; gap: 6px; padding: 44px 20px;
          border: 2px dashed var(--color-border); border-radius: 10px;
          color: var(--color-text-secondary); text-align: center;
        }
        .drop p { margin: 0; font-weight: 600; color: var(--color-text); }
        .drop span { font-size: 0.8rem; }
        .preview, .source { max-width: 100%; border-radius: 10px; border: 1px solid var(--color-border); }
        .file-name { font-weight: 600; color: var(--color-text); }
        .upload-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
        .scanning-note { margin: 12px 0 0; font-size: 0.85rem; color: var(--color-text-secondary); }

        button {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 0.875rem; font-weight: 600;
          border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text);
        }
        button.primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; }
        button:disabled { opacity: 0.55; cursor: default; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .summary {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 16px; flex-wrap: wrap; margin-bottom: 12px;
        }
        .name-field { display: grid; gap: 4px; font-size: 0.8rem; font-weight: 600; color: var(--color-text-secondary); }
        .name-field input {
          padding: 9px 11px; border: 1px solid var(--color-border); border-radius: 8px;
          background: var(--color-surface); color: var(--color-text); min-width: 240px;
          font-size: max(0.9rem, 16px);
        }
        .stats { display: flex; gap: 16px; font-size: 0.9rem; color: var(--color-text-secondary); }
        .stats strong { color: var(--color-text); }
        .stats .warn { display: inline-flex; align-items: center; gap: 5px; color: var(--color-warning); font-weight: 600; }
        .notice {
          margin: 0 0 12px; padding: 10px 14px; border-radius: 8px;
          background: var(--color-background); color: var(--color-text-secondary); font-size: 0.85rem;
        }

        .review { display: grid; gap: 16px; }
        .rows { display: grid; gap: 6px; }
        .row {
          display: grid; grid-template-columns: 1fr 90px 90px 100px 36px; gap: 6px; align-items: center;
          padding: 6px; border-radius: 8px; border: 1px solid transparent;
        }
        .row.flagged { border-color: var(--color-warning); background: var(--color-warning-muted, #fffbeb); }
        .row input {
          padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px;
          background: var(--color-surface); color: var(--color-text); min-width: 0;
          /* iOS zooms the page when a focused input is under 16px. */
          font-size: max(0.85rem, 16px);
        }
        .row .remove { padding: 7px; border: none; background: none; color: var(--color-text-muted); }
        .row .remove:hover { color: var(--color-error); }
        .row-note { grid-column: 1 / -1; margin: 2px 0 0; font-size: 0.75rem; color: var(--color-warning); }

        .save-row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; flex-wrap: wrap; }

        @media (min-width: 900px) {
          .review { grid-template-columns: 340px 1fr; align-items: start; }
          .source { position: sticky; top: 88px; }
        }
        @media (max-width: 640px) {
          .wrap { padding: 20px 16px; }
          /* Stacked: five columns across 360px gives every field about 60px,
             which is unusable for a description. */
          .row { grid-template-columns: 1fr 1fr; }
          .row .desc { grid-column: 1 / -1; }
          .row .remove { grid-column: 2; justify-self: end; }
          .save-row button, .upload-actions button { flex: 1; }
        }
      `}</style>
    </div>
  );
}

export default function BoqScannerPage() {
  return (
    <MainLayout>
      <ProtectedRoute>
        <BoqScannerContent />
      </ProtectedRoute>
    </MainLayout>
  );
}
