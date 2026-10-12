import { describe, expect, it } from 'vitest';
import { slopeLabel, soilLabel } from './siteLabels';

describe('site details in plain words', () => {
  it('never shows the stored code', () => {
    expect(soilLabel('not_sure')).toBe('Soil type unknown');
    expect(soilLabel('clay_black_mountain')).toBe('Black clay soil');
    expect(slopeLabel('gentle')).toBe('Gentle slope');
  });

  it('turns an unknown code into words rather than printing it', () => {
    expect(soilLabel('red_gravel')).toBe('Red gravel');
  });

  it('has nothing to say about a missing value', () => {
    expect(soilLabel(null)).toBeNull();
    expect(slopeLabel(undefined)).toBeNull();
  });
});
