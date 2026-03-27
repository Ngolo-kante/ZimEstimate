'use client';

import { useState, useRef } from 'react';
import { FileText, UploadSimple, Check, Clock, Warning, Trash, Download } from '@phosphor-icons/react';

type Doc = {
  id: string;
  name: string;
  type: string;
  size: string;
  status: 'verified' | 'pending' | 'rejected';
  uploaded: string;
  notes?: string;
};

const REQUIRED_DOCS = [
  { type: 'company_reg', label: 'Company Registration Certificate', required: true },
  { type: 'zimra_tin', label: 'ZIMRA TIN Certificate', required: true },
  { type: 'cipa_cert', label: 'CIPA Certificate', required: false },
  { type: 'bank_letter', label: 'Bank Confirmation Letter', required: false },
  { type: 'insurance', label: 'Insurance Certificate', required: false },
];

const MOCK_DOCS: Doc[] = [
  { id: '1', name: 'company_registration.pdf', type: 'company_reg', size: '1.2 MB', status: 'verified', uploaded: '2026-02-10' },
  { id: '2', name: 'zimra_tin_2026.pdf', type: 'zimra_tin', size: '0.8 MB', status: 'pending', uploaded: '2026-03-20' },
  { id: '3', name: 'cipa_certificate.pdf', type: 'cipa_cert', size: '0.5 MB', status: 'rejected', uploaded: '2026-03-01', notes: 'Document expired. Please upload a current certificate.' },
];

const STATUS_CONFIG = {
  verified: { label: 'Verified', cls: 'verified', icon: Check },
  pending: { label: 'Under Review', cls: 'pending', icon: Clock },
  rejected: { label: 'Action Required', cls: 'rejected', icon: Warning },
};

export default function SupplierDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>(MOCK_DOCS);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => {
      const newDoc: Doc = {
        id: String(Date.now()),
        name: 'new_document.pdf',
        type: 'bank_letter',
        size: '0.6 MB',
        status: 'pending',
        uploaded: new Date().toISOString().split('T')[0],
      };
      setDocs(prev => [newDoc, ...prev]);
      setUploading(false);
    }, 1500);
  };

  const handleRemove = (id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id));
  };

  const getDocStatus = (type: string) => docs.find(d => d.type === type);

  return (
    <div className="page">
      <div className="page-header">
        <div className="header-left">
          <FileText size={22} weight="duotone" className="page-icon" />
          <div>
            <h1>Documents</h1>
            <p>Upload and manage your verification documents</p>
          </div>
        </div>
        <button className="btn-upload" onClick={handleUpload} disabled={uploading}>
          <UploadSimple size={15} />
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>

      <div className="verification-status">
        <div className="vs-title">Verification Checklist</div>
        <div className="checklist">
          {REQUIRED_DOCS.map(rd => {
            const doc = getDocStatus(rd.type);
            const StatusIcon = doc ? STATUS_CONFIG[doc.status].icon : null;
            return (
              <div key={rd.type} className={`checklist-item ${doc ? STATUS_CONFIG[doc.status].cls : 'missing'}`}>
                <div className="checklist-icon">
                  {doc && StatusIcon ? <StatusIcon size={14} weight="bold" /> : <span className="dot" />}
                </div>
                <div className="checklist-info">
                  <div className="checklist-name">{rd.label}</div>
                  {rd.required && !doc && <div className="checklist-required">Required</div>}
                  {doc && <div className="checklist-status-text">{STATUS_CONFIG[doc.status].label}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="docs-section-title">Uploaded Documents</div>
      {docs.length === 0 ? (
        <div className="empty-state">
          <FileText size={36} />
          <p>No documents uploaded yet.</p>
          <button className="btn-upload" onClick={handleUpload}><UploadSimple size={14} /> Upload First Document</button>
        </div>
      ) : (
        <div className="docs-list">
          {docs.map(doc => {
            const cfg = STATUS_CONFIG[doc.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={doc.id} className={`doc-card ${cfg.cls}`}>
                <div className="doc-icon"><FileText size={20} weight="duotone" /></div>
                <div className="doc-info">
                  <div className="doc-name">{doc.name}</div>
                  <div className="doc-meta">{doc.size} · Uploaded {doc.uploaded}</div>
                  {doc.notes && <div className="doc-note"><Warning size={12} /> {doc.notes}</div>}
                </div>
                <span className={`doc-status ${cfg.cls}`}>
                  <StatusIcon size={12} weight="bold" /> {cfg.label}
                </span>
                <div className="doc-actions">
                  <button className="icon-btn" title="Download"><Download size={14} /></button>
                  <button className="icon-btn danger" title="Remove" onClick={() => handleRemove(doc.id)}><Trash size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .page { padding: 28px 32px; max-width: 860px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .page-icon { color: #2563eb; }
        h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        p { font-size: 0.8125rem; color: #64748b; margin: 0; }
        .btn-upload { display: flex; align-items: center; gap: 6px; background: #2563eb; color: white; border: none; border-radius: 8px; padding: 9px 16px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
        .btn-upload:disabled { opacity: 0.6; cursor: wait; }
        .verification-status { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px 24px; margin-bottom: 24px; }
        .vs-title { font-size: 0.8125rem; font-weight: 700; color: #0f172a; margin-bottom: 14px; }
        .checklist { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
        .checklist-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .checklist-item.verified { background: #f0fdf4; border-color: #bbf7d0; }
        .checklist-item.pending { background: #fffbeb; border-color: #fde68a; }
        .checklist-item.rejected { background: #fef2f2; border-color: #fecaca; }
        .checklist-item.missing { background: #f8fafc; }
        .checklist-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #e2e8f0; flex-shrink: 0; color: #64748b; }
        .checklist-item.verified .checklist-icon { background: #dcfce7; color: #059669; }
        .checklist-item.pending .checklist-icon { background: #fef3c7; color: #d97706; }
        .checklist-item.rejected .checklist-icon { background: #fee2e2; color: #dc2626; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; display: block; }
        .checklist-name { font-size: 0.8rem; font-weight: 600; color: #1e293b; }
        .checklist-required { font-size: 0.7rem; color: #f59e0b; font-weight: 600; margin-top: 2px; }
        .checklist-status-text { font-size: 0.7rem; color: #64748b; margin-top: 2px; }
        .docs-section-title { font-size: 0.8125rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
        .docs-list { display: flex; flex-direction: column; gap: 10px; }
        .doc-card { background: white; border-radius: 10px; border: 1px solid #e2e8f0; padding: 14px 18px; display: flex; align-items: center; gap: 14px; }
        .doc-card.rejected { border-color: #fecaca; background: #fff8f8; }
        .doc-icon { color: #2563eb; flex-shrink: 0; }
        .doc-info { flex: 1; min-width: 0; }
        .doc-name { font-size: 0.875rem; font-weight: 600; color: #0f172a; }
        .doc-meta { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
        .doc-note { font-size: 0.75rem; color: #dc2626; margin-top: 4px; display: flex; align-items: center; gap: 4px; }
        .doc-status { display: flex; align-items: center; gap: 5px; font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 20px; white-space: nowrap; }
        .doc-status.verified { background: #dcfce7; color: #059669; }
        .doc-status.pending { background: #fef3c7; color: #d97706; }
        .doc-status.rejected { background: #fee2e2; color: #dc2626; }
        .doc-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .icon-btn { background: none; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; cursor: pointer; color: #64748b; display: inline-flex; align-items: center; }
        .icon-btn:hover { background: #f1f5f9; }
        .icon-btn.danger { border-color: #fecaca; color: #dc2626; }
        .empty-state { background: white; border-radius: 12px; border: 1px dashed #e2e8f0; padding: 60px; text-align: center; color: #94a3b8; }
        .empty-state p { margin: 12px 0 16px; }
      `}</style>
    </div>
  );
}
