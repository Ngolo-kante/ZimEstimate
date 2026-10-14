export const LABOR_SUBSTAGES = [
  { id: 'groundworks', stage: 'substructure', label: 'Groundworks & slab' },
  { id: 'foundations', stage: 'substructure', label: 'Foundations & masonry' },
  { id: 'damp_proofing', stage: 'substructure', label: 'Damp proofing & treatment' },
  { id: 'walling', stage: 'superstructure', label: 'Walling & mortar' },
  { id: 'ring_beam', stage: 'superstructure', label: 'Ring beam & reinforcement' },
  { id: 'roof_frame', stage: 'roofing', label: 'Roof structure & fascia' },
  { id: 'roof_cover', stage: 'roofing', label: 'Roof covering & fixings' },
  { id: 'plaster', stage: 'finishing', label: 'Plaster & screed' },
  { id: 'paint', stage: 'finishing', label: 'Painting' },
  { id: 'tiles', stage: 'finishing', label: 'Floor & wall tiling' },
  { id: 'joinery', stage: 'finishing', label: 'Ceilings, doors & windows' },
  { id: 'electrical', stage: 'finishing', label: 'Electrical' },
  { id: 'plumbing', stage: 'finishing', label: 'Plumbing' },
  { id: 'boundary', stage: 'exterior', label: 'Boundary works' },
  { id: 'paving', stage: 'exterior', label: 'Paving & external surfaces' },
] as const;

export type LaborSubstageId = (typeof LABOR_SUBSTAGES)[number]['id'];
export type LaborPercentages = Partial<Record<LaborSubstageId, number>>;
// A Zimbabwe contractor describes 35% of material spend as a labour rule of
// thumb. This is a starting allowance, not a measured trade rate; each work
// group can be changed by the user. Source: gravity.co.zw/2021/11/factors-
// affecting-cost-of-building-or.html (search-indexed article, checked 2026-10).
export const DEFAULT_LABOR_PERCENTAGE = 35;

export function laborSubstageFor(item: { category: string; materialId: string; materialName: string; calculationNote?: string }): LaborSubstageId | null {
  const name = `${item.materialName} ${item.calculationNote || ''}`.toLowerCase();
  const id = item.materialId.toLowerCase();
  switch (item.category) {
    case 'substructure':
      if (/dpc|dpm|termite/.test(id)) return 'damp_proofing';
      if (/foundation|footing|mortar|brick/.test(name)) return 'foundations';
      return 'groundworks';
    case 'superstructure':
      return /rebar|brickforce|ring beam|stirrup/.test(id + name) ? 'ring_beam' : 'walling';
    case 'roofing':
      return /timber|fascia/.test(id) ? 'roof_frame' : 'roof_cover';
    case 'finishing':
      if (/cable|conduit|socket|switch|db-/.test(id)) return 'electrical';
      if (/pipe|tap|toilet|bath|basin|sink/.test(id)) return 'plumbing';
      if (/paint/.test(id)) return 'paint';
      if (/tile|grout|adhesive/.test(id)) return 'tiles';
      if (/door|window|hinge|lock|ceiling|cornice/.test(id)) return 'joinery';
      return 'plaster';
    case 'exterior':
      return /pav|driveway/.test(id + name) ? 'paving' : 'boundary';
    default:
      return null;
  }
}

export function effectiveLaborPercentage(rates: LaborPercentages | undefined, id: LaborSubstageId): number {
  const value = rates?.[id];
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : DEFAULT_LABOR_PERCENTAGE;
}
