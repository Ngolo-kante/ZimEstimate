import { describe, expect, it } from 'vitest';
import { buildLiveMilestones } from './liveEstimator';
import { BOQ_MILESTONE_IDS, DEFAULT_ROOM_INPUTS, type BOQItem, type MilestoneData } from '@/store/boqWizardStore';
import type { BrickType, CementType } from '@/lib/vision/types';
import type { RoomInstance } from '@/app/boq/new/components/room-builder/types';
import { densityFromNotes, getCostBreakdown, OWN_FIGURE_NOTE, PROJECT_FEES, tariffLine } from '@/lib/projectFees';
import { normalizeHouseExtras } from '@/lib/houseExtras';

describe('uploaded plan in the BOQ builder', () => {
  it('prices council fees from the Harare tariff, keeps typed-in fees and follows the floor area', () => {
    const params = {
      projectDetails: {
        projectType: 'new_build', name: 'House', locationType: 'urban',
        locationCity: 'Harare', specificLocation: '', soilType: '' as const, siteSlope: '' as const,
        floorPlanSize: '120', standSize: '', buildingType: 'single_storey', wallHeight: '2.7',
        brickTypes: ['common'] as BrickType[], cementTypes: ['cement_325'] as CementType[],
        finishLevel: 'standard' as const, roofCovering: 'ibr_05' as const, roofShape: 'hipped' as const, residentialDensity: 'low' as const,
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

    // Fees are never counted as materials for labour, and carry no labour.
    expect(bigger.find((milestone) => milestone.id === 'project_fees')!.items.every((item) => !item.materialId.startsWith('labor-'))).toBe(true);
  });

  it('adds extras to a whole-house BOQ without stage labour or a second geyser, and drops them when switched off', () => {
    const extras = normalizeHouseExtras({
      septic: { enabled: true },
      borehole: { enabled: true },
      solar_geyser: { enabled: true },
      security: { enabled: true },
    });
    const params = {
      projectDetails: {
        projectType: 'new_build', name: 'House', locationType: 'urban',
        locationCity: 'Harare', specificLocation: '', soilType: '' as const, siteSlope: '' as const,
        floorPlanSize: '120', standSize: '', buildingType: 'single_storey', wallHeight: '2.7',
        brickTypes: ['common'] as BrickType[], cementTypes: ['cement_325'] as CementType[],
        finishLevel: 'standard' as const, roofCovering: 'ibr_05' as const, roofShape: 'hipped' as const, residentialDensity: 'low' as const,
        houseExtras: extras,
        roomInputs: { ...DEFAULT_ROOM_INPUTS },
      },
      geometryMode: 'quick' as const, detailedRooms: [], totalWindows: 0, totalDoors: 0,
      projectScope: 'entire' as const, selectedStages: [], laborType: 'materials_labor' as const,
      temporaryWorksSelections: [], includeSepticTank: false,
      septicDimensions: { length: '', width: '', height: '', unitPriceUsd: '' },
      previousMilestones: BOQ_MILESTONE_IDS.map((id) => ({ id, items: [], expanded: true })),
    };
    const withExtras = buildLiveMilestones(params);
    const all = withExtras.flatMap((milestone) => milestone.items);
    const exterior = withExtras.find((milestone) => milestone.id === 'exterior')!.items;
    expect(exterior.some((item) => item.materialId.startsWith('extra-septic--'))).toBe(true);
    expect(exterior.some((item) => item.materialId.startsWith('extra-borehole--'))).toBe(true);
    expect(all.some((item) => item.materialId === 'geyser-150')).toBe(false);
    expect(all.some((item) => item.materialId === 'extra-solar_geyser--geyser')).toBe(true);

    // Stage labour ignores the septic, borehole and security lines…
    const noExtras = buildLiveMilestones({ ...params, projectDetails: { ...params.projectDetails, houseExtras: normalizeHouseExtras({}) } });
    const geyserOnly = buildLiveMilestones({ ...params, projectDetails: { ...params.projectDetails, houseExtras: normalizeHouseExtras({ solar_geyser: { enabled: true } }) } });
    const stageLabour = (milestones: MilestoneData[]) => milestones.flatMap((milestone) => milestone.items)
      .filter((item) => item.materialId.startsWith('labor-')).reduce((sum, item) => sum + item.actualPriceUsd, 0);
    expect(stageLabour(withExtras)).toBeCloseTo(stageLabour(geyserOnly), 2);
    // …while the solar geyser is fitted like the geyser it replaces.
    const solarGeyser = all.find((item) => item.materialId === 'extra-solar_geyser--geyser')!;
    const electricGeyser = noExtras.flatMap((milestone) => milestone.items).find((item) => item.materialId === 'geyser-150')!;
    expect(stageLabour(geyserOnly) - stageLabour(noExtras))
      .toBeCloseTo((solarGeyser.actualPriceUsd - electricGeyser.actualPriceUsd) * 0.35, 0);

    // The septic labour line counts as labour in the cost split.
    const septicLabour = all.find((item) => item.materialId === 'extra-septic--labour')!.actualPriceUsd;
    expect(getCostBreakdown(withExtras).labor - getCostBreakdown(geyserOnly).labor).toBeCloseTo(septicLabour, 2);

    // A quote typed into an extra survives; switching it off removes its lines.
    const quoted = withExtras.map((milestone) => ({
      ...milestone,
      items: milestone.items.map((item) => item.materialId === 'extra-security--bars' ? { ...item, actualPriceUsd: 45 } : item),
    }));
    const again = buildLiveMilestones({ ...params, previousMilestones: quoted });
    expect(again.flatMap((milestone) => milestone.items).find((item) => item.materialId === 'extra-security--bars')?.actualPriceUsd).toBe(45);
    const off = buildLiveMilestones({ ...params, projectDetails: { ...params.projectDetails, houseExtras: normalizeHouseExtras({}) }, previousMilestones: again });
    expect(off.flatMap((milestone) => milestone.items).some((item) => item.materialId.startsWith('extra-'))).toBe(false);
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
        finishLevel: 'standard', roofCovering: 'ibr_05', roofShape: 'hipped', residentialDensity: 'low', roomInputs: { ...DEFAULT_ROOM_INPUTS },
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

  it('replaces a changed roof covering and keeps labour inside each stage', () => {
    const projectDetails = {
      projectType: 'new_build', name: 'Roof change', locationType: 'urban',
      locationCity: '', specificLocation: '', soilType: '' as const, siteSlope: '' as const,
      floorPlanSize: '120', standSize: '', buildingType: 'single_storey',
      wallHeight: '2.7', brickTypes: ['common'] as const, cementTypes: ['cement_325'] as const,
      finishLevel: 'standard' as const, roofCovering: 'ibr_05' as const, roofShape: 'hipped' as const, residentialDensity: 'low' as const,
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
    const roofLabour = (milestones: MilestoneData[]) => milestones.find((milestone) => milestone.id === 'roofing')!.items.filter((item) => item.materialId.startsWith('labor-'));
    const first = buildLiveMilestones(params);
    // Roof labour sits in the roofing stage, priced per m² of floor.
    expect(roofLabour(first).map((item) => [item.materialId, item.category, item.actualPriceUsd])).toEqual([['labor-roof_work', 'labor_roofing', 6.7 * 120]]);
    expect(first.find((milestone) => milestone.id === 'labor')!.items).toEqual([]);
    // Dearer sheets do not change what the roofer charges per m².
    const repriced = first.map((milestone) => milestone.id === 'roofing' ? {
      ...milestone,
      items: milestone.items.map((item) => item.materialId === 'ibr-05-3m' ? { ...item, actualPriceUsd: item.actualPriceUsd * 2 } : item),
    } : milestone);
    const refreshed = buildLiveMilestones({ ...params, previousMilestones: repriced });
    expect(roofLabour(refreshed)).toHaveLength(1);
    expect(roofLabour(refreshed)[0].actualPriceUsd).toBeCloseTo(6.7 * 120, 2);
    const changed = buildLiveMilestones({
      ...params,
      projectDetails: { ...params.projectDetails, roofCovering: 'concrete_tile' },
      previousMilestones: first,
    });
    const roofing = changed.find((milestone) => milestone.id === 'roofing')!.items;
    expect(roofing.some((item) => item.materialId === 'roof-tile-concrete')).toBe(true);
    expect(roofing.some((item) => item.materialId === 'ibr-05-3m')).toBe(false);
    expect(roofLabour(changed)).toHaveLength(1);
  });

  it('recalculates percentage labour from current material prices', () => {
    const params = {
      projectDetails: {
        projectType: 'new_build', name: 'House', locationType: 'urban',
        locationCity: 'Harare', specificLocation: '', soilType: '' as const, siteSlope: '' as const,
        floorPlanSize: '120', standSize: '', buildingType: 'single_storey', wallHeight: '2.7',
        brickTypes: ['common'] as BrickType[], cementTypes: ['cement_325'] as CementType[],
        finishLevel: 'standard' as const, roofCovering: 'ibr_05' as const, roofShape: 'hipped' as const, residentialDensity: 'low' as const,
        roomInputs: { ...DEFAULT_ROOM_INPUTS },
      },
      geometryMode: 'quick' as const, detailedRooms: [], totalWindows: 0, totalDoors: 0,
      projectScope: 'entire' as const, selectedStages: [], laborType: 'materials_labor' as const,
      temporaryWorksSelections: [], includeSepticTank: false,
      septicDimensions: { length: '', width: '', height: '', unitPriceUsd: '' },
      previousMilestones: BOQ_MILESTONE_IDS.map((id) => ({ id, items: [], expanded: true })),
    };
    const isElectrical = (id: string) => /cable|conduit|socket|switch|db-|mcb|light-/.test(id);
    const plumbing = (milestones: MilestoneData[]) => milestones.find((milestone) => milestone.id === 'services')!.items;
    const first = buildLiveMilestones(params);
    const doubled = first.map((milestone) => milestone.id === 'services' ? {
      ...milestone,
      items: milestone.items.map((item) => !item.materialId.startsWith('labor-') && !isElectrical(item.materialId) ? { ...item, actualPriceUsd: item.actualPriceUsd * 2 } : item),
    } : milestone);
    const refreshed = buildLiveMilestones({ ...params, previousMilestones: doubled });
    const materials = plumbing(refreshed).filter((item) => !item.materialId.startsWith('labor-') && !isElectrical(item.materialId))
      .reduce((sum, item) => sum + (item.quantity || 0) * item.actualPriceUsd, 0);
    const labour = plumbing(refreshed).find((item) => item.materialId === 'labor-plumbing')!;
    expect(labour.category).toBe('labor_services');
    expect(labour.actualPriceUsd).toBeCloseTo(materials * 0.35, 1);
    expect(getCostBreakdown(refreshed).labor).toBeGreaterThan(0);
  });
});
