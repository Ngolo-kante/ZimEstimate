import { describe, expect, it } from 'vitest';
import { LOCATION_PROCEDURE_RULES, SOIL_RISK_PROFILES, TEMPORARY_WORKS_SUGGESTIONS } from './buildFlowRules';

describe('buildFlowRules', () => {
  it('maps rural approvals to N/A vs recommended as configured', () => {
    const cityCouncil = LOCATION_PROCEDURE_RULES.find((rule) => rule.id === 'city_council_inspection');
    const municipalWater = LOCATION_PROCEDURE_RULES.find((rule) => rule.id === 'municipal_water_connection');
    const rdcVisit = LOCATION_PROCEDURE_RULES.find((rule) => rule.id === 'rdc_site_visit');

    expect(cityCouncil?.statusByLocation.rural).toBe('not_applicable');
    expect(municipalWater?.statusByLocation.rural).toBe('not_applicable');
    expect(rdcVisit?.statusByLocation.rural).toBe('recommended');
  });

  it('marks clay soil as high risk with strong adjustment', () => {
    const clay = SOIL_RISK_PROFILES.clay_black_mountain;
    expect(clay.severity).toBe('high');
    expect(clay.adjustmentPct).toBe(20);
  });

  it('keeps loam soil at zero adjustment', () => {
    const loam = SOIL_RISK_PROFILES.loam;
    expect(loam.adjustmentPct).toBe(0);
    expect(loam.severity).toBe('low');
  });

  it('defines a temporary works suggestion pack for one-click adds', () => {
    expect(TEMPORARY_WORKS_SUGGESTIONS).toHaveLength(4);
    expect(TEMPORARY_WORKS_SUGGESTIONS.map((item) => item.id)).toEqual([
      'temp-cabin-6x3',
      'temp-toilet',
      'water-tank-50000l',
      'site-clear-level',
    ]);
  });
});
