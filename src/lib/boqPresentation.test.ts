import { describe, expect, it } from 'vitest';
import { boqStage, groupBoqByStage, materialsBeforeLabor } from './boqPresentation';
import { summariseSharedEstimate } from './og/sharedEstimate';

describe('BOQ labour presentation', () => {
  it('puts trades below materials in their own stage and preserves saved categories', () => {
    const lines = [
      { id: 'tiler', category: 'labor_finishing', total: 400 },
      { id: 'roofer', category: 'labor_roofing', total: 670 },
      { id: 'tiles', category: 'finishing', total: 800 },
      { id: 'food', category: 'labor', total: 100 },
      { id: 'roof', category: 'roofing', total: 1200 },
      { id: 'plasterer', category: 'labor_finishing', total: 740 },
    ];
    const snapshot = structuredClone(lines);
    const groups = groupBoqByStage(lines);
    expect(Object.keys(groups)).toEqual(['roofing', 'finishing', 'labor']);
    expect(groups.finishing.map((line) => line.id)).toEqual(['tiles', 'tiler', 'plasterer']);
    expect(groups.roofing.map((line) => line.id)).toEqual(['roof', 'roofer']);
    expect(groups.labor.map((line) => line.id)).toEqual(['food']);
    expect(groups.finishing.reduce((sum, line) => sum + line.total, 0)).toBe(1940);
    expect(Object.values(groups).flat()).toHaveLength(lines.length);
    expect(lines).toEqual(snapshot);
    expect(groups.finishing[1].category).toBe('labor_finishing');
  });

  it('does not create an empty Other labour section and supports labour-only stages', () => {
    expect(groupBoqByStage([])).toEqual({});
    expect(groupBoqByStage([{ category: 'labor_services' }])).toEqual({ services: [{ category: 'labor_services' }] });
    expect(boqStage('labor')).toBe('labor');
    expect(boqStage(null)).toBe('other');
    expect(materialsBeforeLabor([{ category: 'labor_finishing' }, { category: 'finishing' }])[0].category).toBe('finishing');
  });

  it('ignores old house percentage links while preserving the labour off toggle', () => {
    const summary = (extra: string) => summariseSharedEstimate(new URLSearchParams(`budget=12000&area=120${extra}`));
    expect(summary('&labourPct=200')).toEqual(summary(''));
    expect(summary('&labour=0&labourPct=200')).toEqual(summary('&labour=0'));
    expect(summary('&labour=0')).not.toEqual(summary(''));
  });
});
