import { describe, expect, it } from 'vitest';
import candidates from './zbmsCandidates.json';
import { materials } from '../materials';

describe('ZBMS candidate suggestions', () => {
  it('covers 30 unique catalogue materials with matching units', () => {
    expect(candidates).toHaveLength(30);
    expect(new Set(candidates.map(item => item.materialId)).size).toBe(30);
    for (const item of candidates) {
      const material = materials.find(m => m.id === item.materialId);
      expect(material, item.materialId).toBeDefined();
      expect(item.ourUnit, item.materialId).toBe(material?.unit);
      expect(item.noGoodMatch).toBe(item.candidates.length === 0);
      for (const candidate of item.candidates) {
        expect(candidate.priceUsd).toBeGreaterThan(0);
        expect(candidate.factor).toBeGreaterThan(0);
        expect(candidate.url).toMatch(/^https:\/\/www.zbms.co.zw\//);
      }
    }
  });
});
