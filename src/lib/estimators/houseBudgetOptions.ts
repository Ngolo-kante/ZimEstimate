/**
 * The house Budget Estimator's options and starting values.
 *
 * Shared by the page and by the WhatsApp link preview, which has to work out
 * the same estimate from a link's parameters. They used to be defined inside
 * the page, where the preview could not reach them; a second copy would drift,
 * and the preview card would then promise a different estimate from the page
 * it opens.
 */

export const HOUSE_LOCATIONS = ['urban', 'peri-urban', 'rural'] as const;
export type HouseLocation = (typeof HOUSE_LOCATIONS)[number];

export const HOUSE_LOCATION_LABELS: Record<HouseLocation, string> = {
  urban: 'Urban',
  'peri-urban': 'Peri-urban',
  rural: 'Rural',
};

/**
 * Wall bricks. Farm bricks, burnt locally, are what most rural and peri-urban
 * houses are built in, at about $45 per thousand delivered against the city's
 * $110 common bricks; picking either of those areas starts on farm bricks.
 */
export const HOUSE_BRICKS = ['common', 'farm'] as const;
export type HouseBrick = (typeof HOUSE_BRICKS)[number];

export const HOUSE_BRICK_LABELS: Record<HouseBrick, string> = {
  common: 'Common bricks',
  farm: 'Farm bricks',
};

export function defaultBrickFor(location: HouseLocation): HouseBrick {
  return location === 'urban' ? 'common' : 'farm';
}

/** The brick in a link, or the area's usual one when the link has none. */
export function brickFromParam(raw: string | null | undefined, location: HouseLocation): HouseBrick {
  return HOUSE_BRICKS.includes(raw as HouseBrick) ? (raw as HouseBrick) : defaultBrickFor(location);
}

export const HOUSE_FLOORS = [1, 2] as const;
export type HouseFloors = (typeof HOUSE_FLOORS)[number];
export const HOUSE_FLOOR_LABELS: Record<HouseFloors, string> = {
  1: 'Single storey',
  2: 'Double storey',
};

/** Missing or unrecognised floor choices keep existing single-storey links. */
export function floorsFromParam(raw: string | null | undefined): HouseFloors {
  return raw === '2' ? 2 : 1;
}

export const HOUSE_PROFILES = {
  standard: { label: 'Standard Build', wallHeightM: 3.0, cementType: 'cement_425' as const },
  economy: { label: 'Economy Build', wallHeightM: 2.7, cementType: 'cement_325' as const },
};
export type HouseProfile = keyof typeof HOUSE_PROFILES;

export const HOUSE_DEFAULTS = {
  budget: 15000,
  area: 120,
  location: 'urban' as HouseLocation,
  profile: 'standard' as HouseProfile,
};
