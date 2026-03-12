import { useMemo } from 'react';
import type { SolarConfig } from '@/lib/database.types';

type SolarPreview = {
  panels: number;
  inverter: number;
  battery: number;
};

// Temporary UI-only heuristic for preview display.
export function useSolarPreview(config: SolarConfig): SolarPreview {
  return useMemo(() => {
    let panels = 4;
    let inverter = 3;
    let battery = 5;

    if (config.systemType === 'hybrid') {
      inverter += 2;
    }

    if (config.dailyUsage === 'moderate') {
      panels += 2;
      battery += 5;
    } else if (config.dailyUsage === 'full') {
      panels += 6;
      inverter += 3;
      battery += 10;
    }

    if (config.appliances.includes('geyser')) {
      panels += 2;
      battery += 2.5;
    }
    if (config.appliances.includes('stove')) {
      inverter += 2;
    }

    return { panels, inverter, battery };
  }, [config]);
}
