import { describe, expect, it } from 'vitest';
import { calculateBoqHealth, type BoqHealthCategoryInput } from './boqHealth';

function withAllCategories(overrides: Partial<Record<string, string[]>>): BoqHealthCategoryInput[] {
  return [
    { category: 'substructure', itemIdsWithQty: overrides.substructure || [] },
    { category: 'superstructure', itemIdsWithQty: overrides.superstructure || [] },
    { category: 'roofing', itemIdsWithQty: overrides.roofing || [] },
    { category: 'finishing', itemIdsWithQty: overrides.finishing || [] },
    { category: 'exterior', itemIdsWithQty: overrides.exterior || [] },
  ];
}

describe('calculateBoqHealth', () => {
  it('treats alternative critical items as valid matches', () => {
    const result = calculateBoqHealth(withAllCategories({
      substructure: ['cement-425'],
    }));

    const substructure = result.categories.find((c) => c.category === 'substructure');
    expect(substructure).toBeDefined();
    expect(substructure!.matchedCritical).toBe(1);
    expect(substructure!.totalCritical).toBe(9);
  });

  it('flags high risk when weighted completion is below 40%', () => {
    const result = calculateBoqHealth(withAllCategories({
      substructure: ['cement-325', 'hardcore', 'sand-river', 'stone-19mm', 'mesh-ref193', 'dpc', 'dpm', 'termite-poison', 'brick-common'],
    }));

    expect(result.weightedScorePct).toBe(35);
    expect(result.status).toBe('high_risk');
  });

  it('flags work in progress between 40% and 90%', () => {
    const result = calculateBoqHealth(withAllCategories({
      substructure: ['cement-325', 'hardcore', 'sand-river', 'stone-19mm', 'mesh-ref193', 'dpc', 'dpm', 'termite-poison', 'brick-common'],
      roofing: ['ibr-05-3m', 'timber-50x76', 'timber-38x38', 'screws-roof', 'fascia-pvc'],
    }));

    expect(result.weightedScorePct).toBe(50);
    expect(result.status).toBe('work_in_progress');
  });

  it('flags ready for procurement only above 90%', () => {
    const result = calculateBoqHealth(withAllCategories({
      substructure: ['cement-325', 'hardcore', 'sand-river', 'stone-19mm', 'mesh-ref193', 'dpc', 'dpm', 'termite-poison', 'brick-common'],
      superstructure: ['brick-common', 'cement-325', 'sand-bricks', 'rebar-12', 'rebar-10', 'brickforce'],
      roofing: ['ibr-05-3m', 'timber-50x76', 'timber-38x38', 'screws-roof', 'fascia-pvc'],
      finishing: ['paint-pva', 'tiles-floor-ceramic', 'tile-adhesive', 'conduit-20', 'pipe-110-pvc'],
      exterior: ['durawall-panel', 'cement-325', 'sand-river'],
    }));

    expect(result.weightedScorePct).toBe(100);
    expect(result.status).toBe('ready_for_procurement');
  });
});
