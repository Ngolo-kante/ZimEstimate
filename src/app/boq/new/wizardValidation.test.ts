import { describe, expect, it } from 'vitest';
import { validateBOQWizardStep, type BOQWizardValidationState } from './wizardValidation';

const baseState: BOQWizardValidationState = {
  currentStep: 1,
  projectDetails: {
    name: 'Demo Project',
    locationType: 'urban',
    floorPlanSize: '120',
    buildingType: 'single_storey',
    brickType: 'common',
  },
  projectScope: 'full',
  selectedStages: ['substructure'],
  laborType: 'materials_only',
};

describe('validateBOQWizardStep', () => {
  it('returns required errors for step 1', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentStep: 1,
      projectDetails: {
        ...baseState.projectDetails,
        name: '   ',
        locationType: '',
      },
    });

    expect(result.errors.projectName).toBeDefined();
    expect(result.errors.locationType).toBeDefined();
    expect(result.message).toBe('Complete the required project details to continue.');
  });

  it('returns required errors for step 2', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentStep: 2,
      projectDetails: {
        ...baseState.projectDetails,
        floorPlanSize: '0',
        buildingType: '',
        brickType: '' as unknown as BOQWizardValidationState['projectDetails']['brickType'],
      },
    });

    expect(result.errors.floorPlanSize).toBeDefined();
    expect(result.errors.buildingType).toBeDefined();
    expect(result.errors.brickType).toBeDefined();
    expect(result.message).toBe('Complete required floor plan fields before continuing.');
  });

  it('requires at least one stage when scope is stage', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentStep: 3,
      projectScope: 'stage',
      selectedStages: [],
    });

    expect(result.errors.selectedStages).toBe('Please select at least one stage.');
    expect(result.message).toBe('Select scope details to continue.');
  });

  it('requires labor option on step 4', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentStep: 4,
      laborType: null,
    });

    expect(result.errors.laborType).toBe('Please select a labor option.');
    expect(result.message).toBe('Choose a labor option to continue.');
  });

  it('returns no errors for a valid step', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentStep: 2,
    });

    expect(result.errors).toEqual({});
    expect(result.message).toBeNull();
  });
});
