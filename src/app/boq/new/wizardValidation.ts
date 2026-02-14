import type { BrickType } from '@/lib/vision/types';

export type BOQWizardFieldValidation = Partial<Record<
  'projectName' |
  'locationType' |
  'floorPlanSize' |
  'buildingType' |
  'brickType' |
  'projectScope' |
  'selectedStages' |
  'laborType',
  string
>>;

export type BOQWizardValidationState = {
  currentStep: number;
  projectDetails: {
    name: string;
    locationType: string;
    floorPlanSize: string;
    buildingType: string;
    brickType: BrickType;
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
    currentStep,
    projectDetails,
    projectScope,
    selectedStages,
    laborType,
  } = state;

  const errors: BOQWizardFieldValidation = {};
  let message: string | null = null;

  if (currentStep === 1) {
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

  if (currentStep === 2) {
    const floorPlanValue = Number(projectDetails.floorPlanSize);
    if (!projectDetails.floorPlanSize || !Number.isFinite(floorPlanValue) || floorPlanValue <= 0) {
      errors.floorPlanSize = 'Please enter a valid floor plan size.';
    }
    if (!projectDetails.buildingType) {
      errors.buildingType = 'Please select a building type.';
    }
    if (!projectDetails.brickType) {
      errors.brickType = 'Please select a brick or block type.';
    }
    if (errors.floorPlanSize || errors.buildingType || errors.brickType) {
      message = 'Complete required floor plan fields before continuing.';
    }
  }

  if (currentStep === 3) {
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

  if (currentStep === 4) {
    if (!laborType) {
      errors.laborType = 'Please select a labor option.';
      message = 'Choose a labor option to continue.';
    }
  }

  return { errors, message };
}
