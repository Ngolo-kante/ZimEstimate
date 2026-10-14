import { describe, expect, it } from 'vitest';
import { buildLiveMilestones } from './liveEstimator';
import { BOQ_MILESTONE_IDS, DEFAULT_ROOM_INPUTS, type BOQItem, type MilestoneData } from '@/store/boqWizardStore';
import type { BrickType, CementType } from '@/lib/vision/types';
import type { RoomInstance } from '@/app/boq/new/components/room-builder/types';
import { densityFromNotes, getCostBreakdown, OWN_FIGURE_NOTE, PROJECT_FEES, tariffLine } from '@/lib/projectFees';
import { STAGE_LABOR_PERCENTAGES } from '@/lib/calculations/laborSubstages';

describe('uploaded plan in the BOQ builder', () => {
  it('prices council fees from the Harare tariff, keeps typed-in fees and follows the floor area', () => {
    const params = {
      projectDetails: {
        projectType: 'new_build', name: 'House', locationType: 'urban',
        locationCity: 'Harare', specificLocation: '', soilType: '' as const, siteSlope: '' as const,
        floorPlanSize: '120', standSize: '', buildingType: 'single_storey', wallHeight: '2.7',
        brickTypes: ['common'] as BrickType[], cementTypes: ['cement_325'] as CementType[],
        finishLevel: 'standard' as const, roofCovering: 'ibr_05' as const, residentialDensity: 'low' as const,
        roomInputs: { ...DEFAULT_ROOM_INPUTS },
      },
      geometryMode: 'quick' as const, detailedRooms: [], totalWindows: 0, totalDoors: 0,
      projectScope: 'entire' as const, selectedStages: [], laborType: 'materials_labor' as const,
      temporaryWorksSelections: [], includeSepticTank: false,
      septicDimensions: { length: '', width: '', height: '', unitPriceUsd: '' },
      previousMilestones: BOQ_MILESTONE_IDS.map((id) => ({ id, items: [], expanded: true })),
    };
    const fee = (milestones: MilestoneData[], id: string) =>
      milestones.find((milestone) => milestone.id === 'project_fees')!.items.find((item) => item.materialId === `project-fee-${id}`)!;
    const lineTotal = (item: BOQItem) => (item.quantity || 0) * item.actualPriceUsd;

    const initial = buildLiveMilestones(params);
    expect(initial.find((milestone) => milestone.id === 'project_fees')!.items).toHaveLength(PROJECT_FEES.length);
    // 1% of 120 m² × $160/m² = $192; 6 stage visits × $30; drain $80; certificate $240.
    expect(lineTotal(fee(initial, 'council-plan-approval'))).toBe(192);
    expect(lineTotal(fee(initial, 'building-inspections'))).toBe(180);
    expect(lineTotal(fee(initial, 'drainage-inspection'))).toBe(80);
    expect(lineTotal(fee(initial, 'occupation-certificate'))).toBe(240);
    expect(fee(initial, 'architectural-drawings').actualPriceUsd).toBe(0);
    expect(getCostBreakdown(initial).fees).toBe(692);

    // The user types in a drawing quote and their own approval figure.
    const typed = initial.map((milestone) => milestone.id === 'project_fees' ? {
      ...milestone,
      items: milestone.items.map((item) =>
        item.materialId === 'project-fee-architectural-drawings' || item.materialId === 'project-fee-council-plan-approval'
          ? { ...item, actualPriceUsd: 600, description: OWN_FIGURE_NOTE, isOverridden: true }
          : item),
    } : milestone);

    // A bigger, high-density house: tariff lines follow, typed figures stay.
    const bigger = buildLiveMilestones({
      ...params,
      projectDetails: { ...params.projectDetails, floorPlanSize: '200', residentialDensity: 'high' },
      previousMilestones: typed,
    });
    expect(fee(bigger, 'architectural-drawings').actualPriceUsd).toBe(600);
    expect(fee(bigger, 'council-plan-approval').actualPriceUsd).toBe(600);
    expect(lineTotal(fee(bigger, 'building-inspections'))).toBe(120);
    expect(lineTotal(fee(bigger, 'occupation-certificate'))).toBe(150);
    expect(bigger.find((milestone) => milestone.id === 'project_fees')!.items).toHaveLength(PROJECT_FEES.length);

    // Fees are never counted as materials for labour.
    expect(bigger.find((milestone) => milestone.id === 'labor')!.items.every((item) => !/fee/i.test(item.description || ''))).toBe(true);
  });

  it('charges the double-storey rate and the minimum fee', () => {
    const basis = { floorArea: 100, density: 'low' as const, doubleStorey: true };
    expect(tariffLine('council-plan-approval', basis)!.priceUsd).toBe(240);
    expect(tariffLine('council-plan-approval', { floorArea: 40, density: 'high', doubleStorey: false })!.priceUsd).toBe(80);
    expect(tariffLine('architectural-drawings', basis)).toBeNull();
    expect(densityFromNotes([tariffLine('drainage-inspection', { ...basis, density: 'high' })!.note])).toBe('high');
  });

  it('uses detected rooms and window total for a 178m² plan', () => {
    const rooms: RoomInstance[] = Array.from({ length: 4 }, (_, index) => ({
      id: `room-${index}`,
      type: 'bedrooms',
      label: `Room ${index + 1}`,
      length: 8.9,
      width: 5,
      windows: 1,
      doors: 1,
      x: 0,
      y: 0,
      materialId: index === 0 ? 'farm-brick' : 'brick-common',
    }));

    const milestones = buildLiveMilestones({
      projectDetails: {
        projectType: 'new_build', name: 'Uploaded plan', locationType: 'urban',
        locationCity: '', specificLocation: '', soilType: '', siteSlope: '',
        floorPlanSize: '178', standSize: '', buildingType: 'single_storey',
        wallHeight: '2.7', brickTypes: ['common'], cementTypes: ['cement_325'],
        finishLevel: 'standard', roofCovering: 'ibr_05', residentialDensity: 'low', roomInputs: { ...DEFAULT_ROOM_INPUTS },
      },
      geometryMode: 'upload', detailedRooms: rooms, totalWindows: 7, totalDoors: 4,
      projectScope: 'entire', selectedStages: [], laborType: 'materials_only',
      temporaryWorksSelections: [], includeSepticTank: false,
      septicDimensions: { length: '', width: '', height: '', unitPriceUsd: '' },
      previousMilestones: BOQ_MILESTONE_IDS.map((id) => ({ id, items: [], expanded: true })),
    });

    const walls = milestones.find((milestone) => milestone.id === 'superstructure')!.items;
    const finishes = milestones.find((milestone) => milestone.id === 'finishing')!.items;
    expect(walls.some((item) => item.materialId === 'farm-brick')).toBe(true);
    expect(walls.some((item) => item.materialId === 'brick-common')).toBe(true);
    expect(finishes.find((item) => item.materialId === 'window-sill-brick')?.quantity).toBe(10.5);
    expect(finishes.find((item) => item.materialId === 'window-steel')?.description).toBe('7 windows');
    expect(finishes.find((item) => item.materialId === 'hinges-door')?.quantity).toBe(4);
  });

  it('replaces a changed roof covering and recalculates labour from current material prices', () => {
    const projectDetails = {
      projectType: 'new_build', name: 'Roof change', locationType: 'urban',
      locationCity: '', specificLocation: '', soilType: '' as const, siteSlope: '' as const,
      floorPlanSize: '120', standSize: '', buildingType: 'single_storey',
      wallHeight: '2.7', brickTypes: ['common'] as const, cementTypes: ['cement_325'] as const,
      finishLevel: 'standard' as const, roofCovering: 'ibr_05' as const, residentialDensity: 'low' as const,
      roomInputs: { ...DEFAULT_ROOM_INPUTS },
    };
    const params = {
      projectDetails: { ...projectDetails, brickTypes: [...projectDetails.brickTypes], cementTypes: [...projectDetails.cementTypes] },
      geometryMode: 'quick' as const, detailedRooms: [], totalWindows: 0, totalDoors: 0,
      projectScope: 'stage' as const, selectedStages: ['roofing'], laborType: 'materials_labor' as const,
      temporaryWorksSelections: [], includeSepticTank: false,
      septicDimensions: { length: '', width: '', height: '', unitPriceUsd: '' },
      previousMilestones: BOQ_MILESTONE_IDS.map((id) => ({ id, items: [], expanded: true })),
    };
    const first = buildLiveMilestones(params);
    const repriced = first.map((milestone) => milestone.id === 'roofing' ? {
      ...milestone,
      items: milestone.items.map((item) => item.materialId === 'ibr-05-3m' ? { ...item, actualPriceUsd: item.actualPriceUsd * 2 } : item),
    } : milestone);
    const refreshed = buildLiveMilestones({ ...params, previousMilestones: repriced });
    const repricedCover = refreshed.find((milestone) => milestone.id === 'labor')!.items.find((item) => item.materialId === 'labor-roof_cover')!;
    const refreshedRoofing = refreshed.find((milestone) => milestone.id === 'roofing')!.items;
    const refreshedCoverMaterials = refreshedRoofing.filter((item) => !/timber|fascia/.test(item.materialId));
    expect(repricedCover.actualPriceUsd).toBeCloseTo(refreshedCoverMaterials.reduce((sum, item) => sum + (item.quantity || 0) * item.actualPriceUsd, 0) * STAGE_LABOR_PERCENTAGES.roofing / 100, 2);
    const changed = buildLiveMilestones({
      ...params,
      projectDetails: { ...params.projectDetails, roofCovering: 'concrete_tile' },
      previousMilestones: first,
    });
    const roofing = changed.find((milestone) => milestone.id === 'roofing')!.items;
    expect(roofing.some((item) => item.materialId === 'roof-tile-concrete')).toBe(true);
    expect(roofing.some((item) => item.materialId === 'ibr-05-3m')).toBe(false);
    const roofCover = changed.find((milestone) => milestone.id === 'labor')!.items.find((item) => item.materialId === 'labor-roof_cover')!;
    const coverMaterials = roofing.filter((item) => item.materialId !== 'timber-50x76' && item.materialId !== 'timber-38x38' && item.materialId !== 'fascia-pvc');
    expect(roofCover.actualPriceUsd).toBeCloseTo(coverMaterials.reduce((sum, item) => sum + (item.quantity || 0) * item.actualPriceUsd, 0) * STAGE_LABOR_PERCENTAGES.roofing / 100, 2);
  });
});
