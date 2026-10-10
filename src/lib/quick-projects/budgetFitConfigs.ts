import { calculateFencingBOQ } from '@/lib/quick-projects/fencing/calculations';
import { calculatePavingBOQ } from '@/lib/quick-projects/paving/calculations';
import type { Answers } from '@/lib/quick-projects/engine/types';
import type { BudgetFitConfig } from '@/components/quick-projects/BudgetFitExplorer';

/**
 * The quick projects you buy by the metre.
 *
 * Option values and ranges are copied from each project's own flow.ts, so a
 * variant offered here is one the full wizard can actually price — an invented
 * value would still produce a BOQ through the generator's fallback and quote a
 * job nobody can order.
 */

export const fencingBudgetFit: BudgetFitConfig = {
  id: 'fencing',
  noun: 'fencing',
  unit: 'm',
  quantityLabel: (quantity) => `${quantity.toLocaleString('en-US')} metres of fencing`,
  variantLabel: 'What kind of fence?',
  variants: [
    { value: 'precast', label: 'Precast concrete', description: 'Pre-made panels between pillars. Very common in Zimbabwe.' },
    { value: 'brick', label: 'Brick wall', description: 'Plastered brick. Durable, gives privacy.' },
    { value: 'palisade', label: 'Palisade (steel)', description: 'Steel spear-top. Security-focused.' },
    { value: 'mesh', label: 'Diamond mesh', description: 'Chain-link. The cheapest way to enclose a stand.' },
  ],
  // Matches the flow's own min/max for fence_length.
  min: 5,
  max: 2000,
  step: 1,
  answersFor: (fence_type, fence_length) =>
    ({
      fence_type,
      fence_length,
      // The flow's own defaults, so this quotes a standard 1.8m fence with one
      // gate rather than a bare run nobody would build.
      fence_height: 1.8,
      gate_count: 1,
    }) as unknown as Answers,
  generate: calculateFencingBOQ,
};

export const pavingBudgetFit: BudgetFitConfig = {
  id: 'paving',
  noun: 'paving',
  unit: 'm²',
  quantityLabel: (quantity) => `${quantity.toLocaleString('en-US')} m² of paving`,
  variantLabel: 'What kind of paving?',
  variants: [
    { value: 'interlock', label: 'Interlocking bricks', description: 'Most popular in Zimbabwe. Removable and durable.' },
    { value: 'concrete', label: 'Concrete slab', description: 'Cast in place. Low maintenance.' },
    { value: 'stamped', label: 'Stamped concrete', description: 'Patterned finish. Premium look.' },
    { value: 'cobble', label: 'Granite cobbles', description: 'Natural stone. Long-lasting.' },
  ],
  min: 5,
  max: 5000,
  step: 1,
  answersFor: (paving_type, area_m2) =>
    ({
      paving_type,
      area_method: 'total',
      area_m2,
    }) as unknown as Answers,
  generate: calculatePavingBOQ,
};
