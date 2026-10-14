import { BOQ_ASSUMPTIONS, normalizeLocationType } from '@/lib/calculations/assumptions';
import { getMaterialById } from '@/lib/materials';
import { getVerifiedPrice, VERIFIED_PRICES_CHECKED_ON } from '@/lib/pricing/verifiedPrices';
import { ROOF_COVERINGS } from '@/lib/calculations/roofingOptions';

/**
 * The facts an explanation of one estimate line may use — and nothing else.
 *
 * Built here, on the server, from the estimate's own inputs, the note the
 * calculator wrote when it worked the line out, the assumption table it used,
 * and where the price came from. The model is told to explain only from these,
 * so "why 46 bags of cement?" is answered with this estimate's numbers rather
 * than general building lore that may not match what was calculated.
 *
 * Price sources are described, not named (see verifiedPrices.ts).
 */

export interface ExplainLineInput {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPriceUsd: number;
  stage: string;
  /** The calculator's own note for this line, if it wrote one. */
  note?: string;
  /** What the calculator worked out, when the person has since changed it. */
  calculatedQuantity?: number;
}

export interface ExplainProjectInput {
  floorAreaM2?: number;
  wallHeightM?: number;
  locationType?: string;
  finishLevel?: string;
  brickType?: string;
  stages?: string[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

const STAGE_LABELS: Record<string, string> = {
  substructure: 'foundations and floor slab',
  superstructure: 'walls up to roof level',
  roofing: 'roof',
  finishing: 'finishes inside the house',
  exterior: 'outside works',
  labor: 'labour',
};

/** Which parts of the assumption table bear on a material, by what it is. */
function assumptionsFor(materialId: string, stage: string, location: ReturnType<typeof normalizeLocationType>, economy: boolean): string[] {
  const a = BOQ_ASSUMPTIONS;
  const facts: string[] = [];
  const id = materialId.toLowerCase();
  const isCement = id.startsWith('cement');
  const isConcreteAggregate = id === 'sand-river' || id.startsWith('stone');

  if ((isCement || isConcreteAggregate) && stage === 'substructure') {
    facts.push(`Concrete mix ${economy ? a.concrete.mixRatio.economy : a.concrete.mixRatio.structural} (cement:sand:stone), ${economy ? a.concrete.cementBagsPerM3.economy : a.concrete.cementBagsPerM3.structural} bags of cement per cubic metre of concrete.`);
    facts.push(`Strip footing ${a.stripFooting.widthMm[location]} mm wide and ${a.stripFooting.depthMm} mm deep for a ${location} site.`);
    facts.push(`Floor slab ${economy ? a.slab.thicknessMm.economy : a.slab.thicknessMm.standard} mm thick.`);
    facts.push(`Concrete waste allowance on a ${location} site: ${pct(a.concrete.waste[location])}.`);
  }
  if (isCement || id === 'sand-bricks') {
    facts.push(`Mortar mix ${economy ? a.mortar.mixRatio.economy : a.mortar.mixRatio.standard} (cement:sand), ${economy ? a.mortar.cementBagsPerM3.economy : a.mortar.cementBagsPerM3.standard} bags of cement per cubic metre of mortar.`);
  }
  if ((id.startsWith('brick') && id !== 'brickforce') || id.startsWith('block')) {
    facts.push(`${a.masonry.unitsPerM2.clayBricks} bricks or ${a.masonry.unitsPerM2.cementBlocks} blocks per square metre of wall.`);
  }
  if ((id.startsWith('brick') && id !== 'brickforce') || id.startsWith('block') || id === 'sand-bricks' || (isCement && stage === 'superstructure')) {
    facts.push(`Masonry waste allowance on a ${location} site: ${pct(a.masonry.waste[location])} (breakage, cutting, handling).`);
  }
  if (stage === 'roofing' && (id.startsWith('ibr') || id === 'corrugated-36m' || id === 'qtile-04-lm' || id === 'roof-tile-concrete')) {
    const covering = Object.values(ROOF_COVERINGS).find((option) => option.materialId === id);
    if (covering) facts.push(`This ${covering.unit.replace('per ', '')} covers approximately ${covering.coverage.toFixed(2)} m² in the planning estimate; verify actual overlap with the supplier.`);
    else facts.push(`Each 3 m IBR sheet covers ${a.roofing.effectiveSheetCoverageM2} m² after side overlap.`);
    facts.push(`Roofing waste allowance on a ${location} site: ${pct(a.roofing.waste[location])} (end laps and offcuts).`);
  }
  if (id.includes('paint')) {
    facts.push(`Paint covers ${a.paint.coveragePerLitrePerCoat} m² per litre per coat; ${economy ? a.paint.coats.economy : a.paint.coats.standard} coats.`);
  }
  if (id.includes('tile') && stage !== 'roofing') {
    facts.push(`Tile waste allowance: ${pct(economy ? a.tiles.waste.economy : a.tiles.waste.standard)}; one bag of adhesive covers ${a.tiles.adhesiveCoverageM2PerBag} m².`);
  }
  if (id.startsWith('rebar') && stage === 'superstructure') {
    facts.push(`Ring beam ${a.ringBeam.widthMm} mm wide and ${economy ? a.ringBeam.depthMm.economy : a.ringBeam.depthMm.standard} mm deep, run along the walls.`);
  }
  return facts;
}

export function buildLineFacts(line: ExplainLineInput, project: ExplainProjectInput): string[] {
  const location = normalizeLocationType(project.locationType);
  const economy = project.finishLevel === 'economy';
  const material = getMaterialById(line.materialId);
  const facts: string[] = [];

  facts.push(`Line: ${line.quantity} × ${line.materialName} (${line.unit}) at $${line.unitPriceUsd.toFixed(2)} each = $${(line.quantity * line.unitPriceUsd).toFixed(2)}.`);
  facts.push(`Estimate section this line is listed under: ${STAGE_LABELS[line.stage] ?? line.stage}.`);
  if (material?.specifications) facts.push(`Specification: ${material.specifications}.`);
  const note = line.note?.replace(/\[Enablement Cost\]\s*/g, '').trim();
  if (note) facts.push(`What this line covers, in the calculator's words: "${note}". Other lines in the same section may cover other parts of the work.`);
  if (line.calculatedQuantity !== undefined && line.calculatedQuantity !== line.quantity) {
    facts.push(`The calculator worked out ${line.calculatedQuantity}; the person changed it to ${line.quantity}.`);
  }

  if (project.floorAreaM2) facts.push(`House floor area: ${project.floorAreaM2} m².`);
  if (project.wallHeightM) facts.push(`Wall height: ${project.wallHeightM} m.`);
  facts.push(`Site: ${location}.`);
  if (project.finishLevel) facts.push(`Finish level: ${project.finishLevel}.`);
  if (project.brickType) facts.push(`Walling: ${project.brickType.replace(/_/g, ' ')}.`);
  if (project.stages?.length) facts.push(`Stages in this estimate: ${project.stages.map((s) => STAGE_LABELS[s] ?? s).join(', ')}.`);

  facts.push(...assumptionsFor(line.materialId, line.stage, location, economy));

  const verified = getVerifiedPrice(line.materialId);
  if (verified && Math.abs(verified.priceUsd - line.unitPriceUsd) < 0.005) {
    facts.push(`Price: taken from prices listed by Harare suppliers, checked ${VERIFIED_PRICES_CHECKED_ON}.`);
  } else if (line.unitPriceUsd > 0) {
    facts.push('Price: a reference price from our catalogue, or one the person entered.');
  }
  return facts;
}
