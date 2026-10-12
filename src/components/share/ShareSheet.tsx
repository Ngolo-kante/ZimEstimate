'use client';

// "Share a copy": send someone the BOQ as a PDF, or a short summary, on
// WhatsApp, by email or however they like. A snapshot only — they cannot open
// or change the work. Used for full projects and quick estimates alike (see
// ProjectShareSheet and QuickShareSheet), so both offer the same things.

import { useEffect, useState } from 'react';
import { X, FilePdf, ShareNetwork, WhatsappLogo, EnvelopeSimple, Copy, Check, CircleNotch, LinkSimple } from '@phosphor-icons/react';
import { useToast } from '@/components/ui/Toast';

export interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  /** The text that goes with the copy; null while it loads. */
  summary: string | null;
  hasItems: boolean;
  /** The PDF as a file, for the phone's share picker. */
  buildPdf: () => Promise<Blob | null>;
  downloadPdf: () => Promise<void>;
  /** A view-only link, where the work has one (quick estimates). */
  getLink?: () => Promise<string | null>;
}

export const pdfFileName = (name: string) => `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'estimate'}-BOQ.pdf`;

export default function ShareSheet({ isOpen, onClose, name, summary, hasItems, buildPdf, downloadPdf, getLink }: ShareSheetProps) {
  const { success, error: showError } = useToast();
  const [busy, setBusy] = useState<'pdf' | 'share' | 'link' | null>(null);
  const [copied, setCopied] = useState<'text' | 'link' | null>(null);
  // Shown once made, so it can be copied by hand where the browser will not
  // let the page write to the clipboard.
  const [madeLink, setMadeLink] = useState<string | null>(null);

  // The phone's own share picker (WhatsApp, email, Bluetooth, Drive — the
  // person chooses). With the PDF attached where the browser allows files,
  // otherwise the summary text. Computers without it get the buttons below.
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [preparedPdf, setPreparedPdf] = useState<File | null>(null);
  useEffect(() => {
    try {
      const probe = new File([''], 'x.pdf', { type: 'application/pdf' });
      setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
      setCanShareFiles(typeof navigator !== 'undefined' && Boolean(navigator.canShare?.({ files: [probe] })));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  // Made as soon as the content is here, so pressing Share opens the picker
  // at once: phones only allow it straight after the tap, not after a wait.
  useEffect(() => {
    if (!isOpen || !canShareFiles || !hasItems || summary === null) return;
    let active = true;
    void buildPdf().then((blob) => {
      if (active && blob) setPreparedPdf(new File([blob], pdfFileName(name), { type: 'application/pdf' }));
    });
    return () => { active = false; };
  }, [isOpen, canShareFiles, hasItems, summary, buildPdf, name]);

  if (!isOpen) return null;

  const download = async () => {
    setBusy('pdf');
    try { await downloadPdf(); } finally { setBusy(null); }
  };

  const openPicker = async () => {
    setBusy('share');
    try {
      if (preparedPdf) await navigator.share({ files: [preparedPdf], title: name, text: summary ?? '' });
      else await navigator.share({ title: name, text: summary ?? '' });
    } catch (error) {
      // Closing the picker is not an error.
      if (!(error instanceof DOMException && error.name === 'AbortError')) showError('Could not open sharing. Use the buttons below instead.');
    } finally {
      setBusy(null);
    }
  };

  const copy = async (what: 'text' | 'link') => {
    let value = summary ?? '';
    if (what === 'link') {
      setBusy('link');
      const link = await getLink?.().catch(() => null);
      setBusy(null);
      if (!link) { showError('Could not make the link. Please try again.'); return; }
      setMadeLink(link);
      value = link;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      success(what === 'link' ? 'View-only link copied' : 'Summary copied');
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // The link exists; only the clipboard refused. It is shown below.
      showError(what === 'link' ? 'Copy the link from the box below.' : 'Could not copy the summary — select the text above instead.');
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
          Send the BOQ and costs of <strong>{name}</strong> to a builder, family or the bank.
          They get a copy — they can&rsquo;t change it.
        </p>

        {summary === null ? (
          <p className="loading"><CircleNotch size={16} className="spin" /> Loading the BOQ…</p>
        ) : (
          <>
            <pre className="preview">{summary}</pre>
            <div className="actions">
              {canNativeShare && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => void openPicker()}
                  disabled={busy !== null || (canShareFiles && hasItems && !preparedPdf)}
                >
                  {busy === 'share' || (canShareFiles && hasItems && !preparedPdf) ? <CircleNotch size={18} className="spin" /> : <ShareNetwork size={18} />}
                  {canShareFiles && hasItems ? 'Share PDF…' : 'Share…'}
                </button>
              )}
              <button type="button" className={canNativeShare ? '' : 'primary'} onClick={() => void download()} disabled={!hasItems || busy !== null}>
                {busy === 'pdf' ? <CircleNotch size={18} className="spin" /> : <FilePdf size={18} />} Download PDF
              </button>
              <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(summary)}`} target="_blank" rel="noopener noreferrer">
                <WhatsappLogo size={18} /> WhatsApp
              </a>
              <a className="btn" href={`mailto:?subject=${encodeURIComponent(`${name} — cost estimate`)}&body=${encodeURIComponent(summary)}`}>
                <EnvelopeSimple size={18} /> Email
              </a>
              <button type="button" onClick={() => void copy('text')}>
                {copied === 'text' ? <Check size={18} /> : <Copy size={18} />} {copied === 'text' ? 'Copied' : 'Copy text'}
              </button>
              {getLink && (
                <button type="button" onClick={() => void copy('link')} disabled={busy !== null}>
                  {busy === 'link' ? <CircleNotch size={18} className="spin" /> : copied === 'link' ? <Check size={18} /> : <LinkSimple size={18} />}
                  {copied === 'link' ? 'Link copied' : 'Copy view-only link'}
                </button>
              )}
            </div>
            {madeLink && (
              <input className="link-box" readOnly value={madeLink} onFocus={(e) => e.currentTarget.select()} aria-label="View-only link" />
            )}
            {!hasItems && <p className="note">Add BOQ items to share a PDF.</p>}
            {getLink && <p className="note">The link opens a read-only copy anyone can view. Stop sharing it from the estimate page.</p>}
            {canNativeShare && <p className="note">Share opens your phone&rsquo;s list of apps — pick WhatsApp, email or anything else.</p>}
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
        .link-box { width: 100%; margin-top: 10px; padding: 9px 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-background); color: var(--color-text); font-size: max(0.82rem, 16px); }
        .note, .loading { margin: 10px 0 0; font-size: 0.8rem; color: var(--color-text-secondary); display: flex; align-items: center; gap: 6px; }
        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
