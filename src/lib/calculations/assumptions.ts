export type LocationType = 'urban' | 'peri-urban' | 'rural';
export type BuildQuality = 'standard' | 'economy';
export type ConcreteProfile = 'structural' | 'economy';

export const DEFAULT_LOCATION_TYPE: LocationType = 'urban';

export const BOQ_ASSUMPTIONS = {
  concrete: {
    mixRatio: {
      structural: '1:2:3',
      economy: '1:2.5:3.5',
    },
    cementBagsPerM3: {
      structural: 7,
      economy: 6.5,
    },
    waste: {
      urban: 0.05,
      // Inferred midpoint because only urban/rural concrete waste was provided.
      'peri-urban': 0.065,
      rural: 0.08,
    } satisfies Record<LocationType, number>,
  },
  mortar: {
    mixRatio: {
      standard: '1:6',
      economy: '1:7',
    },
    cementBagsPerM3: {
      standard: 5,
      economy: 4.5,
    },
  },
  plaster: {
    mixRatio: {
      standard: '1:4',
      economy: '1:5',
    },
    cementBagsPerM3: {
      standard: 6,
      economy: 5,
    },
  },
  masonry: {
    unitsPerM2: {
      clayBricks: 50,
      cementBlocks: 12.5,
    },
    waste: {
      urban: 0.08,
      'peri-urban': 0.1,
      rural: 0.15,
    } satisfies Record<LocationType, number>,
  },
  roofing: {
    effectiveSheetCoverageM2: 0.85,
    waste: {
      urban: 0.1,
      'peri-urban': 0.12,
      rural: 0.15,
    } satisfies Record<LocationType, number>,
  },
  paint: {
    coveragePerLitrePerCoat: 8,
    coats: {
      standard: 2,
      economy: 1.5,
    },
  },
  tiles: {
    waste: {
      standard: 0.1,
      economy: 0.15,
    },
    adhesiveCoverageM2PerBag: 4.5,
  },
  stripFooting: {
    widthMm: {
      urban: 600,
      'peri-urban': 550,
      rural: 500,
    } satisfies Record<LocationType, number>,
    depthMm: 200,
  },
  slab: {
    thicknessMm: {
      standard: 100,
      economy: 85,
    },
  },
  walls: {
    heightM: {
      standard: 3,
      economy: 2.7,
    },
  },
  ringBeam: {
    widthMm: 230,
    depthMm: {
      standard: 150,
      economy: 125,
    },
  },
  foundation: {
    waste: {
      urban: 0.05,
      'peri-urban': 0.07,
      rural: 0.1,
    } satisfies Record<LocationType, number>,
  },
  finishes: {
    waste: {
      standard: 0.12,
      economy: 0.15,
    },
  },
} as const;

export function normalizeLocationType(locationType?: string): LocationType {
  if (locationType === 'urban' || locationType === 'peri-urban' || locationType === 'rural') {
    return locationType;
  }
  return DEFAULT_LOCATION_TYPE;
}
