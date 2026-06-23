import { describe, expect, it } from 'vitest';
import { solarSizingToBOQ } from './boq';
import type { SolarSizingResult, SolarWizardAnswers } from './types';

const baseResult: SolarSizingResult = {
  peakLoadWatts: 4000,
  inverterKva: 5,
  batteryKwh: 5.12,
  solarArrayKw: 2.2,
  panelCount: 5,
  dailyEnergyKwh: 9.7,
  tier: 'standard',
  estimatedCostUsd: { low: 1500, high: 1900 },
  warnings: [],
};

const baseAnswers: SolarWizardAnswers = {
  intent: 'budget',
  backupHours: null,
  location: 'Harare',
  propertyType: 'house',
  appliances: {},
  simultaneousLoads: {
    kettleMicrowave: false,
    pumpWithHouse: false,
    geyserWithHouse: false,
  },
  roof: {
    type: 'ibr',
    shading: 'none',
    orientation: 'North',
    spaceM2: 30,
  },
  existing: {
    hasExisting: false,
    inverterKva: null,
    batteryKwh: null,
    panelCount: null,
    issues: '',
  },
  budgetUsd: 2500,
  quote: {
    totalUsd: null,
    inverterKva: null,
    batteryKwh: null,
    panelCount: null,
    panelWatt: null,
    notes: '',
  },
};

describe('solarSizingToBOQ', () => {
  it('uses selected solar brands and includes optional transport and install lines', () => {
    const items = solarSizingToBOQ(baseResult, {
      ...baseAnswers,
      panel_brand: 'jinko',
      inverter_brand: 'deye',
      battery_brand: 'pylontech',
      include_transport: true,
      include_install: true,
    });

    expect(items.find((item) => item.id === 'sol_panels')?.description).toContain('Jinko');
    expect(items.find((item) => item.id === 'sol_inverter')?.description).toContain('Deye');
    expect(items.find((item) => item.id === 'sol_batteries')?.description).toContain('Pylontech');
    expect(items.find((item) => item.id === 'sol_transport')?.optional).toBe(true);
    expect(items.find((item) => item.id === 'sol_install')?.notes).toContain('ZERA');
  });

  it('marks already-owned major components as excluded from the material total', () => {
    const items = solarSizingToBOQ(baseResult, {
      ...baseAnswers,
      existing: {
        hasExisting: true,
        inverterKva: 5,
        batteryKwh: 5.12,
        panelCount: 5,
        issues: '',
      },
    });

    for (const id of ['sol_panels', 'sol_inverter', 'sol_batteries']) {
      const item = items.find((entry) => entry.id === id);
      expect(item?.owned).toBe(true);
      expect(item?.included).toBe(false);
    }
  });
});
