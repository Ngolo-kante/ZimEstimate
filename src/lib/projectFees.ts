import type { BOQItem, MilestoneData } from '@/store/boqWizardStore';

// ─── Professional and council fees ───────────────────────────────────────────
//
// Council lines are priced from the City of Harare 2026 budget tariffs
// (hararecity.co.zw/resources/download/380, pages 57–59, read 2026-10-13):
//
//   plan approval     1% of floor area × the council's cost per m²
//                     high density: $120/m² (double storey $160), minimum $80
//                     low density:  $160/m² (double storey $240), minimum $160
//   stage inspection  per visit, per structure: high $20, low $30
//   drain inspection  per visit, per structure: high $40, low $80
//   certificate of occupation: high $150, low $240 (minimum)
//
// Harare's stage-inspection form has seven stages: siting/trenches,
// DPC/compaction, lintel, wall plate, roof, drain open test, final. The drain
// test is charged at the drain rate, so it is its own line and the other six
// are stage visits. Other councils set their own fees (Bulawayo's reports
// work out at about 1% of plan value too); every line stays editable.
//
// Drawings and engineers have no tariff. A Harare guide quotes $300–$1,500
// for residential plans and $200–$500 for a structural engineer
// (propzone.co.zw, 2026); those lines start unpriced, with the range shown.

export type ResidentialDensity = 'high' | 'low';

export const DEFAULT_DENSITY: ResidentialDensity = 'low';

export const COUNCIL_TARIFF = {
  name: 'City of Harare 2026 tariff',
  url: 'https://www.hararecity.co.zw/resources/download/380',
  stageVisits: 6,
  high: { label: 'High density', costPerM2: { single: 120, double: 160 }, percent: 1, minimum: 80, stageVisit: 20, drainVisit: 40, occupation: 150 },
  low: { label: 'Low density', costPerM2: { single: 160, double: 240 }, percent: 1, minimum: 160, stageVisit: 30, drainVisit: 80, occupation: 240 },
} as const;

/** Lines priced from the tariff carry this at the start of their note. */
export const TARIFF_NOTE_PREFIX = COUNCIL_TARIFF.name;
/** A fee line whose price the user typed in. */
export const OWN_FIGURE_NOTE = 'Your own figure.';

export const PROJECT_FEES = [
  { id: 'architectural-drawings', label: 'Architectural drawings & plan preparation', group: 'Design and professional services', guidance: 'Typically $300–$1,500 for a house in Harare. The drawer must be registered with the Architects Council (SI 56 of 2025).' },
  { id: 'council-plan-approval', label: 'Council plan scrutiny & approval', group: 'Council approvals and inspections', guidance: 'Confirm the current charge with your local authority.' },
  { id: 'building-inspections', label: 'Building stage inspections', group: 'Council approvals and inspections', guidance: 'Siting, DPC, lintel, wall plate, roof and final inspections.' },
  { id: 'drainage-inspection', label: 'Drainage inspection', group: 'Council approvals and inspections', guidance: 'Drain open test before the trenches are closed.' },
  { id: 'occupation-certificate', label: 'Certificate of occupation', group: 'Council approvals and inspections', guidance: 'Issued after the final inspection.' },
  { id: 'structural-engineer', label: 'Structural engineer drawings / sign-off', group: 'Site-dependent services', guidance: 'Typically $200–$500 when your design or council needs one.' },
  { id: 'site-survey', label: 'Site survey / setting out', group: 'Site-dependent services', guidance: 'Add if a surveyor or setting-out service is needed.' },
  { id: 'soil-report', label: 'Geotechnical / soil report', group: 'Site-dependent services', guidance: 'Add if testing or a report is required.' },
  { id: 'utility-connections', label: 'Water, sewer & electricity connection fees', group: 'Site-dependent services', guidance: 'Use authority quotations; separate charges with custom BOQ lines if useful.' },
] as const;

export type ProjectFeeId = (typeof PROJECT_FEES)[number]['id'];

/** Lines a full-house estimate is incomplete without. */
export const REQUIRED_FEE_IDS = new Set<string>(PROJECT_FEES.slice(0, 5).map((fee) => fee.id));

export type FeeBasis = {
  floorArea: number;
  density: ResidentialDensity;
  doubleStorey: boolean;
};

type TariffLine = { quantity: number; unit: string; priceUsd: number; note: string };

const money = (value: number) => `$${Math.round(value * 100) / 100}`;

/** What the tariff charges for one fee line, or null for lines it doesn't cover. */
export function tariffLine(id: string, basis: FeeBasis): TariffLine | null {
  const tier = COUNCIL_TARIFF[basis.density];
  const where = `${TARIFF_NOTE_PREFIX}, ${tier.label.toLowerCase()}`;
  switch (id) {
    case 'council-plan-approval': {
      if (!(basis.floorArea > 0)) return null;
      const costPerM2 = basis.doubleStorey ? tier.costPerM2.double : tier.costPerM2.single;
      const fee = Math.max(tier.minimum, basis.floorArea * costPerM2 * tier.percent / 100);
      return {
        quantity: 1, unit: 'fee', priceUsd: Math.round(fee * 100) / 100,
        note: `${where}: ${tier.percent}% of ${Math.round(basis.floorArea)} m² × ${money(costPerM2)}/m² (minimum ${money(tier.minimum)}). Before any VAT; other councils differ.`,
      };
    }
    case 'building-inspections':
      return { quantity: COUNCIL_TARIFF.stageVisits, unit: 'visit', priceUsd: tier.stageVisit, note: `${where}: ${money(tier.stageVisit)} per stage visit. Skipping a stage costs a penalty.` };
    case 'drainage-inspection':
      return { quantity: 1, unit: 'visit', priceUsd: tier.drainVisit, note: `${where}: ${money(tier.drainVisit)} per drain inspection visit.` };
    case 'occupation-certificate':
      return { quantity: 1, unit: 'certificate', priceUsd: tier.occupation, note: `${where}: minimum ${money(tier.occupation)}.` };
    default:
      return null;
  }
}

export function isTariffPriced(item: Pick<BOQItem, 'description'>): boolean {
  return Boolean(item.description?.startsWith(TARIFF_NOTE_PREFIX));
}

/** The density a saved project was priced at, read back from its fee notes. */
export function densityFromNotes(notes: (string | null | undefined)[]): ResidentialDensity | null {
  for (const note of notes) {
    const match = note?.startsWith(TARIFF_NOTE_PREFIX) ? note.match(/, (high|low) density:/) : null;
    if (match) return match[1] as ResidentialDensity;
  }
  return null;
}

export function buildProjectFeeItems(basis?: FeeBasis, zwgRate = 30): BOQItem[] {
  return PROJECT_FEES.map((fee) => {
    const line = basis ? tariffLine(fee.id, basis) : null;
    const price = line?.priceUsd ?? 0;
    return {
      id: `auto-project-fee-${fee.id}`,
      materialId: `project-fee-${fee.id}`,
      materialName: fee.label,
      quantity: line?.quantity ?? 1,
      calculatedQuantity: line?.quantity ?? 1,
      unit: line?.unit ?? 'allowance',
      averagePriceUsd: price,
      averagePriceZwg: price * zwgRate,
      actualPriceUsd: price,
      actualPriceZwg: price * zwgRate,
      description: line?.note ?? fee.guidance,
      category: 'project_fees',
      isOverridden: false,
    };
  });
}

/** Labour on an extra (septic, water tank) sits with the extra but is labour. */
export function isExtrasLabourLine(materialId: string | null | undefined): boolean {
  return Boolean(materialId?.startsWith('extra-') && materialId.endsWith('--labour'));
}

export function getCostBreakdown(milestones: MilestoneData[]) {
  const result = { materials: 0, labor: 0, fees: 0, total: 0 };
  for (const milestone of milestones) {
    for (const item of milestone.items) {
      const amount = (item.quantity || 0) * item.actualPriceUsd;
      if (milestone.id === 'labor' || isExtrasLabourLine(item.materialId)) result.labor += amount;
      else if (milestone.id === 'project_fees') result.fees += amount;
      else result.materials += amount;
      result.total += amount;
    }
  }
  return result;
}

/** Plan approval, stage and drain inspections and the certificate, together. */
export function councilFeesTotal(basis: FeeBasis): number {
  return PROJECT_FEES.reduce((sum, fee) => {
    const line = tariffLine(fee.id, basis);
    return sum + (line ? line.quantity * line.priceUsd : 0);
  }, 0);
}
