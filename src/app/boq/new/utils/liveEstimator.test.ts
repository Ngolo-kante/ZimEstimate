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
        finishLevel: 'standard', roomInputs: { ...DEFAULT_ROOM_INPUTS },
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
});
