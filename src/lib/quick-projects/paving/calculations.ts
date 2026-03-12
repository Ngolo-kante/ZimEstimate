import { makeItem, type Answers, type BOQItem } from '../engine/types';
import { PAVING_PRICES as P } from './catalog';

export function calculatePavingBOQ(answers: Answers): BOQItem[] {
  const pavingType = (answers.paving_type as string) || 'interlock';
  let areaM2 = parseFloat(answers.area_m2 as string) || 0;
  if (!areaM2 && answers.area_length && answers.area_width) {
    areaM2 = parseFloat(answers.area_length as string) * parseFloat(answers.area_width as string);
  }
  areaM2 = areaM2 || 50;
  const subBaseNeeded = answers.sub_base_needed === 'yes';
  const kerbType = (answers.kerb_type as string) || 'precast';
  const kerbLength = parseFloat(answers.kerb_length as string) || 0;
  const items: BOQItem[] = [];

  // Main paving surface
  if (pavingType === 'interlock') {
    items.push(makeItem('pav_blocks', 'Paving', 'Interlocking paving bricks',  areaM2 * 1.05, 'm²', P.interlock_per_m2, { notes: '5% waste added' }));
    items.push(makeItem('pav_sand',   'Paving', 'Bedding & jointing sand',     areaM2,        'm²', P.interlock_sand));
  } else if (pavingType === 'concrete') {
    items.push(makeItem('pav_conc',   'Paving', 'Concrete slab 100mm (incl. BRC mesh)', areaM2, 'm²', P.concrete_slab_m2));
  } else if (pavingType === 'stamped') {
    items.push(makeItem('pav_stamp',  'Paving', 'Stamped / decorative concrete', areaM2, 'm²', P.stamped_concrete_m2));
  } else if (pavingType === 'cobble') {
    items.push(makeItem('pav_cobble', 'Paving', 'Granite cobblestones',        areaM2 * 1.05, 'm²', P.cobblestone_m2, { notes: '5% waste added' }));
    items.push(makeItem('pav_sand_c', 'Paving', 'Bedding sand',               areaM2,         'm²', P.interlock_sand));
  }

  // Sub-base
  if (subBaseNeeded) {
    items.push(makeItem('pav_sub',    'Sub-base', 'G5 sub-base material 150mm', areaM2, 'm²', P.sub_base_per_m2));
    if (answers.include_compaction) {
      items.push(makeItem('pav_comp', 'Sub-base', 'Compaction (plate compactor hire)', areaM2, 'm²', P.sub_base_compaction, { optional: true }));
    }
  }

  // Kerbing
  if (kerbLength > 0) {
    const kerbKey = kerbType === 'cast' ? 'kerb_cast_m' : 'kerb_precast_m';
    items.push(makeItem('pav_kerb', 'Edging', `${kerbType === 'cast' ? 'Cast in-situ' : 'Precast'} kerbing`, kerbLength, 'm', P[kerbKey]));
  }

  // Excavation
  if (answers.include_excavation) {
    items.push(makeItem('pav_excav', 'Site Work', 'Area excavation (hand)', areaM2, 'm²', P.excavation_m2, { optional: true }));
  }

  if (answers.include_sealing) {
    items.push(makeItem('pav_seal', 'Finishing', 'Paving sealer / top coat', areaM2, 'm²', P.sealing_m2, { optional: true }));
  }

  if (answers.include_transport) {
    items.push(makeItem('pav_trans', 'Site Work', 'Material delivery / transport', 1, 'trip', P.transport, { optional: true }));
  }

  return items;
}
