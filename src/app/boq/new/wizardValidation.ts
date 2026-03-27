import type { BrickType } from '@/lib/vision/types';
import { getProjectTypeConfig } from '@/app/boq/new/projectTypes';

export type BOQWizardFieldValidation = Partial<Record<
  'projectType' |
  'projectName' |
  'locationType' |
  'floorPlanSize' |
  'buildingType' |
  'brickTypes' |
  'projectScope' |
  'selectedStages' |
  'laborType',
  string
>>;

export type BOQWizardSectionId =
  | 'project_type'
  | 'project'
  | 'geometry'
  | 'scope'
  | 'labor'
  | 'finished';

export type BOQWizardValidationState = {
  currentSection: BOQWizardSectionId;
  geometryMode: 'quick' | 'detailed' | 'upload';
  projectDetails: {
    projectType: string;
    name: string;
    locationType: string;
    floorPlanSize: string;
    buildingType: string;
    brickTypes: BrickType[];
  };
  projectScope: string;
  selectedStages: string[];
  laborType: 'materials_only' | 'materials_labor' | null;
};

export type BOQWizardValidationResult = {
  errors: BOQWizardFieldValidation;
  message: string | null;
};

export function validateBOQWizardStep(state: BOQWizardValidationState): BOQWizardValidationResult {
  const {
    currentSection,
    geometryMode,
    projectDetails,
    projectScope,
    selectedStages,
    laborType,
  } = state;

  const errors: BOQWizardFieldValidation = {};
  let message: string | null = null;

  if (currentSection === 'project_type') {
    if (!projectDetails.projectType) {
      errors.projectType = 'Please select a project type.';
      message = 'Choose a project type to continue.';
    }
  }

  if (currentSection === 'project') {
    if (!projectDetails.name.trim()) {
      errors.projectName = 'Please enter a project name.';
    }
    if (!projectDetails.locationType) {
      errors.locationType = 'Please select a location type.';
    }
    if (errors.projectName || errors.locationType) {
      message = 'Complete the required project details to continue.';
    }
  }

  if (currentSection === 'geometry') {
    const projectTypeConfig = getProjectTypeConfig(projectDetails.projectType);
    const requiresGeometry = projectTypeConfig?.requiresGeometry ?? true;

    if (requiresGeometry) {
      if (geometryMode === 'quick') {
        const floorPlanValue = Number(projectDetails.floorPlanSize);
        if (!projectDetails.floorPlanSize || !Number.isFinite(floorPlanValue) || floorPlanValue <= 0) {
          errors.floorPlanSize = 'Please enter a valid floor plan size.';
        }
      }
      if (!projectDetails.buildingType) {
        errors.buildingType = 'Please select a building type.';
      }
      if (!projectDetails.brickTypes || projectDetails.brickTypes.length === 0) {
        errors.brickTypes = 'Please select a brick or block type.';
      }
      if (geometryMode === 'upload') {
        // Stub validation for upload mode (pass through for now)
      }

      if (errors.floorPlanSize || errors.buildingType || errors.brickTypes) {
        message = 'Complete required floor plan fields before continuing.';
      }
    }
  }

  if (currentSection === 'scope') {
    if (!projectScope) {
      errors.projectScope = 'Please select a project scope.';
    }
    if (projectScope === 'stage' && selectedStages.length === 0) {
      errors.selectedStages = 'Please select at least one stage.';
    }
    if (errors.projectScope || errors.selectedStages) {
      message = 'Select scope details to continue.';
    }
  }

  if (currentSection === 'labor') {
    if (!laborType) {
      errors.laborType = 'Please select a labor option.';
      message = 'Choose a labor option to continue.';
    }
  }

  return { errors, message };
}
