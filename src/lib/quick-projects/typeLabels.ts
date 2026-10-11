// Exported so anywhere that needs a human label for a quick project type —
// the estimate detail page, its PDF, the card's menu — reads from one place.
// This drifted into two copies once already (here and in the detail page);
// a second file re-declaring the same six pairs was how the drift started.
export const QUICK_TYPE_LABELS: Record<string, string> = {
  solar: 'Solar',
  borehole: 'Borehole',
  septic: 'Septic',
  water: 'Water',
  fencing: 'Fencing',
  paving: 'Paving',
};
