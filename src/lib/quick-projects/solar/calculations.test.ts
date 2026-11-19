import { describe, expect, it } from 'vitest';
import { buildDefaultSelections, computeSolarSizing } from './calculations';
import type { SolarWizardAnswers } from './types';

describe('computeSolarSizing', () => {
  it('sizes lights, TV and Wi-Fi to a 1kVA inverter', () => {
    const appliances = buildDefaultSelections();
    for (const id of ['lights', 'tv', 'wifi']) {
      appliances[id] = { ...appliances[id], include: true, qty: 1, hours: 4 };
    }
    const answers: SolarWizardAnswers = {
      intent: 'backup', backupHours: 4, location: '', propertyType: null, appliances,
      simultaneousLoads: { kettleMicrowave: false, pumpWithHouse: false, geyserWithHouse: false },
      roof: { type: null, shading: null, orientation: '', spaceM2: null },
      existing: { hasExisting: false, inverterKva: null, batteryKwh: null, panelCount: null, issues: '' },
      budgetUsd: null,
      quote: { totalUsd: null, inverterKva: null, batteryKwh: null, panelCount: null, panelWatt: null, notes: '' },
    };
    expect(computeSolarSizing(answers).inverterKva).toBe(1);
  });
});
