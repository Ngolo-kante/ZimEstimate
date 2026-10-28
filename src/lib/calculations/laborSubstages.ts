/**
 * Labour by trade, priced the way builders in Zimbabwe quote it.
 *
 * Until 2026-10-19 every trade was a percentage of its materials. That read
 * badly and priced badly: plaster's cement and sand are cheap, so a normal
 * plastering fee showed as "200%", while 35% of expensive doors and windows
 * charged ~$2,000 for fitting that builders include in their walling price.
 * Builders quote per m² of floor, per m² tiled, per metre of wall, so each
 * trade now has its own unit. Only trades with no local quote yet, and the
 * plumbers and electricians who quote separately, stay a percentage.
 *
 * Rates are from the "Let's Build Our Homes - Zimbabwe" groups, October 2026
 * (research/facebook-building-market). They are leads, not checked quotes, and
 * every one can be changed in the BOQ.
 */

export type LaborBasis = 'floor_m2' | 'tiled_m2' | 'ceiling_m2' | 'boundary_m' | 'percent';

export const LABOR_SUBSTAGES = [
  {
    id: 'to_slab', stage: 'substructure', label: 'Setting out to slab', basis: 'floor_m2', rate: 12,
    includes: 'Setting out, trenches, footings, foundation brickwork and the slab',
    source: 'Real builds: $12–14 per m² of floor to slab (Bulawayo 300 m², Harare 103 m²)',
  },
  {
    id: 'to_wall_plate', stage: 'superstructure', label: 'Slab to wall plate', basis: 'floor_m2', rate: 14,
    includes: 'Brickwork, building in door and window frames, lintels and the ring beam',
    source: 'Real builds: $14–33 per m² of floor to wall plate in all, median about $26',
  },
  {
    id: 'roof_work', stage: 'roofing', label: 'Roof carpentry & covering', basis: 'floor_m2', rate: 6.7,
    includes: 'Cutting and fixing trusses, fascia, sheets or tiles',
    source: 'A 300 m² hipped roof for $2,000',
  },
  {
    id: 'plastering', stage: 'finishing', label: 'Plaster & screed', basis: 'floor_m2', rate: 7.4,
    includes: 'Plaster inside and out, reveals and the floor screed',
    source: 'Five plastering bids: $6.50–17 per m² of floor, median $7.40',
  },
  {
    id: 'tiling', stage: 'finishing', label: 'Floor & wall tiling', basis: 'tiled_m2', rate: 4,
    includes: 'Laying floor and wall tiles',
    source: 'Tilers advertise $3–5 per m², by tile size',
  },
  {
    id: 'ceilings', stage: 'finishing', label: 'Ceilings', basis: 'ceiling_m2', rate: 5,
    includes: 'Fixing ceiling boards and cornices',
    source: 'Ceiling fitters: $5 per m² labour only',
  },
  {
    id: 'paint', stage: 'finishing', label: 'Painting', basis: 'percent', rate: 35,
    includes: 'Painting walls and ceilings',
    source: 'No local quote yet: the 35% rule of thumb',
  },
  // Separate trades with their own quotes: the Plumbing & Electrical stage.
  {
    id: 'electrical', stage: 'services', label: 'Electrical', basis: 'percent', rate: 35,
    includes: 'Wiring, sockets, switches and the board',
    source: 'Electricians quote separately: the 35% rule of thumb',
  },
  {
    id: 'plumbing', stage: 'services', label: 'Plumbing', basis: 'percent', rate: 35,
    includes: 'Pipes, drainage and fitting sanitaryware',
    source: 'Plumbers quote separately: the 35% rule of thumb',
  },
  {
    id: 'boundary_wall', stage: 'exterior', label: 'Boundary wall', basis: 'boundary_m', rate: 20,
    includes: 'Putting up the boundary wall',
    source: 'About $20 a metre; 100 m of durawall costs $3,500–5,000 installed',
  },
  {
    id: 'paving', stage: 'exterior', label: 'Paving', basis: 'percent', rate: 35,
    includes: 'Laying the driveway and apron',
    source: 'No local quote yet: the 35% rule of thumb',
  },
] as const satisfies ReadonlyArray<{
  id: string; stage: string; label: string; basis: LaborBasis; rate: number; includes: string; source: string;
}>;

export type LaborSubstageId = (typeof LABOR_SUBSTAGES)[number]['id'];
export type LaborStage = (typeof LABOR_SUBSTAGES)[number]['stage'];
export type LaborSubstage = (typeof LABOR_SUBSTAGES)[number];

/** A BOQ line's category for a stage's labour: labour sits inside its stage. */
export type LaborCategory = `labor_${LaborStage}`;
export const laborCategoryFor = (stage: LaborStage): LaborCategory => `labor_${stage}`;

/** True for labour lines: per-stage ones, and 'labor' from BOQs saved before 2026-10-19. */
export function isLaborCategory(category: string | null | undefined): boolean {
  return category === 'labor' || (typeof category === 'string' && category.startsWith('labor_'));
}

/** The stage a labour category belongs to, or null for the old single 'labor' section. */
export function stageOfLaborCategory(category: string): LaborStage | null {
  const stage = category.startsWith('labor_') ? category.slice('labor_'.length) : '';
  return LABOR_SUBSTAGES.some((entry) => entry.stage === stage) ? (stage as LaborStage) : null;
}

// Trade ids from the percentage model (before 2026-10-19), for recognising
// generated labour lines in BOQs saved then.
const OLD_TRADE_IDS = ['groundworks', 'foundations', 'damp_proofing', 'walling', 'ring_beam', 'roof_frame', 'roof_cover', 'plaster', 'tiles', 'joinery', 'boundary'];

/**
 * A labour line the calculator generates for a trade (labor-plastering), old
 * or new, as opposed to one a person added, such as labor-foreman.
 */
export function isTradeLaborLine(materialId: string | null | undefined): boolean {
  const trade = materialId?.startsWith('labor-') ? materialId.slice('labor-'.length) : '';
  return LABOR_SUBSTAGES.some((entry) => entry.id === trade) || OLD_TRADE_IDS.includes(trade);
}

export const LABOR_STAGES = [...new Set(LABOR_SUBSTAGES.map((entry) => entry.stage))] as LaborStage[];

/** The trade whose labour a material line needs, or null when its fitting is in another price. */
export function laborSubstageFor(item: { category: string; materialId: string; materialName: string; calculationNote?: string }): LaborSubstageId | null {
  const name = `${item.materialName} ${item.calculationNote || ''}`.toLowerCase();
  const id = item.materialId.toLowerCase();
  // Extras (septic, borehole, solar…) carry their own labour where it applies;
  // charging labour on top would count it twice. The solar geyser is the
  // exception: it replaces the electric geyser and is fitted the same way.
  if (id.startsWith('extra-') && !id.startsWith('extra-solar_geyser--')) return null;
  switch (item.category) {
    case 'substructure':
      return 'to_slab';
    case 'superstructure':
      return 'to_wall_plate';
    case 'roofing':
      return 'roof_work';
    case 'services':
      return /cable|conduit|socket|switch|db-|mcb|light-/.test(id) ? 'electrical' : 'plumbing';
    case 'finishing':
      // Saved before Plumbing & Electrical had its own stage.
      if (/cable|conduit|socket|switch|db-|mcb|light-/.test(id)) return 'electrical';
      if (/pipe|tap|toilet|bath|basin|sink|wc-|mixer|stopcock|copper|gully|geyser/.test(id)) return 'plumbing';
      if (/paint/.test(id)) return 'paint';
      if (/tile|grout|adhesive/.test(id)) return 'tiling';
      if (/ceiling|cornice/.test(id)) return 'ceilings';
      // Builders hang doors and windows as part of their price, and kitchen
      // units and burglar bars come fitted by whoever supplies them.
      if (/door|window|hinge|lock|glass|burglar|kitchen/.test(id)) return null;
      return 'plastering';
    case 'exterior':
      // Gates go with the wall; the vehicle gate's note says "driveway".
      if (id.startsWith('gate-')) return 'boundary_wall';
      return /pav|driveway/.test(id + name) ? 'paving' : 'boundary_wall';
    default:
      return null;
  }
}

/**
 * A user's own labour rates by trade, each in its trade's unit: dollars per m²
 * or per metre, or a percentage of materials. A missing trade uses its default.
 *
 * Trades priced per m² or per metre have ids the percentage model never used
 * (to_slab, not foundations; roof_work, not roofing), so a saved percentage
 * such as { roofing: 35 } or { plaster: 200 } is ignored rather than read as
 * $35 or $200 a square metre.
 */
export type LaborRates = Partial<Record<LaborSubstageId, number>>;

const MAX_PERCENT = 300;
const MAX_UNIT_RATE = 500;

export function laborSubstage(id: LaborSubstageId): LaborSubstage {
  return LABOR_SUBSTAGES.find((entry) => entry.id === id)!;
}

export function maxLaborRate(id: LaborSubstageId): number {
  return laborSubstage(id).basis === 'percent' ? MAX_PERCENT : MAX_UNIT_RATE;
}

export function defaultLaborRate(id: LaborSubstageId): number {
  return laborSubstage(id).rate;
}

export function laborRateFor(id: LaborSubstageId, rates?: LaborRates): number {
  const own = rates?.[id];
  if (typeof own === 'number' && Number.isFinite(own)) return Math.min(maxLaborRate(id), Math.max(0, own));
  return defaultLaborRate(id);
}

/** True when any trade differs from its default. */
export function hasCustomLaborRates(rates?: LaborRates): boolean {
  return LABOR_SUBSTAGES.some((entry) => laborRateFor(entry.id, rates) !== entry.rate);
}

/** Only rates for trades that exist; keys from the old percentage model are dropped. */
export function cleanLaborRates(rates: Record<string, unknown> | null | undefined): LaborRates {
  const clean: LaborRates = {};
  for (const entry of LABOR_SUBSTAGES) {
    const value = rates?.[entry.id];
    if (typeof value === 'number' && Number.isFinite(value)) clean[entry.id] = laborRateFor(entry.id, { [entry.id]: value });
  }
  return clean;
}

const UNIT_LABEL: Record<Exclude<LaborBasis, 'percent'>, { per: string; quantity: string }> = {
  floor_m2: { per: '/m² of floor', quantity: 'm² of floor' },
  tiled_m2: { per: '/m² tiled', quantity: 'm² of tiles' },
  ceiling_m2: { per: '/m² of ceiling', quantity: 'm² of ceiling' },
  boundary_m: { per: '/m of wall', quantity: 'm of boundary' },
};

/** "$7.40/m² of floor" or "35% of materials": a trade's rate as people read it. */
export function formatLaborRate(id: LaborSubstageId, rate: number): string {
  const { basis } = laborSubstage(id);
  if (basis === 'percent') return `${rate}% of materials`;
  return `$${rate.toFixed(2)}${UNIT_LABEL[basis].per}`;
}

/** The unit an editable rate is in, for a field's suffix: "/m² of floor", "% of materials". */
export function laborRateUnit(id: LaborSubstageId): string {
  const { basis } = laborSubstage(id);
  return basis === 'percent' ? '% of materials' : UNIT_LABEL[basis].per;
}

export type LaborQuantities = Record<Exclude<LaborBasis, 'percent'>, number>;

export type LaborLine = {
  id: LaborSubstageId;
  stage: LaborStage;
  label: string;
  basis: LaborBasis;
  rate: number;
  /** m², metres, or for a percentage the materials' cost it is a share of. */
  quantity: number;
  usd: number;
  /** "$7.40/m² of floor × 120 m² of floor" or "35% of painting materials ($350.04)". */
  note: string;
};

type PricedItem = { category: string; materialId: string; materialName: string; calculationNote?: string; totalUsd: number };

/**
 * Labour for each trade that has work in this BOQ. A trade is priced only when
 * some material line belongs to it: no ceiling boards, no ceiling labour.
 */
export function laborLines(materialItems: PricedItem[], quantities: LaborQuantities, rates?: LaborRates): LaborLine[] {
  return LABOR_SUBSTAGES.flatMap((entry): LaborLine[] => {
    const materials = materialItems.filter((item) => laborSubstageFor(item) === entry.id);
    if (materials.length === 0) return [];
    const rate = laborRateFor(entry.id, rates);
    if (entry.basis === 'percent') {
      const materialUsd = materials.reduce((sum, item) => sum + (item.totalUsd || 0), 0);
      const usd = Math.round(materialUsd * rate) / 100;
      return [{ id: entry.id, stage: entry.stage, label: entry.label, basis: entry.basis, rate, quantity: materialUsd, usd,
        note: `${rate}% of ${entry.label.toLowerCase()} materials ($${materialUsd.toFixed(2)})` }];
    }
    const quantity = Math.round(quantities[entry.basis] * 10) / 10;
    if (!(quantity > 0)) return [];
    const usd = Math.round(rate * quantity * 100) / 100;
    return [{ id: entry.id, stage: entry.stage, label: entry.label, basis: entry.basis, rate, quantity, usd,
      note: `${formatLaborRate(entry.id, rate)} × ${quantity} ${UNIT_LABEL[entry.basis].quantity}` }];
  });
}

/**
 * The rates a saved BOQ was priced at, read back from its labour lines' notes.
 * Notes from the old percentage model are ignored for trades that are now
 * priced per m² or per metre, so those come back at today's defaults.
 */
export function laborRatesFromNotes(lines: { materialId: string; note?: string | null }[]): LaborRates {
  const rates: LaborRates = {};
  for (const line of lines) {
    const entry = LABOR_SUBSTAGES.find((candidate) => `labor-${candidate.id}` === line.materialId);
    if (!entry || !line.note) continue;
    const match = entry.basis === 'percent'
      ? line.note.match(/^(\d+(?:\.\d+)?)% of /)
      : line.note.match(/^\$(\d+(?:\.\d+)?)\//);
    if (match && Number(match[1]) !== entry.rate) rates[entry.id] = Number(match[1]);
  }
  return rates;
}
