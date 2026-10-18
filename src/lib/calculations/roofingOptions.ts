export type RoofCovering = 'ibr_05' | 'chromadek_ibr' | 'corrugated' | 'qtile' | 'concrete_tile';

export const DEFAULT_ROOF_COVERING: RoofCovering = 'ibr_05';

// Coverages are planning allowances after side laps, not manufacturer takeoffs.
// Zimbabwe supplier references: ZBMS corrugated / QTile / concrete-tile listings,
// Halsteds Chromadek IBR 686 mm cover listing, and chromadek.co.zw's QTile range.
// Confirm actual length, roof geometry and end laps before ordering.
export const ROOF_COVERINGS: Record<RoofCovering, {
  label: string;
  description: string;
  materialId: string;
  materialName: string;
  coverage: number;
  unit: string;
  fixingRate: number;
}> = {
  ibr_05: { label: 'IBR galvanised 0.5 mm', description: 'Standard box-rib metal sheet, 3 m lengths', materialId: 'ibr-05-3m', materialName: 'IBR Sheets 0.5mm x 3m', coverage: 2.06, unit: 'per sheet', fixingRate: 8 },
  chromadek_ibr: { label: 'Chromadek IBR 0.4 mm', description: 'Pre-painted IBR, 3.6 m lengths', materialId: 'ibr-chromadek-04-36m', materialName: 'Chromadek IBR 0.4mm x 3.6m', coverage: 2.47, unit: 'per sheet', fixingRate: 8 },
  corrugated: { label: 'Corrugated steel', description: 'Galvanised corrugated sheet, 3.6 m lengths', materialId: 'corrugated-36m', materialName: 'Corrugated Steel Sheet 3.6m', coverage: 2.88, unit: 'per sheet', fixingRate: 8 },
  qtile: { label: 'QTile profile', description: 'Painted tile-effect steel, priced by linear metre', materialId: 'qtile-04-lm', materialName: 'QTile 0.4mm Roofing', coverage: 0.8, unit: 'per metre', fixingRate: 3 },
  concrete_tile: { label: 'Concrete roof tiles', description: 'Double Roman profile; roof structure needs engineer review', materialId: 'roof-tile-concrete', materialName: 'Double Roman Concrete Roof Tile', coverage: 1 / 10.5, unit: 'each', fixingRate: 0 },
};

// ─── Roof shape ───────────────────────────────────────────────────────────────
// Added 2026-10-18: every roof had been priced as a gable. A hipped roof —
// the commonest on Zimbabwe houses — slopes on all four sides, so it needs hip
// rafters, hip capping, and fascia and gutters right round; a lean-to slopes
// one way, for cottages and outbuildings.
export type RoofShape = 'hipped' | 'gable' | 'lean_to';

export const DEFAULT_ROOF_SHAPE: RoofShape = 'hipped';

export const ROOF_SHAPES: Record<RoofShape, { label: string; description: string }> = {
  hipped: { label: 'Hipped', description: 'Slopes on all four sides; the usual Zimbabwe house roof' },
  gable: { label: 'Gable', description: 'Two slopes, with triangular gable walls at the ends' },
  lean_to: { label: 'Lean-to', description: 'One slope; cottages, extensions and outbuildings' },
};
