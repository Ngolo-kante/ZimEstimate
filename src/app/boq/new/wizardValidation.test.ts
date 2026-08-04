import { describe, expect, it } from 'vitest';
import { validateBOQWizardStep, type BOQWizardValidationState } from './wizardValidation';

const baseState: BOQWizardValidationState = {
  currentSection: 'project',
  geometryMode: 'quick',
  projectDetails: {
    projectType: 'full_house',
    name: 'Demo Project',
    locationType: 'urban',
    floorPlanSize: '120',
    buildingType: 'single_storey',
    brickTypes: ['common'],
    finishLevel: 'standard',
  },
  projectScope: 'entire',
  selectedStages: ['substructure'],
  laborType: 'materials_only',
};

describe('validateBOQWizardStep', () => {
  it('requires project type on step 0', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentSection: 'project_type',
      projectDetails: {
        ...baseState.projectDetails,
        projectType: '',
      },
    });

    expect(result.errors.projectType).toBeDefined();
    expect(result.message).toBe('Choose a project type to continue.');
  });

  it('returns required errors for step 1', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentSection: 'project',
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
      currentSection: 'geometry',
      projectDetails: {
        ...baseState.projectDetails,
        floorPlanSize: '0',
        buildingType: '',
        brickTypes: [],
      },
    });

    expect(result.errors.floorPlanSize).toBeDefined();
    expect(result.errors.buildingType).toBeDefined();
    expect(result.errors.brickTypes).toBeDefined();
    expect(result.message).toBe('Complete required floor plan fields before continuing.');
  });

  it('requires at least one stage when scope is stage', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentSection: 'scope',
      projectScope: 'stage',
      selectedStages: [],
    });

    expect(result.errors.selectedStages).toBe('Please select at least one stage.');
    expect(result.message).toBe('Select scope details to continue.');
  });

  it('requires labor option on step 4', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentSection: 'labor',
      laborType: null,
    });

    expect(result.errors.laborType).toBe('Please select a labor option.');
    expect(result.message).toBe('Choose a labor option to continue.');
  });

  it('returns no errors for a valid step', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentSection: 'geometry',
    });

    expect(result.errors).toEqual({});
    expect(result.message).toBeNull();
  });

  it('does not require floor area when geometry mode is detailed', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentSection: 'geometry',
      geometryMode: 'detailed',
      projectDetails: {
        ...baseState.projectDetails,
        floorPlanSize: '',
      },
    });

    expect(result.errors.floorPlanSize).toBeUndefined();
  });

  it('skips geometry validation for non-geometry project types', () => {
    const result = validateBOQWizardStep({
      ...baseState,
      currentSection: 'geometry',
      projectDetails: {
        ...baseState.projectDetails,
        projectType: 'solar',
        floorPlanSize: '',
        buildingType: '',
        brickTypes: [],
      },
    });

    expect(result.errors.floorPlanSize).toBeUndefined();
    expect(result.errors.buildingType).toBeUndefined();
    expect(result.errors.brickTypes).toBeUndefined();
  });

  /**
   * Standard used to be preselected, so this question could be walked straight
   * past without being read while still moving the estimate — and neither the
   * user nor the app could tell a deliberate "standard" from a skipped step.
   */
  describe('finish level has to be answered', () => {
    it('blocks the scope step when no finish level has been chosen', () => {
      const result = validateBOQWizardStep({
        ...baseState,
        currentSection: 'scope',
        projectDetails: { ...baseState.projectDetails, finishLevel: null },
      });
      expect(result.errors.finishLevel).toBeTruthy();
      expect(result.message).toBe('Select scope details to continue.');
    });

    it('accepts "not sure" as a real answer', () => {
      // It prices as standard, but it is recorded as an assumption rather than
      // a decision — which is the honest state for most people costing a house.
      const result = validateBOQWizardStep({
        ...baseState,
        currentSection: 'scope',
        projectDetails: { ...baseState.projectDetails, finishLevel: 'not_sure' },
      });
      expect(result.errors.finishLevel).toBeUndefined();
    });

    it.each(['economy', 'standard', 'premium'])('accepts %s', (level) => {
      const result = validateBOQWizardStep({
        ...baseState,
        currentSection: 'scope',
        projectDetails: { ...baseState.projectDetails, finishLevel: level },
      });
      expect(result.errors.finishLevel).toBeUndefined();
    });

    it('does not ask for it on earlier steps', () => {
      const result = validateBOQWizardStep({
        ...baseState,
        currentSection: 'project',
        projectDetails: { ...baseState.projectDetails, finishLevel: null },
      });
      expect(result.errors.finishLevel).toBeUndefined();
    });
  });
});