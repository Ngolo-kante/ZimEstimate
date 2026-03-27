export type LocationType = 'urban' | 'peri-urban' | 'rural';
export type BuildQuality = 'standard' | 'economy';
export type ConcreteProfile = 'structural' | 'economy';

export const DEFAULT_LOCATION_TYPE: LocationType = 'urban';

const CSV_ASSUMPTION_VALUES = {
  Concrete_Cement_Bags_per_m3_Structural: 7,
  Concrete_Cement_Bags_per_m3_Economy: 6.5,
  Mortar_Cement_Bags_per_m3_Standard: 5,
  Mortar_Cement_Bags_per_m3_Economy: 4.5,
  Plaster_Cement_Bags_per_m3_Standard: 6,
  Plaster_Cement_Bags_per_m3_Economy: 5,
  Bricks_per_m2_Clay: 50,
  Blocks_per_m2_Cement: 12.5,
  Roof_Sheet_Effective_Coverage: 0.85,
  Roofing_Waste_Urban: 0.1,
  Roofing_Waste_PeriUrban: 0.12,
  Roofing_Waste_Rural: 0.15,
  Paint_Coverage_per_Litre: 8,
  Paint_Coats_Standard: 2,
  Paint_Coats_Economy: 1.5,
  Tile_Waste_Standard: 0.1,
  Tile_Waste_Economy: 0.15,
  Tile_Adhesive_Coverage: 4.5,
  Strip_Footing_Width_Urban: 600,
  Strip_Footing_Width_PeriUrban: 550,
  Strip_Footing_Width_Rural: 500,
  Strip_Footing_Depth: 200,
  Slab_Thickness_Standard: 100,
  Slab_Thickness_Economy: 85,
  Wall_Height_Standard: 3,
  Wall_Height_Economy: 2.7,
  Ring_Beam_Width: 230,
  Ring_Beam_Depth_Standard: 150,
  Ring_Beam_Depth_Economy: 125,
  Foundation_Waste_Urban: 0.05,
  Foundation_Waste_PeriUrban: 0.07,
  Foundation_Waste_Rural: 0.1,
  Concrete_Waste_Urban: 0.05,
  Concrete_Waste_Rural: 0.08,
  Masonry_Waste_Urban: 0.08,
  Masonry_Waste_PeriUrban: 0.1,
  Masonry_Waste_Rural: 0.15,
  Finishes_Waste_Standard: 0.12,
  Finishes_Waste_Economy: 0.15,
} as const;

export const BOQ_ASSUMPTIONS = {
  concrete: {
    mixRatio: {
      structural: '1:2:3',
      economy: '1:2.5:3.5',
    },
    cementBagsPerM3: {
      structural: CSV_ASSUMPTION_VALUES.Concrete_Cement_Bags_per_m3_Structural,
      economy: CSV_ASSUMPTION_VALUES.Concrete_Cement_Bags_per_m3_Economy,
    },
    waste: {
      urban: CSV_ASSUMPTION_VALUES.Concrete_Waste_Urban,
      // CSV provides only urban/rural concrete waste for this row.
      'peri-urban': 0.065,
      rural: CSV_ASSUMPTION_VALUES.Concrete_Waste_Rural,
    } satisfies Record<LocationType, number>,
  },
  mortar: {
    mixRatio: {
      standard: '1:6',
      economy: '1:7',
    },
    cementBagsPerM3: {
      standard: CSV_ASSUMPTION_VALUES.Mortar_Cement_Bags_per_m3_Standard,
      economy: CSV_ASSUMPTION_VALUES.Mortar_Cement_Bags_per_m3_Economy,
    },
  },
  plaster: {
    mixRatio: {
      standard: '1:4',
      economy: '1:5',
    },
    cementBagsPerM3: {
      standard: CSV_ASSUMPTION_VALUES.Plaster_Cement_Bags_per_m3_Standard,
      economy: CSV_ASSUMPTION_VALUES.Plaster_Cement_Bags_per_m3_Economy,
    },
  },
  masonry: {
    unitsPerM2: {
      clayBricks: CSV_ASSUMPTION_VALUES.Bricks_per_m2_Clay,
      cementBlocks: CSV_ASSUMPTION_VALUES.Blocks_per_m2_Cement,
    },
    waste: {
      urban: CSV_ASSUMPTION_VALUES.Masonry_Waste_Urban,
      'peri-urban': CSV_ASSUMPTION_VALUES.Masonry_Waste_PeriUrban,
      rural: CSV_ASSUMPTION_VALUES.Masonry_Waste_Rural,
    } satisfies Record<LocationType, number>,
  },
  roofing: {
    effectiveSheetCoverageM2: CSV_ASSUMPTION_VALUES.Roof_Sheet_Effective_Coverage,
    waste: {
      urban: CSV_ASSUMPTION_VALUES.Roofing_Waste_Urban,
      'peri-urban': CSV_ASSUMPTION_VALUES.Roofing_Waste_PeriUrban,
      rural: CSV_ASSUMPTION_VALUES.Roofing_Waste_Rural,
    } satisfies Record<LocationType, number>,
  },
  paint: {
    coveragePerLitrePerCoat: CSV_ASSUMPTION_VALUES.Paint_Coverage_per_Litre,
    coats: {
      standard: CSV_ASSUMPTION_VALUES.Paint_Coats_Standard,
      economy: CSV_ASSUMPTION_VALUES.Paint_Coats_Economy,
    },
  },
  tiles: {
    waste: {
      standard: CSV_ASSUMPTION_VALUES.Tile_Waste_Standard,
      economy: CSV_ASSUMPTION_VALUES.Tile_Waste_Economy,
    },
    adhesiveCoverageM2PerBag: CSV_ASSUMPTION_VALUES.Tile_Adhesive_Coverage,
  },
  stripFooting: {
    widthMm: {
      urban: CSV_ASSUMPTION_VALUES.Strip_Footing_Width_Urban,
      'peri-urban': CSV_ASSUMPTION_VALUES.Strip_Footing_Width_PeriUrban,
      rural: CSV_ASSUMPTION_VALUES.Strip_Footing_Width_Rural,
    } satisfies Record<LocationType, number>,
    depthMm: CSV_ASSUMPTION_VALUES.Strip_Footing_Depth,
  },
  slab: {
    thicknessMm: {
      standard: CSV_ASSUMPTION_VALUES.Slab_Thickness_Standard,
      economy: CSV_ASSUMPTION_VALUES.Slab_Thickness_Economy,
    },
  },
  walls: {
    heightM: {
      standard: CSV_ASSUMPTION_VALUES.Wall_Height_Standard,
      economy: CSV_ASSUMPTION_VALUES.Wall_Height_Economy,
    },
  },
  ringBeam: {
    widthMm: CSV_ASSUMPTION_VALUES.Ring_Beam_Width,
    depthMm: {
      standard: CSV_ASSUMPTION_VALUES.Ring_Beam_Depth_Standard,
      economy: CSV_ASSUMPTION_VALUES.Ring_Beam_Depth_Economy,
    },
  },
  foundation: {
    waste: {
      urban: CSV_ASSUMPTION_VALUES.Foundation_Waste_Urban,
      'peri-urban': CSV_ASSUMPTION_VALUES.Foundation_Waste_PeriUrban,
      rural: CSV_ASSUMPTION_VALUES.Foundation_Waste_Rural,
    } satisfies Record<LocationType, number>,
  },
  finishes: {
    waste: {
      standard: CSV_ASSUMPTION_VALUES.Finishes_Waste_Standard,
      economy: CSV_ASSUMPTION_VALUES.Finishes_Waste_Economy,
    },
  },
} as const;

export function normalizeLocationType(locationType?: string): LocationType {
  if (locationType === 'urban' || locationType === 'peri-urban' || locationType === 'rural') {
    return locationType;
  }
  return DEFAULT_LOCATION_TYPE;
}
