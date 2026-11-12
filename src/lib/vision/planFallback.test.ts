import { describe, expect, it } from 'vitest';
import { isUsableFloorArea, manualBuilderPatch } from './planFallback';

describe('carrying on in the manual builder', () => {
  it('takes the floor area just typed, rounded to a tenth', () => {
    expect(manualBuilderPatch({ floorAreaM2: 120.46 }, { name: '', specificLocation: '' })).toEqual({ floorPlanSize: '120.5' });
  });

  it('fills the name and place only where the draft has none', () => {
    expect(manualBuilderPatch({ name: ' Borrowdale house ', location: 'Harare' }, { name: '', specificLocation: '' }))
      .toEqual({ name: 'Borrowdale house', specificLocation: 'Harare' });
    expect(manualBuilderPatch({ name: 'New', location: 'Harare' }, { name: 'My draft', specificLocation: 'Gweru' })).toEqual({});
  });

  it('leaves the draft alone when there is nothing usable to add', () => {
    expect(manualBuilderPatch({ floorAreaM2: 0 }, { name: '', specificLocation: '' })).toEqual({});
    expect(manualBuilderPatch({ floorAreaM2: Number.NaN, name: '  ' }, { name: '', specificLocation: '' })).toEqual({});
  });

  it('accepts only areas a house could have', () => {
    expect(isUsableFloorArea(120)).toBe(true);
    expect(isUsableFloorArea(9)).toBe(false);
    expect(isUsableFloorArea(2001)).toBe(false);
    expect(isUsableFloorArea(undefined)).toBe(false);
    expect(isUsableFloorArea(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
