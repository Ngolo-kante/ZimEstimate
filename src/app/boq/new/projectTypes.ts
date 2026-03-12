import type { BoqMilestoneId, ProjectScope } from '@/store/boqWizardStore';

export type ProjectTypeId =
  | 'full_house'
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

export const PROJECT_TYPE_CONFIG: Record<ProjectTypeId, ProjectTypeConfig> = {
  full_house: {
    id: 'full_house',
    label: 'Full House',
    description: 'Full build from foundation to exterior finishes.',
    scope: 'entire',
    stages: ['substructure', 'superstructure', 'roofing', 'finishing', 'exterior'],
    requiresGeometry: true,
  },
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
  if (scopeRaw === 'entire_house') {
    return 'full_house';
  }

  if (scopeRaw === 'substructure') {
    return 'house_substructure';
  }

  if (scopeRaw === 'roofing') {
    return 'roofing';
  }

  if (scopeRaw === 'finishing') {
    return 'interior';
  }

  if (scopeRaw === 'exterior') {
    return 'exterior';
  }

  const stages = selectedStages || [];
  if (stages.length === 1) {
    const stage = stages[0];
    if (stage === 'substructure') return 'house_substructure';
    if (stage === 'roofing') return 'roofing';
    if (stage === 'finishing') return 'interior';
    if (stage === 'exterior') return 'exterior';
  }

  return '';
}
