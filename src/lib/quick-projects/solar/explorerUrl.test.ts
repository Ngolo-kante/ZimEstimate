import { describe, expect, it } from 'vitest';
import {
  decodeSolarExplorerState,
  encodeSolarExplorerState,
  type SolarExplorerState,
} from './explorerUrl';

const STATE: SolarExplorerState = {
  budget: 2500,
  objective: 'quality',
  panelBrand: 'jinko',
  inverterBrand: 'deye',
  batteryBrand: 'pylontech',
  laborPct: 0.1,
  installCustom: null,
  enabledCards: {
    panels: true,
    inverter: true,
    battery: true,
    protection: false,
    installation: true,
    transport: true,
  },
  redistribute: false,
  wiringKit: 'basic',
};

const decode = (query: string) => decodeSolarExplorerState(new URLSearchParams(query));

describe('solar explorer links', () => {
  it('rebuilds exactly the estimate that was shared', () => {
    const link = encodeSolarExplorerState(STATE);
    expect(decodeSolarExplorerState(link)).toEqual(STATE);
  });

  it("carries the installer's quote when there is one", () => {
    const link = encodeSolarExplorerState({ ...STATE, installCustom: 340 });
    expect(decodeSolarExplorerState(link).installCustom).toBe(340);
  });

  it('opens on the solar tab', () => {
    // The page picks its tab from ?mode=, so without it a shared solar link
    // opens the house estimator.
    expect(encodeSolarExplorerState(STATE).get('mode')).toBe('solar');
  });

  it('ignores brands and priorities the explorer does not offer', () => {
    const decoded = decode('panel=nonsense&inverter=&battery=tesla&priority=cheapest&wiring=gold');
    expect(decoded).toEqual({});
  });

  it('refuses budgets that are not a positive amount', () => {
    for (const budget of ['-500', '0', 'abc', '1e12', '']) {
      expect(decode(`budget=${budget}`).budget, budget).toBeUndefined();
    }
  });

  it('holds labour to the range the BOQ will charge', () => {
    // A link is editable; it must not be able to quote a rate the saved
    // estimate would clamp to something else.
    expect(decode('labour=90').laborPct).toBe(0.4);
    expect(decode('labour=1').laborPct).toBe(0.05);
    expect(decode('labour=15').laborPct).toBe(0.15);
  });

  it('treats an empty parts list as everything off, and a missing one as no choice', () => {
    expect(Object.values(decode('parts=').enabledCards ?? {}).every((on) => !on)).toBe(true);
    expect(decode('budget=1000').enabledCards).toBeUndefined();
  });

  it('survives a link cut short by a chat app', () => {
    // WhatsApp and SMS sometimes break a long URL; whatever made it through
    // should still apply.
    const full = encodeSolarExplorerState(STATE).toString();
    const truncated = full.slice(0, full.indexOf('&inverter='));
    const decoded = decode(truncated);
    expect(decoded.budget).toBe(2500);
    expect(decoded.panelBrand).toBe('jinko');
    expect(decoded.inverterBrand).toBeUndefined();
  });
});
