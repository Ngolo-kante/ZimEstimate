// ─── Compliance for quick projects ────────────────────────────────────────────
// What a borehole, septic tank or solar install has to clear before it is legal
// to use — keyed by project type rather than by build stage.
//
// STAGE_COMPLIANCE_REQUIREMENTS in src/lib/compliance.ts is keyed by BOQCategory
// (substructure, roofing, exterior…), which is the right shape for a house and
// the wrong shape for a borehole. A borehole has no superstructure and no
// occupation certificate; it has a drilling permit and a groundwater
// registration, and they apply to the whole job rather than to a phase of it.
//
// Deliberately not merged with the stage list: the two are keyed differently and
// answer different questions. Sharing a type would mean one of them carrying a
// field it never uses.

import type { ComplianceStatus, ProjectType } from './engine/types';

export type { ComplianceStatus };

export interface QuickComplianceRequirement {
  id: string;
  label: string;
  /** Who issues or enforces it — the thing users actually need to go and find. */
  authority: string;
  description: string;
  /** false = worth doing, not a legal gate. Kept separate so the UI can rank. */
  required: boolean;
  /** Only applies when this answer is set — e.g. commercial abstraction. */
  appliesWhen?: (answers: Record<string, unknown>) => boolean;
}

const isCommercial = (a: Record<string, unknown>) =>
  a.borehole_purpose === 'commercial' || a.purpose === 'commercial';

const isUrban = (a: Record<string, unknown>) =>
  a.area_type === 'urban' ||
  ['harare', 'bulawayo', 'chitungwiza', 'mutare', 'gweru'].includes(String(a.project_location ?? ''));

const QUICK_COMPLIANCE: Record<string, QuickComplianceRequirement[]> = {
  borehole: [
    {
      id: 'zinwa_drilling_permit',
      label: 'ZINWA borehole drilling permit',
      authority: 'ZINWA',
      description: 'Permission to sink the borehole. Applied for before drilling starts, not after.',
      required: true,
    },
    {
      id: 'groundwater_registration',
      label: 'Groundwater abstraction registration',
      authority: 'ZINWA / Catchment Council',
      description: 'Registers the borehole and the volume drawn from it once it is in use.',
      required: true,
    },
    {
      id: 'council_siting_approval',
      label: 'Local authority siting approval',
      authority: 'City / Rural District Council',
      description: 'Confirms the position clears boundaries, sewer lines and septic soakaways.',
      required: true,
      appliesWhen: isUrban,
    },
    {
      id: 'ema_commercial_licence',
      label: 'EMA licence for commercial abstraction',
      authority: 'EMA',
      description: 'Applies where water is sold or used in production rather than for a household.',
      required: true,
      appliesWhen: isCommercial,
    },
    {
      id: 'water_quality_test',
      label: 'Water quality test',
      authority: 'Accredited laboratory',
      description: 'Confirms the water is safe to drink before the borehole is relied on.',
      required: false,
    },
    {
      id: 'driller_completion_certificate',
      label: 'Driller completion certificate',
      authority: 'Contractor',
      description: 'Depth, yield and casing record. The document to insist on before final payment.',
      required: false,
    },
  ],

  septic: [
    {
      id: 'council_plumbing_approval',
      label: 'Council plumbing / drainage approval',
      authority: 'City / Rural District Council',
      description: 'Approves the tank position, size and soakaway before excavation.',
      required: true,
    },
    {
      id: 'ema_effluent_clearance',
      label: 'EMA effluent clearance',
      authority: 'EMA',
      description: 'Covers how effluent is discharged and where it ends up.',
      required: true,
    },
    {
      id: 'health_inspection',
      label: 'Environmental health inspection',
      authority: 'Council Health Department',
      description: 'Sign-off after installation, before the system is covered and used.',
      required: true,
    },
    {
      id: 'soil_percolation_test',
      label: 'Soil percolation test',
      authority: 'Contractor / Engineer',
      description: 'Sizes the soakaway to the ground. Skipping it is how soakaways fail early.',
      required: false,
    },
  ],

  solar: [
    {
      id: 'electrician_coc',
      label: 'Certificate of Compliance (electrical)',
      authority: 'Licensed electrician',
      description: 'Signed proof the installation is wired to standard. Insurers ask for this.',
      required: true,
    },
    {
      id: 'zetdc_grid_tie_approval',
      label: 'ZETDC grid-tie / net-metering approval',
      authority: 'ZETDC',
      description: 'Needed where the system feeds back into the grid rather than running islanded.',
      required: true,
      appliesWhen: (a) => a.grid_tie === true || a.system_type === 'grid_tie' || a.intent === 'grid_tie',
    },
    {
      id: 'zera_licence',
      label: 'ZERA licensing',
      authority: 'ZERA',
      description: 'Applies to larger installations and to anyone selling the power generated.',
      required: true,
      appliesWhen: isCommercial,
    },
    {
      id: 'roof_load_check',
      label: 'Roof load check',
      authority: 'Engineer / installer',
      description: 'Confirms the roof carries the array, especially on older timber structures.',
      required: false,
    },
    {
      id: 'equipment_warranties',
      label: 'Equipment warranties on file',
      authority: 'Supplier',
      description: 'Panel, inverter and battery warranties — the paperwork that matters at year three.',
      required: false,
    },
  ],

  water: [
    {
      id: 'council_plumbing_approval_water',
      label: 'Council plumbing approval',
      authority: 'City / Rural District Council',
      description: 'Applies where the tank ties into municipal supply or internal plumbing.',
      required: true,
      appliesWhen: isUrban,
    },
    {
      id: 'stand_structural_check',
      label: 'Tank stand structural check',
      authority: 'Engineer / installer',
      description: 'A full 5,000L tank weighs five tonnes. The stand has to be built for it.',
      required: false,
    },
  ],

  fencing: [
    {
      id: 'boundary_confirmation',
      label: 'Boundary confirmation',
      authority: 'Surveyor / title deed',
      description: 'Confirms the line before building on it. Fences on the wrong line get demolished.',
      required: true,
    },
    {
      id: 'council_wall_approval',
      label: 'Council approval for walls above height limit',
      authority: 'City / Rural District Council',
      description: 'Most councils cap boundary wall height without a submitted plan.',
      required: true,
      appliesWhen: isUrban,
    },
  ],

  paving: [
    {
      id: 'stormwater_drainage_approval',
      label: 'Storm-water drainage approval',
      authority: 'City / Rural District Council',
      description: 'Paving sheds water. Councils want to know where it goes before you lay it.',
      required: true,
      appliesWhen: isUrban,
    },
    {
      id: 'services_locate',
      label: 'Underground services located',
      authority: 'Council / utility',
      description: 'Water and sewer runs marked before excavation, so they are not paved over or cut.',
      required: false,
    },
  ],
};

/**
 * The requirements that actually apply to this estimate.
 *
 * Conditional entries are filtered by the answers rather than listed and
 * greyed out — a homeowner drilling for their own household should not be shown
 * a commercial abstraction licence and left to work out that it is not theirs.
 */
export function getQuickComplianceRequirements(
  projectType: ProjectType | string,
  answers: Record<string, unknown> = {},
): QuickComplianceRequirement[] {
  const all = QUICK_COMPLIANCE[projectType] ?? [];
  return all.filter((req) => !req.appliesWhen || req.appliesWhen(answers));
}

export interface ComplianceProgress {
  total: number;
  done: number;
  requiredTotal: number;
  requiredDone: number;
  /** True only when every required item is done — advisory items do not gate. */
  clear: boolean;
}

export function getComplianceProgress(
  requirements: QuickComplianceRequirement[],
  statuses: Record<string, ComplianceStatus>,
): ComplianceProgress {
  const isDone = (r: QuickComplianceRequirement) => {
    const s = statuses[r.id];
    return s === 'done' || s === 'not_applicable';
  };
  const required = requirements.filter((r) => r.required);
  const requiredDone = required.filter(isDone).length;

  return {
    total: requirements.length,
    done: requirements.filter(isDone).length,
    requiredTotal: required.length,
    requiredDone,
    // Vacuously clear when nothing is required, which is the honest answer for a
    // project type we have no gates for.
    clear: requiredDone === required.length,
  };
}

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
  not_applicable: 'Not applicable',
};
