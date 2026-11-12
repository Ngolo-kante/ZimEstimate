import { describe, expect, it } from 'vitest';
import { looksMultiStorey, notAFloorPlan, otherDrawingKind, statedFloorArea } from './planFacts';

describe('statedFloorArea', () => {
  it('reads the area in a plan title', () => {
    // A real upload: the reader added the rooms up to 69–87 m².
    expect(statedFloorArea('GROUND FLOOR PLAN (area=90sqm) SCALE 1:100', 78)).toBe(90);
  });

  it('reads the common ways of writing it', () => {
    expect(statedFloorArea('TOTAL FLOOR AREA: 120 m²', 100)).toBe(120);
    expect(statedFloorArea('Floor area 145,5 m2', 130)).toBe(145.5);
    expect(statedFloorArea('Gross area = 210 sq m', 190)).toBe(210);
    expect(statedFloorArea('Total area is 96 square metres', 80)).toBe(96);
  });

  it('ignores a room stamp smaller than the rooms already read', () => {
    expect(statedFloorArea('BEDROOM 1 Area: 11.97 m² KITCHEN Area: 9.5 m²', 85)).toBeNull();
  });

  it('takes the whole-house figure over room stamps', () => {
    expect(statedFloorArea('Area: 11.97 m² Area: 14.2 m² TOTAL AREA 118 m2', 95)).toBe(118);
  });

  it('ignores areas that are not a house, and text with no area', () => {
    expect(statedFloorArea('Stand area 600 m²', 90)).toBeNull();
    expect(statedFloorArea('SITE AREA: 450 m2 FLOOR AREA: 96 m2', 85)).toBe(96);
    expect(statedFloorArea('Roof area 140 m²', 90)).toBeNull();
    expect(statedFloorArea('area = 4 m²', 0)).toBeNull();
    expect(statedFloorArea('area 12000 m²', 90)).toBeNull();
    expect(statedFloorArea('LOUNGE 5.0 x 4.5m', 22.5)).toBeNull();
  });
});

describe('looksMultiStorey', () => {
  it('sees a stair in the plan text or room names', () => {
    expect(looksMultiStorey('+3.150 BEDROOM 3 stair ABOVE ROOF LEVEL', [])).toBe(true);
    expect(looksMultiStorey('', ['Lounge', 'Staircase'])).toBe(true);
    expect(looksMultiStorey('FIRST FLOOR PLAN', [])).toBe(true);
    expect(looksMultiStorey('double storey house', [])).toBe(true);
  });

  it('does not flag a single-storey plan', () => {
    expect(looksMultiStorey('GROUND FLOOR PLAN (area=90sqm) LOUNGE KITCHEN +2.500 wallplate', ['Lounge', 'Kitchen', 'Bedroom 1'])).toBe(false);
  });
});

describe('notAFloorPlan', () => {
  const filler = 'NOTES 1. Read this drawing in conjunction with the architect. 2. Do not scale. Concrete grade 30MPa. DRAWN CHECKED DATE SCALE AS SHOWN REVISION A';

  it('turns back a structural column sheet (a real first-night upload)', () => {
    const text = `GROUND FLOOR LEVEL +3,500m +6.950m 4Y16-04 10Y10-03-200 LINKS COL C1 COL C4 COLUMNS R.C DETAIL ${filler}`;
    expect(notAFloorPlan(text)).toMatch(/structural/);
  });

  it('turns back a septic tank drawing', () => {
    expect(notAFloorPlan(`Septic Tank for 8 Persons Absorption Pit Soakaway Section AB Plan View Manhole Cover ${filler}`)).toMatch(/septic tank/);
  });

  it('turns back an elevations sheet', () => {
    expect(notAFloorPlan(`FRONT ELEVATION SIDE ELEVATION SECTION X-X roof pitch 15 ${filler}`)).toMatch(/outside views/);
  });

  it('reads anything that names a room, or says too little to tell', () => {
    expect(notAFloorPlan(`GROUND FLOOR PLAN LOUNGE KITCHEN BEDROOM 1 SECTION A-A ELEVATION ${filler}`)).toBeNull();
    expect(notAFloorPlan('COL C1 COLUMNS R.C DETAIL')).toBeNull();
    expect(notAFloorPlan(`4000 3200 2700 230 115 ${filler}`)).toBeNull();
  });
});

describe('otherDrawingKind', () => {
  const filler = 'drawing number scale date revision checked approved client project title sheet notes all dimensions in millimetres unless stated otherwise';

  it('names the sheet, for choosing what to offer next', () => {
    expect(otherDrawingKind(`SEPTIC TANK DETAIL soakaway ${filler}`)).toBe('septic');
    expect(otherDrawingKind(`COLUMN SCHEDULE reinforcement ${filler}`)).toBe('structural');
    expect(otherDrawingKind(`FRONT ELEVATION REAR ELEVATION ${filler}`)).toBe('elevations');
  });

  it('is null for a floor plan, and for too little text to tell', () => {
    expect(otherDrawingKind(`FLOOR PLAN LOUNGE KITCHEN BEDROOM septic tank ${filler}`)).toBeNull();
    expect(otherDrawingKind('SEPTIC TANK')).toBeNull();
  });
});
