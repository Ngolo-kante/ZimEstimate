import { describe, expect, it } from 'vitest';
import { septicFlow } from './flow';

describe('septicFlow', () => {
  it('hides tank sizing questions when the user already owns a tank', () => {
    const sizeStep = septicFlow.steps.find((step) => step.id === 'size');

    expect(sizeStep?.condition?.({ owns_tank: true })).toBe(false);
    expect(sizeStep?.condition?.({ owns_tank: false })).toBe(true);
  });

  it('returns soil-specific recommendations without requiring unused context', () => {
    const siteStep = septicFlow.steps.find((step) => step.id === 'site');
    const soilQuestion = siteStep?.questions.find((question) => question.id === 'soil_type');

    expect(soilQuestion?.recommendation?.({ soil_type: 'clay' })).toContain('larger soakaway');
    expect(soilQuestion?.recommendation?.({ soil_type: 'rock' })).toContain('Rocky sites');
    expect(soilQuestion?.recommendation?.({ soil_type: 'sandy' })).toBeNull();
  });

  it('keeps the construction method recommendation neutral by default', () => {
    const methodStep = septicFlow.steps.find((step) => step.id === 'method');
    const methodQuestion = methodStep?.questions.find((question) => question.id === 'construction_method');

    expect(methodQuestion?.recommendation?.({})).toBeNull();
  });
});
