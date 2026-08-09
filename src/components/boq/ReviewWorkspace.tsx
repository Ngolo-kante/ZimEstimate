'use client';

import { useState, type ReactNode } from 'react';
import { FileText, FolderSimple, ShieldCheck, Trash, UploadSimple } from '@phosphor-icons/react';
import PreConstructionChecklist from '@/app/boq/new/components/PreConstructionChecklist';
import CertificateTracker from '@/app/boq/new/components/CertificateTracker';
import { useBoqWizardStore } from '@/store/boqWizardStore';
import styles from './ReviewWorkspace.module.css';

type ReviewTab = 'boq' | 'compliance' | 'documents';

interface ReviewWorkspaceProps {
  title: string;
  description: string;
  sourceLabel: string;
  primary: ReactNode;
}

export default function ReviewWorkspace({ title, description, sourceLabel, primary }: ReviewWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<ReviewTab>('boq');
  const { geotechDocument, setGeotechDocument } = useBoqWizardStore();

  return (
    <section className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <span>{sourceLabel}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <nav aria-label="Review sections" className={styles.tabs}>
          <button type="button" aria-pressed={activeTab === 'boq'} onClick={() => setActiveTab('boq')}>
            <FileText size={16} weight="duotone" /> BOQ & Pricing
          </button>
          <button type="button" aria-pressed={activeTab === 'compliance'} onClick={() => setActiveTab('compliance')}>
            <ShieldCheck size={16} weight="duotone" /> Compliance
          </button>
          <button type="button" aria-pressed={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>
            <FolderSimple size={16} weight="duotone" /> Documents
          </button>
        </nav>
      </header>

      <div className={styles.content}>
        {activeTab === 'boq' && primary}
        {activeTab === 'compliance' && (
          <div className={styles.secondaryPanel}>
            <PreConstructionChecklist />
            <CertificateTracker />
          </div>
        )}
        {activeTab === 'documents' && (
          <section className={styles.documents}>
            <div>
              <h3>Project documents</h3>
              <p>Keep geotechnical surveys and council approvals with the estimate.</p>
            </div>
            <label>
              <UploadSimple size={17} />
              Upload document
              <input
                type="file"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setGeotechDocument({ id: `local-${Date.now()}`, fileName: file.name, createdAt: new Date().toISOString() });
                }}
              />
            </label>
            {geotechDocument && (
              <div className={styles.documentRow}>
                <span>{geotechDocument.fileName}</span>
                <button type="button" onClick={() => setGeotechDocument(null)} aria-label="Remove uploaded document">
                  <Trash size={15} />
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
