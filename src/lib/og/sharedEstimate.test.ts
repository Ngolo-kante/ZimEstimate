import { describe, expect, it } from 'vitest';
import { summariseSharedEstimate } from './sharedEstimate';
import { encodeSolarExplorerState, SOLAR_EXPLORER_DEFAULTS } from '@/lib/quick-projects/solar/explorerUrl';
import { encodeBoreholeExplorerState } from '@/lib/quick-projects/borehole/explorerUrl';
import { allocateBudget } from '@/lib/quick-projects/solar/allocateBudget';
import { BATTERY_BRANDS, INVERTER_BRANDS, PANEL_BRANDS } from '@/lib/quick-projects/solar/catalog';
import { estimateStageReach } from '@/lib/estimators/stageBudgetEstimator';
import { HOUSE_PROFILES } from '@/lib/estimators/houseBudgetOptions';

/**
 * The preview card is the first thing a WhatsApp recipient sees. If it says
 * something different from the page it opens, the share has lied to them —
 * so these check the card against the page's own calculations.
 */

describe('link preview for a shared estimate', () => {
  it('describes the same solar system the page builds from that link', () => {
    const link = encodeSolarExplorerState({ ...SOLAR_EXPLORER_DEFAULTS, budget: 2500 });
    const summary = summariseSharedEstimate(link);

    const page = allocateBudget({
      totalBudget: 2500,
      panelBrand: PANEL_BRANDS.find((b) => b.brand === 'ja_solar')!,
      inverterBrand: INVERTER_BRANDS.find((b) => b.brand === 'must')!,
      batteryBrand: BATTERY_BRANDS.find((b) => b.brand === 'dyness')!,
      enabledCards: SOLAR_EXPLORER_DEFAULTS.enabledCards,
      objective: SOLAR_EXPLORER_DEFAULTS.objective,
      installCustom: null,
      laborPct: SOLAR_EXPLORER_DEFAULTS.laborPct,
      redistribute: true,
      wiringKit: 'full',
    });
    const kw = ((page.panels.count * 440) / 1000).toFixed(1);

    expect(summary?.headline).toBe('What $2,500 buys in solar');
    expect(summary?.lines[0]).toBe(`${kw} kW of panels · ${page.inverter.kva} kVA inverter`);
    expect(summary?.lines[1]).toContain(`${(page.battery.units * page.battery.brand.unitKwh).toFixed(1)} kWh battery`);
  });

  it('describes the same house estimate the page shows', () => {
    const summary = summariseSharedEstimate(new URLSearchParams('budget=12000&area=120&loc=rural&profile=economy'));
    const page = estimateStageReach({
      budgetUsd: 12000,
      floorAreaM2: 120,
      locationType: 'rural',
      wallHeightM: HOUSE_PROFILES.economy.wallHeightM,
      cementTypes: [HOUSE_PROFILES.economy.cementType],
    });
    expect(summary?.headline).toBe('How far $12,000 goes on a 120\u00a0m² house');
    expect(summary?.lines[0]).toBe(`Reaches: ${page.reachableStageLabel}`);
    expect(summary?.lines[1]).toContain(`${Math.round(page.coveragePercent)}%`);
  });

  it('says so when the budget covers the whole build, rather than "100% of"', () => {
    const summary = summariseSharedEstimate(new URLSearchParams('budget=25000&area=120&loc=rural&profile=economy'));
    expect(summary?.lines[1]).toMatch(/^Covers the full build/);
  });

  it('says plainly when a house budget does not reach the foundation', () => {
    const summary = summariseSharedEstimate(new URLSearchParams('budget=200&area=200'));
    expect(summary?.lines[0]).toBe('Not yet enough for the foundation');
    expect(summary?.description).not.toMatch(/through/);
  });

  it('names hand-picked borehole components, and fits them to the budget otherwise', () => {
    const base = {
      budget: 6500,
      depth: 65,
      purpose: 'domestic' as const,
      location: 'bulawayo',
      enabledCards: { drilling: true, casing: true, pump: true, tank: true, services: true, permits: true, transport: true },
      pumpType: 'hybrid' as const,
      casingGrade: 'class_9' as const,
      tankSize: 'none' as const,
      useCombo: false,
    };
    const picked = summariseSharedEstimate(encodeBoreholeExplorerState({ ...base, userPickedComponents: true }));
    expect(picked?.lines).toEqual(['65 m deep · Bulawayo', 'Hybrid AC/DC pump · Class 9 — mid-grade casing']);

    const fitted = summariseSharedEstimate(encodeBoreholeExplorerState({ ...base, userPickedComponents: false }));
    expect(fitted?.lines[0]).toBe('65 m deep · Bulawayo');
    expect(fitted?.lines[1]).not.toContain('Hybrid');
  });

  it('falls back to the site preview when the link describes no estimate', () => {
    expect(summariseSharedEstimate(new URLSearchParams(''))).toBeNull();
    expect(summariseSharedEstimate(new URLSearchParams('mode=solar'))).toBeNull();
    expect(summariseSharedEstimate(new URLSearchParams('mode=fencing&budget=2000'))).toBeNull();
    expect(summariseSharedEstimate(new URLSearchParams('budget=abc'))).toBeNull();
  });
});
