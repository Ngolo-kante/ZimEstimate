'use client';

import { useState, type ReactNode } from 'react';
import { FileText, FolderSimple, ShieldCheck } from '@phosphor-icons/react';
import PreConstructionChecklist from '@/app/boq/new/components/PreConstructionChecklist';
import CertificateTracker from '@/app/boq/new/components/CertificateTracker';
import DocumentsTab from '@/components/projects/DocumentsTab';
import Button from '@/components/ui/Button';
import styles from './ReviewWorkspace.module.css';

type ReviewTab = 'boq' | 'compliance' | 'documents';

interface ReviewWorkspaceProps {
  title: string;
  description: string;
  sourceLabel: string;
  primary: ReactNode;
  projectId?: string;
  onSave?: () => void;
  isSaving?: boolean;
}

export default function ReviewWorkspace({ title, description, sourceLabel, primary, projectId, onSave, isSaving }: ReviewWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<ReviewTab>('boq');

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
          projectId ? <DocumentsTab projectId={projectId} /> : (
            <section className={styles.documents}>
              <FolderSimple size={32} weight="duotone" />
              <h3>Save your project to add documents</h3>
              <p>Your saved project keeps the actual plans, approvals and receipts, ready to open or download later.</p>
              {onSave && <Button onClick={onSave} loading={isSaving}>Save project to add documents</Button>}
            </section>
          )
        )}
      </div>
    </section>
  );
}
