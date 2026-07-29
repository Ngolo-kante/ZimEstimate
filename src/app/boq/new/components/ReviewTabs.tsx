'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash, FileText, ShieldCheck, FolderSimple, UploadSimple } from '@phosphor-icons/react';
import BOQTable from './BOQTable';
import PreConstructionChecklist from './PreConstructionChecklist';
import CertificateTracker from './CertificateTracker';
import { useBoqWizardStore } from '@/store/boqWizardStore';

type ReviewTabId = 'boq' | 'compliance' | 'documents';

interface TabOption {
  id: ReviewTabId;
  label: string;
  icon: React.ElementType;
}

const TABS: TabOption[] = [
  { id: 'boq', label: 'BOQ & Pricing', icon: FileText },
  { id: 'compliance', label: 'Site Compliance', icon: ShieldCheck },
  { id: 'documents', label: 'Documents', icon: FolderSimple },
];

export default function ReviewTabs() {
  const [activeTab, setActiveTab] = useState<ReviewTabId>('boq');
  const { geotechDocument, setGeotechDocument } = useBoqWizardStore();

  return (
    <section id="boq-review" className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm">
      {/* ── Section Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-[var(--color-border-light)] px-4 py-5 sm:px-6">
        <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text)]">
          Review & Finalize Project BOQ
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-secondary)]">
          Inspect final material quantities, verify site compliance, and attach supporting documentation before completion.
        </p>
      </header>

      {/* ── Tab Bar Navigation ─────────────────────────────────────────────── */}
      <div className="border-b border-[var(--color-border-light)] px-4 pt-3 sm:px-6">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="BOQ Review Sections">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`review-tab-panel-${tab.id}`}
                id={`review-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-[var(--color-surface)] shadow-sm'
                    : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] border border-[var(--color-border-light)]'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Panels Content ─────────────────────────────────────────────── */}
      <div className="p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'boq' && (
            <motion.div
              key="boq"
              id="review-tab-panel-boq"
              role="tabpanel"
              aria-labelledby="review-tab-boq"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <BOQTable />
            </motion.div>
          )}

          {activeTab === 'compliance' && (
            <motion.div
              key="compliance"
              id="review-tab-panel-compliance"
              role="tabpanel"
              aria-labelledby="review-tab-compliance"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <PreConstructionChecklist />
              <CertificateTracker />
            </motion.div>
          )}

          {activeTab === 'documents' && (
            <motion.div
              key="documents"
              id="review-tab-panel-documents"
              role="tabpanel"
              aria-labelledby="review-tab-documents"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <section className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text)]">Project Soil & Geotechnical Documents</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Attach geotechnical soil survey or municipal council approval documents for project history and auditing.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)] transition shadow-2xs">
                    <UploadSimple size={16} className="text-[var(--color-accent)]" />
                    <span>Upload Geotech File</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;

                        setGeotechDocument({
                          id: `local-${Date.now()}`,
                          fileName: file.name,
                          createdAt: new Date().toISOString(),
                        });
                      }}
                    />
                  </label>

                  {geotechDocument && (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-bg)] px-3.5 py-2 text-xs font-semibold text-[var(--color-text)]">
                      <span>{geotechDocument.fileName}</span>
                      <button
                        type="button"
                        onClick={() => setGeotechDocument(null)}
                        className="rounded-lg border border-[var(--color-border)] p-1 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition"
                        aria-label="Remove uploaded geotechnical document"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
