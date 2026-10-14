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
export type LaborStage = (typeof LABOR_SUBSTAGES)[number]['stage'];

// A Zimbabwe contractor describes 35% of material spend as a labour rule of
// thumb (gravity.co.zw/2021/11/factors-affecting-cost-of-building-or.html,
// checked 2026-10). Each stage has its own fixed rate so they can differ once
// we have better figures; users do not edit them.
export const STAGE_LABOR_PERCENTAGES: Record<LaborStage, number> = {
  substructure: 35,
  superstructure: 35,
  roofing: 35,
  finishing: 35,
  exterior: 35,
};

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

export function laborPercentageFor(id: LaborSubstageId): number {
  const substage = LABOR_SUBSTAGES.find((entry) => entry.id === id);
  return substage ? STAGE_LABOR_PERCENTAGES[substage.stage] : 0;
}
