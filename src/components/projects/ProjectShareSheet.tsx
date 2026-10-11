'use client';

// "Share": send someone a copy of the project — the BOQ as a PDF, or a short
// summary — on WhatsApp, by email or however they like. A snapshot only:
// they cannot open or change the project. Giving a builder access to update
// it is a different thing, and lives under Invite (InviteModal).

import { useEffect, useMemo, useState } from 'react';
import { X, FilePdf, ShareNetwork, WhatsappLogo, EnvelopeSimple, Copy, Check, CircleNotch } from '@phosphor-icons/react';
import { useToast } from '@/components/ui/Toast';
import { getBOQItems } from '@/lib/services/projects';
import { loadPdfExport, PDF_LOAD_ERROR } from '@/lib/loadPdfExport';
import { projectShareSummary } from '@/lib/projects/shareSummary';
import { getBrowserSiteUrl } from '@/lib/siteUrl';
import type { BOQItem, Project } from '@/lib/database.types';

interface ProjectShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  /** Pass when already loaded (the project page); fetched otherwise. */
  items?: BOQItem[];
}

const fileName = (name: string) => `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'project'}-BOQ.pdf`;

export default function ProjectShareSheet({ isOpen, onClose, project, items: givenItems }: ProjectShareSheetProps) {
  const { success, error: showError } = useToast();
  const [loadedItems, setLoadedItems] = useState<BOQItem[] | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'share' | null>(null);
  const [copied, setCopied] = useState(false);
  const items = givenItems ?? loadedItems;

  useEffect(() => {
    if (!isOpen || givenItems) return;
    let cancelled = false;
    void getBOQItems(project.id).then(({ items: fetched }) => { if (!cancelled) setLoadedItems(fetched); });
    return () => { cancelled = true; };
  }, [isOpen, givenItems, project.id]);

  const summary = useMemo(
    () => (items ? projectShareSummary(project, items, getBrowserSiteUrl()) : ''),
    [items, project],
  );

  // Sharing a file (straight into WhatsApp and the like) is a phone feature;
  // offered only where the browser says it can.
  const [canShareFiles, setCanShareFiles] = useState(false);
  useEffect(() => {
    try {
      const probe = new File([''], 'x.pdf', { type: 'application/pdf' });
      setCanShareFiles(typeof navigator !== 'undefined' && Boolean(navigator.canShare?.({ files: [probe] })));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  if (!isOpen) return null;

  const hasItems = Boolean(items && items.length > 0);

  const pdfFile = async (): Promise<File | null> => {
    const pdf = await loadPdfExport('projects_list');
    if (!pdf) { showError(PDF_LOAD_ERROR); return null; }
    return new File([pdf.getBOQPDFBlob(project, items ?? [])], fileName(project.name), { type: 'application/pdf' });
  };

  const downloadPdf = async () => {
    setBusy('pdf');
    const pdf = await loadPdfExport('projects_list');
    if (pdf) pdf.downloadBOQPDF(project, items ?? []); else showError(PDF_LOAD_ERROR);
    setBusy(null);
  };

  const sharePdf = async () => {
    setBusy('share');
    try {
      const file = await pdfFile();
      if (file) await navigator.share({ files: [file], title: project.name, text: summary });
    } catch (error) {
      // Closing the share sheet is not an error.
      if (!(error instanceof DOMException && error.name === 'AbortError')) showError('Could not share the PDF. Try Download instead.');
    } finally {
      setBusy(null);
    }
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      success('Summary copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showError('Could not copy the summary.');
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="share-sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2 id="share-sheet-title">Share a copy</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Close"><X size={20} weight="bold" /></button>
        </div>
        <p className="lead">
          Send the BOQ and costs of <strong>{project.name}</strong> to a builder, family or the bank.
          They get a copy — they can&rsquo;t open or change the project.
        </p>

        {!items ? (
          <p className="loading"><CircleNotch size={16} className="spin" /> Loading the BOQ…</p>
        ) : (
          <>
            <pre className="preview">{summary}</pre>
            <div className="actions">
              {canShareFiles && (
                <button type="button" className="primary" onClick={() => void sharePdf()} disabled={!hasItems || busy !== null}>
                  {busy === 'share' ? <CircleNotch size={18} className="spin" /> : <ShareNetwork size={18} />} Share PDF
                </button>
              )}
              <button type="button" className={canShareFiles ? '' : 'primary'} onClick={() => void downloadPdf()} disabled={!hasItems || busy !== null}>
                {busy === 'pdf' ? <CircleNotch size={18} className="spin" /> : <FilePdf size={18} />} Download PDF
              </button>
              <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(summary)}`} target="_blank" rel="noopener noreferrer">
                <WhatsappLogo size={18} /> WhatsApp
              </a>
              <a className="btn" href={`mailto:?subject=${encodeURIComponent(`${project.name} — cost estimate`)}&body=${encodeURIComponent(summary)}`}>
                <EnvelopeSimple size={18} /> Email
              </a>
              <button type="button" onClick={() => void copySummary()}>
                {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copied' : 'Copy text'}
              </button>
            </div>
            {!hasItems && <p className="note">Add BOQ items to share a PDF.</p>}
            {!canShareFiles && hasItems && <p className="note">To send the PDF on WhatsApp from a computer, download it and attach it in the chat.</p>}
          </>
        )}
      </div>

      <style jsx>{`
        .overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px; background: rgba(15, 23, 42, 0.45); }
        .sheet { width: min(100%, 520px); max-height: calc(100vh - 32px); overflow-y: auto; padding: 20px; border-radius: 14px; background: var(--color-surface); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2); }
        .head { display: flex; justify-content: space-between; align-items: center; }
        h2 { margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--color-text); }
        .close { border: none; background: none; color: var(--color-text-secondary); cursor: pointer; padding: 4px; }
        .lead { margin: 6px 0 14px; font-size: 0.88rem; color: var(--color-text-secondary); line-height: 1.5; }
        .lead strong { color: var(--color-text); }
        .preview { margin: 0 0 14px; padding: 12px; max-height: 180px; overflow: auto; border-radius: 10px; background: var(--color-background); border: 1px solid var(--color-border); font-family: inherit; font-size: 0.82rem; line-height: 1.5; color: var(--color-text); white-space: pre-wrap; }
        .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .actions button, .actions :global(a.btn) {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 12px;
          border-radius: 9px; border: 1px solid var(--color-border); background: var(--color-surface);
          color: var(--color-text); font-size: 0.88rem; font-weight: 600; cursor: pointer; text-decoration: none;
        }
        .actions .primary { grid-column: 1 / -1; background: var(--color-accent); border-color: var(--color-accent); color: #fff; }
        .actions button:disabled { opacity: 0.55; cursor: default; }
        .note, .loading { margin: 10px 0 0; font-size: 0.8rem; color: var(--color-text-secondary); display: flex; align-items: center; gap: 6px; }
        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
