import { SOLAR_APPLIANCES } from './catalog';

/**
 * How long a battery keeps the house going when ZESA is off.
 *
 * Load-shedding is why most people here buy solar, and "5.1 kWh" means nothing
 * to most of them. "Lights, TV and fridge for about 12 hours" is the question
 * they are actually asking.
 *
 * Wattages come from SOLAR_APPLIANCES, the same figures the full solar wizard
 * sizes systems with, so the two cannot tell someone different stories.
 */

const watts = (id: string) => {
  const appliance = SOLAR_APPLIANCES.find((a) => a.id === id);
  if (!appliance) throw new Error(`SOLAR_APPLIANCES has no "${id}"`);
  return appliance.watts;
};

/* A fridge's compressor cycles; it does not draw its running watts all night.
   40% is a typical duty cycle for a household fridge, and on the cautious
   side — a figure that runs out early is worse than one that runs long. */
const FRIDGE_DUTY_CYCLE = 0.4;

/* LiFePO4 can go to 90-95% depth of discharge (the page's own stated
   assumption — the cautious end is used), and a hybrid inverter loses roughly
   another 10% turning battery DC into household AC. */
const USABLE_FRACTION = 0.9 * 0.9;

export interface BackupLoad {
  label: string;
  /** Average draw in watts. */
  watts: number;
}

/** What people keep on during load-shedding, lightest first. */
export const BACKUP_LOADS: BackupLoad[] = [
  {
    label: 'lights, TV and WiFi',
    watts: 6 * watts('lights') + watts('tv') + watts('wifi') + watts('phone_charger'),
  },
  {
    label: 'lights, TV, WiFi and the fridge',
    watts:
      6 * watts('lights') + watts('tv') + watts('wifi') + watts('phone_charger') +
      watts('fridge') * FRIDGE_DUTY_CYCLE,
  },
];

/** Whole hours, rounded down: a promise of 7 hours that lasts 6.6 is broken. */
export function backupHours(batteryKwh: number, load: BackupLoad): number {
  if (!(batteryKwh > 0) || !(load.watts > 0)) return 0;
  return Math.floor((batteryKwh * USABLE_FRACTION * 1000) / load.watts);
}

/** "about 12 hours", or a fuller phrase where a number would mislead. */
export function describeBackup(hours: number): string {
  if (hours <= 0) return 'less than an hour';
  if (hours >= 24) return 'a full day and night';
  return `about ${hours} hour${hours === 1 ? '' : 's'}`;
}
