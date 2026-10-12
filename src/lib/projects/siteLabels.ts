/**
 * Plain words for the site details stored as codes. One map for every page
 * that shows them: three pages kept their own, none knew "not_sure", and the
 * project card and Insights printed the raw code.
 */

const SOIL: Record<string, string> = {
  sandy: 'Sandy soil',
  clay_black_mountain: 'Black clay soil',
  loam: 'Loam soil',
  rock: 'Rocky ground',
  not_sure: 'Soil type unknown',
};

const SLOPE: Record<string, string> = {
  flat: 'Flat site',
  gentle: 'Gentle slope',
  moderate: 'Moderate slope',
  steep: 'Steep site',
  not_sure: 'Slope unknown',
};

const readable = (code: string) => code.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const soilLabel = (code: string | null | undefined): string | null => (code ? SOIL[code] ?? readable(code) : null);
export const slopeLabel = (code: string | null | undefined): string | null => (code ? SLOPE[code] ?? readable(code) : null);
