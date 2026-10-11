import { describe, expect, it } from 'vitest';
import { BACKUP_LOADS, backupHours, describeBackup } from './backupHours';

const [ESSENTIALS, WITH_FRIDGE] = BACKUP_LOADS;

describe('load-shedding backup hours', () => {
  it('a single small battery covers a typical evening outage', () => {
    // 2.56 kWh is the smallest unit the explorer buys. If it could not get a
    // household through an evening, the explorer would be selling a system
    // that does not do the one thing it is for.
    expect(backupHours(2.56, WITH_FRIDGE)).toBeGreaterThanOrEqual(4);
  });

  it('runs longer without the fridge than with it', () => {
    expect(backupHours(5.12, ESSENTIALS)).toBeGreaterThan(backupHours(5.12, WITH_FRIDGE));
  });

  it('doubles, near enough, when the battery doubles', () => {
    const one = backupHours(2.56, WITH_FRIDGE);
    const two = backupHours(5.12, WITH_FRIDGE);
    expect(two).toBeGreaterThanOrEqual(one * 2 - 1);
    expect(two).toBeLessThanOrEqual(one * 2 + 1);
  });

  it('never rounds up into a promise the battery cannot keep', () => {
    // Usable energy is 81% of the label (depth of discharge, then inverter
    // losses). Whatever hours are quoted must fit inside it.
    for (const kwh of [2.56, 4.8, 5.12, 10.24, 15.36]) {
      for (const load of BACKUP_LOADS) {
        const hours = backupHours(kwh, load);
        expect((hours * load.watts) / 1000, `${kwh} kWh, ${load.label}`).toBeLessThanOrEqual(kwh * 0.81);
      }
    }
  });

  it('is zero with no battery', () => {
    expect(backupHours(0, WITH_FRIDGE)).toBe(0);
    expect(backupHours(Number.NaN, WITH_FRIDGE)).toBe(0);
  });

  it('reads naturally at the edges', () => {
    expect(describeBackup(0)).toBe('less than an hour');
    expect(describeBackup(1)).toBe('about 1 hour');
    expect(describeBackup(7)).toBe('about 7 hours');
    expect(describeBackup(30)).toBe('a full day and night');
  });
});
