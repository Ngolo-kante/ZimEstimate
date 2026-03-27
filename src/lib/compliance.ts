import type { BOQCategory, StageTask } from '@/lib/database.types';

export const COMPLIANCE_CERTIFICATE_PREFIX = 'compliance_certificate:';
export const LEGACY_CERTIFICATE_PREFIX = 'boq_certificate:';
export const CHECKLIST_TASK_PREFIX = 'boq_checklist:';

export type ComplianceCertificateStatus = 'pending' | 'in_progress' | 'done';

export interface StageComplianceRequirement {
  id: string;
  stage: BOQCategory;
  label: string;
  description: string;
  required: boolean;
}

export const STAGE_COMPLIANCE_REQUIREMENTS: StageComplianceRequirement[] = [
  {
    id: 'approved_site_plan',
    stage: 'substructure',
    label: 'Approved Site Plan',
    description: 'Baseline approved drawings used for quantity takeoff and legal compliance.',
    required: true,
  },
  {
    id: 'slab_foundation_certificate',
    stage: 'substructure',
    label: 'Slab/Foundation Certificate',
    description: 'Engineer sign-off for foundation and slab integrity before progressing.',
    required: true,
  },
  {
    id: 'engineer_structural_signoff',
    stage: 'superstructure',
    label: 'Engineer Structural Sign-Off',
    description: 'Verification of reinforcement, columns, beams, and key structural zones.',
    required: true,
  },
  {
    id: 'timber_roof_designer_completion_certificate',
    stage: 'roofing',
    label: 'Timber Roof Designer Completion Certificate',
    description: 'Required sign-off from roof designer for timber roof structure completion.',
    required: true,
  },
  {
    id: 'itc_roof_loading_certificate',
    stage: 'roofing',
    label: 'ITC Roof Loading Certificate',
    description: 'Confirms roof structure loading compliance with applicable standards.',
    required: true,
  },
  {
    id: 'completion_occupation_certificate',
    stage: 'exterior',
    label: 'Council Completion / Occupation Certificate',
    description: 'Final local authority certificate confirming occupation approval.',
    required: true,
  },
];

export const CERTIFICATE_STATUS_META: Record<ComplianceCertificateStatus, { label: string; badgeClass: string }> = {
  pending: { label: 'Pending', badgeClass: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'In Progress', badgeClass: 'bg-amber-100 text-amber-700' },
  done: { label: 'Done', badgeClass: 'bg-emerald-100 text-emerald-700' },
};

export const buildComplianceCertificateMarker = (
  requirementId: string,
  status: ComplianceCertificateStatus
) => `${COMPLIANCE_CERTIFICATE_PREFIX}${requirementId}|status:${status}`;

export const parseComplianceCertificateStatus = (
  marker?: string | null
): ComplianceCertificateStatus => {
  if (!marker) return 'pending';
  if (marker.includes('|status:done')) return 'done';
  if (marker.includes('|status:in_progress')) return 'in_progress';
  return 'pending';
};

export const isComplianceCertificateTask = (task: StageTask) =>
  (task.verification_note || '').startsWith(COMPLIANCE_CERTIFICATE_PREFIX) ||
  (task.verification_note || '').startsWith(LEGACY_CERTIFICATE_PREFIX);

export const getComplianceRequirementStatus = (
  tasks: StageTask[],
  requirementId: string
): ComplianceCertificateStatus => {
  const task = tasks.find((entry) => {
    const marker = entry.verification_note || '';
    return (
      marker.startsWith(`${COMPLIANCE_CERTIFICATE_PREFIX}${requirementId}`) ||
      marker.startsWith(`${LEGACY_CERTIFICATE_PREFIX}${requirementId}`)
    );
  }
  );
  if (!task) return 'pending';
  if (task.is_completed) return 'done';
  return parseComplianceCertificateStatus(task.verification_note);
};

export const getStageRequirements = (stage: BOQCategory) =>
  STAGE_COMPLIANCE_REQUIREMENTS.filter((requirement) => requirement.stage === stage);
