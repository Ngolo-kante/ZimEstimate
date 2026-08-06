'use client';

// Was three hardcoded documents — including a "rejected CIPA certificate" that
// never existed — and an upload button that invented a file called
// new_document.pdf after a setTimeout. Both the list and the upload now go
// through supplier_documents, the same table and storage bucket the dashboard
// and the admin review flow already use.
//
// The required-document checklist was fictional too: it listed five types
// (company_reg, zimra_tin, cipa_cert, bank_letter, insurance) that the backend
// has never accepted. SupplierDocumentType defines three, so three is what this
// asks for.

import { useEffect, useRef, useState } from 'react';
import { FileText, UploadSimple, Check, Clock, Warning, Download } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import {
  getUserSupplierProfile,
  getSupplierDocuments,
  uploadSupplierDocument,
  type SupplierDocumentType,
} from '@/lib/services/suppliers';
import type { SupplierDocument } from '@/lib/database.types';

const REQUIRED_DOCS: { type: SupplierDocumentType; label: string; required: boolean }[] = [
  { type: 'business_license', label: 'Business Licence', required: true },
  { type: 'tax_clearance', label: 'Tax Clearance Certificate', required: true },
  { type: 'proof_of_address', label: 'Proof of Address', required: false },
];

const STATUS_CONFIG = {
  verified: { label: 'Verified', cls: 'verified', icon: Check },
  pending: { label: 'Under Review', cls: 'pending', icon: Clock },
  rejected: { label: 'Action Required', cls: 'rejected', icon: Warning },
};

export default function SupplierDocumentsPage() {
  const [docs, setDocs] = useState<SupplierDocument[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<SupplierDocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One hidden input reused by every row; the row that opened it decides the
  // document type, so a file lands against the right requirement.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<SupplierDocumentType | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const profile = await getUserSupplierProfile(user.id);
      if (!profile) {
        setLoading(false);
        return;
      }
      setSupplierId(profile.id);
      setDocs(await getSupplierDocuments(profile.id));
      setLoading(false);
    };

    load();
  }, []);

  const promptUpload = (type: SupplierDocumentType) => {
    pendingTypeRef.current = type;
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const type = pendingTypeRef.current;
    // Reset immediately so choosing the same file twice still fires a change.
    event.target.value = '';
    if (!file || !type || !userId || !supplierId) return;

    setUploadingType(type);
    const result = await uploadSupplierDocument({
      userId,
      documentType: type,
      file,
      supplierId,
    });
    setUploadingType(null);

    if (!result.success) {
      setError(result.error || 'Upload failed. Please try again.');
      return;
    }
    setDocs(await getSupplierDocuments(supplierId));
  };

  const latestFor = (type: SupplierDocumentType) =>
    docs.find((d) => d.document_type === type);

  return (
    <div className="page">
      <div className="page-header">
        <FileText size={22} weight="duotone" className="page-icon" />
        <div>
          <h1>Documents</h1>
          <p>Verification documents for your supplier account</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="empty-state"><FileText size={40} /><h3>Loading documents</h3></div>
      ) : !supplierId ? (
        <div className="empty-state">
          <FileText size={40} />
          <h3>No supplier profile</h3>
          <p>Complete supplier registration before uploading documents.</p>
        </div>
      ) : (
        <div className="doc-list">
          {REQUIRED_DOCS.map(({ type, label, required }) => {
            const doc = latestFor(type);
            const cfg = doc ? STATUS_CONFIG[doc.status] : null;
            const StatusIcon = cfg?.icon;
            return (
              <div key={type} className="doc-card">
                <div className="doc-main">
                  <div className="doc-icon"><FileText size={18} weight="duotone" /></div>
                  <div className="doc-info">
                    <div className="doc-label">
                      {label}
                      {required && <span className="req-tag">Required</span>}
                    </div>
                    {doc ? (
                      <div className="doc-meta">
                        {doc.file_name} · uploaded {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    ) : (
                      <div className="doc-meta muted">Not uploaded yet</div>
                    )}
                    {doc?.notes && <div className="doc-notes">{doc.notes}</div>}
                  </div>
                </div>
                <div className="doc-actions">
                  {doc && cfg && StatusIcon && (
                    <span className={`status ${cfg.cls}`}>
                      <StatusIcon size={13} /> {cfg.label}
                    </span>
                  )}
                  {doc?.file_url && (
                    <a className="icon-btn" href={doc.file_url} target="_blank" rel="noopener noreferrer" title="Download">
                      <Download size={14} />
                    </a>
                  )}
                  <button
                    className="upload-btn"
                    onClick={() => promptUpload(type)}
                    disabled={uploadingType !== null}
                  >
                    <UploadSimple size={13} />
                    {uploadingType === type ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileChosen}
        style={{ display: 'none' }}
      />

      <style jsx>{`
        .page { padding: 28px 32px; max-width: 820px; }
        .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .page-icon { color: #2563eb; }
        h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        p { font-size: 0.8125rem; color: #64748b; margin: 0; }
        .error-banner { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 10px; padding: 10px 14px; font-size: 0.8125rem; margin-bottom: 16px; }
        .doc-list { display: flex; flex-direction: column; gap: 10px; }
        .doc-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; flex-wrap: wrap; }
        .doc-main { display: flex; align-items: flex-start; gap: 14px; flex: 1; min-width: 0; }
        .doc-icon { width: 40px; height: 40px; border-radius: 10px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .doc-info { min-width: 0; }
        .doc-label { font-size: 0.875rem; font-weight: 700; color: #0f172a; margin-bottom: 3px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .req-tag { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #b45309; background: #fffbeb; border-radius: 4px; padding: 2px 6px; }
        .doc-meta { font-size: 0.78rem; color: #475569; word-break: break-word; }
        .doc-meta.muted { color: #94a3b8; }
        .doc-notes { font-size: 0.78rem; color: #b91c1c; margin-top: 4px; }
        .doc-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .status { display: inline-flex; align-items: center; gap: 5px; font-size: 0.72rem; font-weight: 700; border-radius: 20px; padding: 4px 10px; }
        .status.verified { color: #047857; background: #ecfdf5; }
        .status.pending { color: #b45309; background: #fffbeb; }
        .status.rejected { color: #b91c1c; background: #fef2f2; }
        .icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; border: 1px solid #e2e8f0; color: #64748b; text-decoration: none; }
        .icon-btn:hover { background: #f8fafc; color: #2563eb; }
        .upload-btn { display: inline-flex; align-items: center; gap: 6px; background: none; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; font-size: 0.8rem; color: #334155; cursor: pointer; }
        .upload-btn:hover:not(:disabled) { background: #f8fafc; border-color: #93c5fd; color: #2563eb; }
        .upload-btn:disabled { opacity: 0.6; cursor: default; }
        .empty-state { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 80px 40px; text-align: center; color: #94a3b8; }
        .empty-state h3 { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 16px 0 8px; }
      `}</style>
    </div>
  );
}
