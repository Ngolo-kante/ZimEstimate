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
  // Separate trades with their own quotes: the Plumbing & Electrical stage.
  { id: 'electrical', stage: 'services', label: 'Electrical' },
  { id: 'plumbing', stage: 'services', label: 'Plumbing' },
  { id: 'boundary', stage: 'exterior', label: 'Boundary works' },
  { id: 'paving', stage: 'exterior', label: 'Paving & external surfaces' },
] as const;

export type LaborSubstageId = (typeof LABOR_SUBSTAGES)[number]['id'];
export type LaborStage = (typeof LABOR_SUBSTAGES)[number]['stage'];

// A Zimbabwe contractor describes 35% of material spend as a labour rule of
// thumb (gravity.co.zw/2021/11/factors-affecting-cost-of-building-or.html,
// checked 2026-10). These are the starting rates; a user can set their own per
// stage (LaborRates) when their builder charges differently.
export const STAGE_LABOR_PERCENTAGES: Record<LaborStage, number> = {
  substructure: 35,
  superstructure: 35,
  roofing: 35,
  finishing: 35,
  services: 35,
  exterior: 35,
};

export function laborSubstageFor(item: { category: string; materialId: string; materialName: string; calculationNote?: string }): LaborSubstageId | null {
  const name = `${item.materialName} ${item.calculationNote || ''}`.toLowerCase();
  const id = item.materialId.toLowerCase();
  // Extras (septic, borehole, solar…) carry their own labour where it applies;
  // a stage percentage on top would charge for it twice. The solar geyser is
  // the exception: it replaces the electric geyser and is fitted the same way.
  if (id.startsWith('extra-') && !id.startsWith('extra-solar_geyser--')) return null;
  switch (item.category) {
    case 'substructure':
      if (/dpc|dpm|termite/.test(id)) return 'damp_proofing';
      if (/foundation|footing|mortar|brick/.test(name)) return 'foundations';
      return 'groundworks';
    case 'superstructure':
      return /rebar|brickforce|ring beam|stirrup/.test(id + name) ? 'ring_beam' : 'walling';
    case 'roofing':
      return /timber|fascia|hoop|nails/.test(id) ? 'roof_frame' : 'roof_cover';
    case 'services':
      return /cable|conduit|socket|switch|db-|mcb|light-/.test(id) ? 'electrical' : 'plumbing';
    case 'finishing':
      // Saved before Plumbing & Electrical had its own stage.
      if (/cable|conduit|socket|switch|db-|mcb|light-/.test(id)) return 'electrical';
      if (/pipe|tap|toilet|bath|basin|sink|wc-|mixer|stopcock|copper|gully|geyser/.test(id)) return 'plumbing';
      if (/paint/.test(id)) return 'paint';
      if (/tile|grout|adhesive/.test(id)) return 'tiles';
      if (/door|window|hinge|lock|ceiling|cornice|glass|burglar|kitchen/.test(id)) return 'joinery';
      return 'plaster';
    case 'exterior':
      return /pav|driveway/.test(id + name) ? 'paving' : 'boundary';
    default:
      return null;
  }
}

/** A user's own labour percentages by stage. A missing stage uses the default. */
export type LaborRates = Partial<Record<LaborStage, number>>;

export const LABOR_STAGES = Object.keys(STAGE_LABOR_PERCENTAGES) as LaborStage[];
export const MAX_LABOR_PERCENTAGE = 100;

export function stageLaborPercentage(stage: LaborStage, rates?: LaborRates): number {
  const value = rates?.[stage];
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_LABOR_PERCENTAGE, Math.max(0, value))
    : STAGE_LABOR_PERCENTAGES[stage];
}

export function laborPercentageFor(id: LaborSubstageId, rates?: LaborRates): number {
  const substage = LABOR_SUBSTAGES.find((entry) => entry.id === id);
  return substage ? stageLaborPercentage(substage.stage, rates) : 0;
}

/** True when any stage differs from the default. */
export function hasCustomLaborRates(rates?: LaborRates): boolean {
  return LABOR_STAGES.some((stage) => stageLaborPercentage(stage, rates) !== STAGE_LABOR_PERCENTAGES[stage]);
}

/**
 * The rates a saved BOQ was priced at, read back from its labour lines'
 * notes ("40% of substructure materials ($…)").
 */
export function laborRatesFromNotes(lines: { materialId: string; note?: string | null }[]): LaborRates {
  const rates: LaborRates = {};
  for (const line of lines) {
    const substage = LABOR_SUBSTAGES.find((entry) => `labor-${entry.id}` === line.materialId);
    const pct = line.note?.match(/^(\d+(?:\.\d+)?)% of /)?.[1];
    if (substage && pct !== undefined && rates[substage.stage] === undefined) rates[substage.stage] = Number(pct);
  }
  return rates;
}
