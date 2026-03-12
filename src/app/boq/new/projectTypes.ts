import type { BoqMilestoneId, ProjectScope } from '@/store/boqWizardStore';

export type ProjectTypeId =
  | 'full_house'
  | 'building_in_stages'
  // Legacy types kept for backward compat with saved projects
  | 'house_substructure'
  | 'solar'
  | 'water_tank'
  | 'roofing'
  | 'interior'
  | 'exterior'
  | 'septic_tank'
  | 'patio'
  | 'window_frames';

export type ProjectTypeConfig = {
  id: ProjectTypeId;
  label: string;
  description: string;
  scope: ProjectScope;
  stages: BoqMilestoneId[];
  requiresGeometry: boolean;
  includeSeptic?: boolean;
};

/** All 8 building stages shown in the Manual Builder stage picker */
export const MANUAL_BUILDER_STAGES: {
  id: BoqMilestoneId;
  label: string;
  description: string;
  iconKey: string;
}[] = [
  {
    id: 'substructure',
    label: 'Substructure',
    description: 'Foundation, footings & below-ground works',
    iconKey: 'cube',
  },
  {
    id: 'superstructure',
    label: 'Superstructure',
    description: 'Walls, columns, slabs & structural frame',
    iconKey: 'buildings',
  },
  {
    id: 'roofing',
    label: 'Roofing',
    description: 'Timber frame, sheets, fascia & gutters',
    iconKey: 'house-simple',
  },
  {
    id: 'finishing',
    label: 'Internal Finishes',
    description: 'Plaster, flooring, ceilings & joinery',
    iconKey: 'paint-roller',
  },
  {
    id: 'exterior',
    label: 'External Works',
    description: 'Boundary wall, paving, gate & landscaping',
    iconKey: 'tree',
  },
  {
    id: 'labor',
    label: 'Labour',
    description: 'Skilled & general labour across all trades',
    iconKey: 'hammer',
  },
];

/** The default stage order for a full house */
export const FULL_HOUSE_STAGES: BoqMilestoneId[] = MANUAL_BUILDER_STAGES.map((s) => s.id);

export const PROJECT_TYPE_CONFIG: Record<ProjectTypeId, ProjectTypeConfig> = {
  full_house: {
    id: 'full_house',
    label: 'Full House / Full Build',
    description: 'Complete build from foundation through to finishes. All stages are included and can be deselected.',
    scope: 'entire',
    stages: FULL_HOUSE_STAGES,
    requiresGeometry: true,
  },
  building_in_stages: {
    id: 'building_in_stages',
    label: 'Building in Stages',
    description: 'Select only the stages you are ready to cost now. Ideal for phased construction.',
    scope: 'stage',
    stages: FULL_HOUSE_STAGES,
    requiresGeometry: true,
  },
  // ── Legacy types (kept for backward compat with saved projects) ──────────
  house_substructure: {
    id: 'house_substructure',
    label: 'House Substructure',
    description: 'Foundation, slab, and below-ground works only.',
    scope: 'stage',
    stages: ['substructure'],
    requiresGeometry: true,
  },
  solar: {
    id: 'solar',
    label: 'Solar Installation',
    description: 'Panels, mounting, and electrical hardware.',
    scope: 'stage',
    stages: ['roofing'],
    requiresGeometry: false,
  },
  water_tank: {
    id: 'water_tank',
    label: 'Water Tank',
    description: 'Specific tank supply and installation works.',
    scope: 'stage',
    stages: ['exterior'],
    requiresGeometry: false,
  },
  roofing: {
    id: 'roofing',
    label: 'Roofing',
    description: 'Roof structure, sheets, and accessories.',
    scope: 'stage',
    stages: ['roofing'],
    requiresGeometry: true,
  },
  interior: {
    id: 'interior',
    label: 'Interior',
    description: 'Plaster, paint, ceilings, and internal finishes.',
    scope: 'stage',
    stages: ['finishing'],
    requiresGeometry: true,
  },
  exterior: {
    id: 'exterior',
    label: 'Exterior',
    description: 'Boundary works, driveways, and external finishes.',
    scope: 'stage',
    stages: ['exterior'],
    requiresGeometry: true,
  },
  septic_tank: {
    id: 'septic_tank',
    label: 'Septic Tank',
    description: 'Custom septic tank and related excavation.',
    scope: 'stage',
    stages: ['exterior'],
    requiresGeometry: false,
    includeSeptic: true,
  },
  patio: {
    id: 'patio',
    label: 'Patio',
    description: 'Patio slab, paving, and outdoor finishes.',
    scope: 'stage',
    stages: ['exterior'],
    requiresGeometry: false,
  },
  window_frames: {
    id: 'window_frames',
    label: 'Window Frames',
    description: 'Frames, glazing, and fittings.',
    scope: 'stage',
    stages: ['finishing'],
    requiresGeometry: false,
  },
};

/** Only the two types shown in the Manual Builder step 1 */
export const MANUAL_BUILDER_PROJECT_TYPES: ProjectTypeConfig[] = [
  PROJECT_TYPE_CONFIG.full_house,
  PROJECT_TYPE_CONFIG.building_in_stages,
];

/** Full list (kept for any legacy display) */
export const PROJECT_TYPE_LIST = Object.values(PROJECT_TYPE_CONFIG);

export function getProjectTypeConfig(projectType: string | null | undefined): ProjectTypeConfig | null {
  if (!projectType) {
    return null;
  }

  return PROJECT_TYPE_CONFIG[projectType as ProjectTypeId] ?? null;
}

export function inferProjectType(
  scopeRaw: string | null | undefined,
  selectedStages: string[] | null | undefined
): ProjectTypeId | '' {
  if (scopeRaw === 'entire_house' || scopeRaw === 'entire') {
    return 'full_house';
  }

  const stages = selectedStages || [];
  if (stages.length > 1) {
    return 'building_in_stages';
  }

  if (scopeRaw === 'substructure' || (stages.length === 1 && stages[0] === 'substructure')) {
    return 'house_substructure';
  }

  if (scopeRaw === 'roofing' || (stages.length === 1 && stages[0] === 'roofing')) {
    return 'roofing';
  }

  if (scopeRaw === 'finishing' || (stages.length === 1 && stages[0] === 'finishing')) {
    return 'interior';
  }

  if (scopeRaw === 'exterior' || (stages.length === 1 && stages[0] === 'exterior')) {
    return 'exterior';
  }

  return '';
}
