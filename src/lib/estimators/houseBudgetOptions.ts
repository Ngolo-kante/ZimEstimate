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
