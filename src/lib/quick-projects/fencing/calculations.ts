import { makeItem, type Answers, type BOQItem } from '../engine/types';
import { FENCING_PRICES as P } from './catalog';

export function calculateFencingBOQ(answers: Answers): BOQItem[] {
  const fenceType = (answers.fence_type as string) || 'precast';
  const length = parseFloat(answers.fence_length as string) || 50;
  const height = parseFloat(answers.fence_height as string) || 1.8;
  const gateCount = parseInt(answers.gate_count as string) || 1;
  const gateType = (answers.gate_type as string) || 'sliding_4m';
  const items: BOQItem[] = [];

  if (fenceType === 'precast') {
    const pillarSpacing = 3;
    const pillarCount = Math.ceil(length / pillarSpacing) + 1;
    items.push(makeItem('fence_panel',   'Fencing', 'Precast concrete panels',  length,      'm',    P.precast_panel_1m));
    items.push(makeItem('fence_pillar',  'Fencing', 'Precast concrete pillars', pillarCount, 'each', P.precast_pillar));
  } else if (fenceType === 'brick') {
    const wallArea = length * height;
    items.push(makeItem('fence_wall',    'Fencing', 'Brick boundary wall (materials)', wallArea, 'm²', P.brick_per_m2));
    items.push(makeItem('fence_strip',   'Fencing', 'Strip foundation',         length, 'm', P.concrete_strip_m));
    if (answers.include_paint) items.push(makeItem('fence_paint', 'Finishing', 'Exterior paint', wallArea * 2, 'm²', P.paint_per_m2, { optional: true }));
  } else if (fenceType === 'palisade') {
    const postSpacing = 2.5;
    const postCount = Math.ceil(length / postSpacing) + 1;
    items.push(makeItem('fence_pal',     'Fencing', 'Palisade steel fencing',   length,    'm',    P.palisade_per_m));
    items.push(makeItem('fence_palpost', 'Fencing', 'Steel posts',              postCount, 'each', P.palisade_post));
  } else if (fenceType === 'mesh') {
    const postSpacing = 3;
    const postCount = Math.ceil(length / postSpacing) + 1;
    items.push(makeItem('fence_mesh',    'Fencing', 'Diamond mesh fencing',     length,    'm',    P.mesh_per_m));
    items.push(makeItem('fence_mpost',   'Fencing', 'Posts (concrete/steel)',   postCount, 'each', P.mesh_post));
  } else if (fenceType === 'electric') {
    const postSpacing = 10;
    const postCount = Math.ceil(length / postSpacing) + 1;
    items.push(makeItem('fence_elec',    'Fencing', 'Electric fence (10-strand)',length,   'm',    P.electric_per_m));
    items.push(makeItem('fence_epost',   'Fencing', 'Fiberglass posts',         postCount, 'each', P.electric_post));
    items.push(makeItem('fence_energiz', 'Fencing', 'Fence energizer',          1,         'each', P.electric_energizer));
  }

  // Post foundation
  if (fenceType !== 'brick') {
    const postCount2 = Math.ceil(length / 3);
    items.push(makeItem('fence_post_conc','Fencing','Concrete (post footings)',  postCount2,'each', P.post_concrete_each));
  }

  // Gates
  for (let i = 0; i < gateCount; i++) {
    if (gateType === 'sliding_3m') items.push(makeItem(`fence_gate_${i}`, 'Gates', '3m sliding gate',     1, 'each', P.gate_sliding_3m));
    else if (gateType === 'sliding_4m') items.push(makeItem(`fence_gate_${i}`, 'Gates', '4m sliding gate', 1, 'each', P.gate_sliding_4m));
    else if (gateType === 'swing_double') items.push(makeItem(`fence_gate_${i}`, 'Gates', 'Double swing gate 3m', 1, 'each', P.gate_swing_double));
    else items.push(makeItem(`fence_gate_${i}`, 'Gates', 'Single swing gate', 1, 'each', P.gate_swing_single));
  }

  if (answers.include_transport) items.push(makeItem('fence_transport', 'Site Work', 'Material delivery', 1, 'trip', P.transport, { optional: true }));

  return items;
}
