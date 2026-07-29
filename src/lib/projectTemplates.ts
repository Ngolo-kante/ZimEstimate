import type { BrickType, CementType, ProjectScope } from '@/lib/vision/types';
import { generateBOQFromBasics, normalizeFinishLevel, type FinishLevel } from '@/lib/calculations';
import { getBestPrice } from '@/lib/materials';
import type { LocationType } from '@/lib/calculations/assumptions';

/**
 * Templates are described by their inputs rather than by a price.
 *
 * They used to carry hardcoded totals — a 3-bedroom 120m² was listed at $28,000,
 * or $233/m², while the calculator produced $191/m² for the same house. The two
 * figures had no relationship to each other, and picking a card dropped the user
 * into an empty wizard because nothing read the template parameter. Pricing a
 * template through the generator keeps the card and the resulting BOQ in step.
 */
export type TemplateCategory = 'residential' | 'commercial' | 'exterior';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  popularity?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqm: number;
  /**
   * Room breakdown written into the wizard. getRoomCount() in the live estimator
   * sums these, so priceTemplate derives its roomCount from the same numbers —
   * otherwise the card and the generated BOQ disagree.
   */
  rooms: { bedrooms: number; bathrooms: number; livingRoom: number; kitchen: number };
  brickType: BrickType;
  cementType: CementType;
  locationType: LocationType;
  /** An array lets a template opt out of stages — a cottage has no boundary wall. */
  scope: ProjectScope | ProjectScope[];
  includeLabor: boolean;
  standAreaSqm?: number;
  /** Offered finish levels. A single entry fixes the template's finish. */
  finishLevels: FinishLevel[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'tpl-3bed-standard',
    name: '3-Bedroom House',
    description: 'Common cement bricks, IBR roofing, tiled floors',
    category: 'residential',
    popularity: 'Most Popular',
    bedrooms: 3,
    bathrooms: 2,
    sqm: 120,
    rooms: { bedrooms: 3, bathrooms: 2, livingRoom: 1, kitchen: 1 },
    brickType: 'common',
    cementType: 'cement_325',
    locationType: 'urban',
    scope: 'full_house',
    includeLabor: true,
    standAreaSqm: 600,
    finishLevels: ['economy', 'standard'],
  },
  {
    id: 'tpl-4bed-standard',
    name: '4-Bedroom House',
    description: 'Common cement bricks, IBR roofing, standard finishes',
    category: 'residential',
    bedrooms: 4,
    bathrooms: 2,
    sqm: 160,
    rooms: { bedrooms: 4, bathrooms: 2, livingRoom: 1, kitchen: 1 },
    brickType: 'common',
    cementType: 'cement_325',
    locationType: 'urban',
    scope: 'full_house',
    includeLabor: true,
    standAreaSqm: 800,
    finishLevels: ['economy', 'standard'],
  },
  {
    id: 'tpl-4bed-premium',
    name: '4-Bedroom House (Premium)',
    description: 'Face bricks, 42.5 cement, premium finishes throughout',
    category: 'residential',
    popularity: 'Premium',
    bedrooms: 4,
    bathrooms: 3,
    sqm: 200,
    rooms: { bedrooms: 4, bathrooms: 3, livingRoom: 1, kitchen: 1 },
    brickType: 'face_brick',
    cementType: 'cement_425',
    locationType: 'urban',
    scope: 'full_house',
    includeLabor: true,
    standAreaSqm: 1000,
    finishLevels: ['premium'],
  },
  {
    id: 'tpl-5bed-executive',
    name: '5-Bedroom Executive House',
    description: 'Face bricks, high-end finishes, larger stand',
    category: 'residential',
    bedrooms: 5,
    bathrooms: 4,
    sqm: 280,
    rooms: { bedrooms: 5, bathrooms: 4, livingRoom: 2, kitchen: 1 },
    brickType: 'face_brick',
    cementType: 'cement_425',
    locationType: 'urban',
    scope: 'full_house',
    includeLabor: true,
    standAreaSqm: 2000,
    finishLevels: ['premium'],
  },
  {
    id: 'tpl-cottage',
    name: 'Staff / Rental Cottage',
    description: '1-bed cottage with kitchenette and bathroom',
    category: 'residential',
    bedrooms: 1,
    bathrooms: 1,
    sqm: 35,
    rooms: { bedrooms: 1, bathrooms: 1, livingRoom: 1, kitchen: 1 },
    brickType: 'common',
    cementType: 'cement_325',
    locationType: 'urban',
    // A cottage goes up on a stand that already has its boundary and gates, so
    // exterior works are excluded rather than charged again.
    scope: ['substructure', 'superstructure', 'roofing', 'finishing'],
    includeLabor: true,
    finishLevels: ['economy', 'standard'],
  },
];

/** Total rooms, matching how the live estimator sums the wizard's room inputs. */
export function templateRoomCount(template: ProjectTemplate): number {
  const { bedrooms, bathrooms, livingRoom, kitchen } = template.rooms;
  return bedrooms + bathrooms + livingRoom + kitchen;
}

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === id);
}

/** Falls back to the template's first offered level when the request is not on offer. */
export function resolveFinishLevel(template: ProjectTemplate, requested?: string): FinishLevel {
  const normalized = normalizeFinishLevel(requested);
  return template.finishLevels.includes(normalized) ? normalized : template.finishLevels[0];
}

/**
 * Price a template through the generator the wizard uses, so the figure shown on
 * the card is the total the user lands on.
 */
export function priceTemplate(template: ProjectTemplate, finishLevel: FinishLevel): number {
  const items = generateBOQFromBasics({
    floorArea: template.sqm,
    roomCount: templateRoomCount(template),
    wallHeight: 2.7,
    brickTypes: [template.brickType],
    cementTypes: [template.cementType],
    scope: template.scope,
    includeLabor: template.includeLabor,
    locationType: template.locationType,
    finishLevel,
    standAreaSqm: template.standAreaSqm,
  });

  return items.reduce(
    (sum, item) => sum + (getBestPrice(item.materialId)?.priceUsd ?? 0) * item.quantity,
    0
  );
}
