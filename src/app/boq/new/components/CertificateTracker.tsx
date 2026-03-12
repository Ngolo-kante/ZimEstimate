'use client';

import { CERTIFICATE_STATUS_META, STAGE_COMPLIANCE_REQUIREMENTS } from '@/lib/compliance';
import { useBoqWizardStore, type CertificateStatus } from '@/store/boqWizardStore';

const STATUS_OPTIONS: CertificateStatus[] = ['pending', 'in_progress', 'done'];

export default function CertificateTracker() {
  const { certificateTracker, setCertificateStatus } = useBoqWizardStore();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Certificate Tracker</h3>
      <p className="mt-1 text-xs text-slate-500">Monitor mandatory technical and council certificates per stage.</p>

      <div className="mt-4 space-y-2">
        {STAGE_COMPLIANCE_REQUIREMENTS.map((requirement) => {
          const status = certificateTracker[requirement.id] || 'pending';
          const statusMeta = CERTIFICATE_STATUS_META[status];

          return (
            <div key={requirement.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{requirement.label}</p>
                  <p className="text-xs text-slate-500">{requirement.description}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">Stage: {requirement.stage}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusMeta.badgeClass}`}>
                    {statusMeta.label}
                  </span>
                  <select
                    value={status}
                    onChange={(event) => setCertificateStatus(requirement.id, event.target.value as CertificateStatus)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {CERTIFICATE_STATUS_META[option].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
