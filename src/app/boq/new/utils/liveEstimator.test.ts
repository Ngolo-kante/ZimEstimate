import { describe, expect, it } from 'vitest';
import { buildLiveMilestones } from './liveEstimator';
import { BOQ_MILESTONE_IDS, DEFAULT_ROOM_INPUTS } from '@/store/boqWizardStore';
import type { RoomInstance } from '@/app/boq/new/components/room-builder/types';

describe('uploaded plan in the BOQ builder', () => {
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
        finishLevel: 'standard', roofCovering: 'ibr_05', roomInputs: { ...DEFAULT_ROOM_INPUTS },
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
      finishLevel: 'standard' as const, roofCovering: 'ibr_05' as const,
      roomInputs: { ...DEFAULT_ROOM_INPUTS },
    };
    const params = {
      projectDetails: { ...projectDetails, brickTypes: [...projectDetails.brickTypes], cementTypes: [...projectDetails.cementTypes] },
      geometryMode: 'quick' as const, detailedRooms: [], totalWindows: 0, totalDoors: 0,
      projectScope: 'stage' as const, selectedStages: ['roofing'], laborType: 'materials_labor' as const,
      laborPercentages: { roof_frame: 20, roof_cover: 40 },
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
    expect(repricedCover.actualPriceUsd).toBeCloseTo(refreshedCoverMaterials.reduce((sum, item) => sum + (item.quantity || 0) * item.actualPriceUsd, 0) * 0.4, 2);
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
    expect(roofCover.actualPriceUsd).toBeCloseTo(coverMaterials.reduce((sum, item) => sum + (item.quantity || 0) * item.actualPriceUsd, 0) * 0.4, 2);
  });
});
