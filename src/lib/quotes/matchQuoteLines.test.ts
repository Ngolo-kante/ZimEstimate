import { describe, expect, it } from 'vitest';
import { sanitiseMatches } from './matchQuoteLines';

describe('trusting the line matcher only as far as it can be checked', () => {
  it('keeps real catalogue ids and sensible unit factors', () => {
    expect(sanitiseMatches({ matches: [{ index: 0, materialId: 'ibr-04-3m', unitFactor: 1.2 }] }, 1))
      .toEqual([{ materialId: 'ibr-04-3m', unitFactor: 1.2 }]);
  });

  it('drops an id that is not in the catalogue', () => {
    expect(sanitiseMatches({ matches: [{ index: 0, materialId: 'cement-premium-imaginary', unitFactor: 1 }] }, 1))
      .toEqual([{ materialId: null, unitFactor: null }]);
  });

  it('refuses a unit factor outside real pack and length conversions', () => {
    expect(sanitiseMatches({ matches: [{ index: 0, materialId: 'cement-325', unitFactor: 1000 }] }, 1))
      .toEqual([{ materialId: 'cement-325', unitFactor: null }]);
    expect(sanitiseMatches({ matches: [{ index: 0, materialId: 'cement-325', unitFactor: 0 }] }, 1))
      .toEqual([{ materialId: 'cement-325', unitFactor: null }]);
  });

  it('ignores out-of-range indexes and fills lines it did not answer', () => {
    const result = sanitiseMatches({ matches: [{ index: 5, materialId: 'dpc', unitFactor: 1 }, { index: 1, materialId: 'dpc', unitFactor: 1 }] }, 2);
    expect(result).toEqual([{ materialId: null, unitFactor: null }, { materialId: 'dpc', unitFactor: 1 }]);
  });

  it('treats a malformed answer as no matches', () => {
    expect(sanitiseMatches('nonsense', 2)).toEqual([{ materialId: null, unitFactor: null }, { materialId: null, unitFactor: null }]);
  });
});
