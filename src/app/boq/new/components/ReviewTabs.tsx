'use client';

import { useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import BOQTable from './BOQTable';
import PreConstructionChecklist from './PreConstructionChecklist';
import CertificateTracker from './CertificateTracker';
import { useBoqWizardStore } from '@/store/boqWizardStore';

type ReviewTabId = 'boq' | 'compliance' | 'documents';

const TABS: Array<{ id: ReviewTabId; label: string }> = [
  { id: 'boq', label: 'BOQ & Pricing' },
  { id: 'compliance', label: 'Site Compliance' },
  { id: 'documents', label: 'Documents' },
];

export default function ReviewTabs() {
  const [activeTab, setActiveTab] = useState<ReviewTabId>('boq');
  const { geotechDocument, setGeotechDocument } = useBoqWizardStore();

  return (
    <section id="boq-review" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-900">Review & Finalize</h2>
        <p className="mt-1 text-sm text-slate-500">Edit final quantities, track compliance, and attach supporting documents.</p>
      </header>

      <div className="border-b border-slate-100 px-4 pt-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'boq' && <BOQTable />}

        {activeTab === 'compliance' && (
          <div className="space-y-4">
            <PreConstructionChecklist />
            <CertificateTracker />
          </div>
        )}

        {activeTab === 'documents' && (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Project Documents</h3>
            <p className="mt-1 text-xs text-slate-500">Attach geotechnical or council documents for project history and handover.</p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                Upload Geotech File
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    setGeotechDocument({
                      id: `local-${Date.now()}`,
                      fileName: file.name,
                      createdAt: new Date().toISOString(),
                    });
                  }}
                />
              </label>

              {geotechDocument && (
                <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <span>{geotechDocument.fileName}</span>
                  <button
                    type="button"
                    onClick={() => setGeotechDocument(null)}
                    className="rounded border border-emerald-300 p-1 text-emerald-700"
                    aria-label="Remove document"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
