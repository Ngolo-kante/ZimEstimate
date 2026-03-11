import { makeItem, type Answers, type BOQItem } from '../engine/types';
import { BOREHOLE_PRICES as P } from './catalog';

export function calculateBoreholeBOQ(answers: Answers): BOQItem[] {
  const depth = parseInt(answers.drilling_depth as string) || 60;
  const casingType = (answers.casing_type as string) || 'upvc';
  const casingDia = (answers.casing_diameter as string) || '100mm';
  const pumpType = (answers.pump_type as string) || 'submersible';
  const risingMaterial = (answers.rising_material as string) || 'hdpe';
  const risingDia = (answers.rising_diameter as string) || '32mm';

  const casingKey = `casing_${casingType}_${casingDia.replace('mm','')}` as keyof typeof P;
  const risingKey = `rising_${risingMaterial}_${risingDia.replace('mm','')}` as keyof typeof P;
  const cableKey = depth > 50 ? 'cable_40' : 'cable_25';
  const pumpKey = pumpType === 'hand' ? 'pump_hand' :
                  depth > 60 ? 'pump_sub_15' :
                  depth > 30 ? 'pump_sub_075' : 'pump_sub_055';

  const gravel = +(depth * 0.03).toFixed(1);

  const items: BOQItem[] = [
    makeItem('bh_drilling',  'Drilling',  `Borehole drilling (all-in rate)`,     depth,       'm',    P.drilling_per_m),
    makeItem('bh_casing',    'Casing',    `${casingType.toUpperCase()} casing ${casingDia}`, depth, 'm', P[casingKey] ?? 12),
    makeItem('bh_gravel',    'Casing',    'Gravel pack (filter)',                 gravel,      'm³',   P.gravel_pack),
    makeItem('bh_wellhead',  'Wellhead',  'Wellhead assembly',                   1,           'each', P.wellhead),
    makeItem('bh_rising',    'Pipework',  `${risingMaterial.toUpperCase()} rising main ${risingDia}`, depth + 5, 'm', P[risingKey] ?? 3.50),
  ];

  if (pumpType !== 'none') {
    items.push(makeItem('bh_pump', 'Pump', pumpType === 'hand' ? 'Afridev hand pump' : `Submersible pump (${depth > 60 ? '1.5' : depth > 30 ? '0.75' : '0.55'}kW)`, 1, 'each', P[pumpKey]));
    if (pumpType === 'submersible') {
      items.push(makeItem('bh_cable', 'Electrical', `3-core pump cable ${depth > 50 ? '4' : '2.5'}mm²`, depth + 10, 'm', P[cableKey]));
    }
  }

  // Optional
  if (answers.include_mobilization) items.push(makeItem('bh_mob',   'Site Work', 'Rig mobilization',         1, 'each', P.mobilization,      { optional: true }));
  if (answers.include_pump_test)    items.push(makeItem('bh_test',  'Site Work', 'Pump test & development',  1, 'each', P.pump_test,         { optional: true }));
  if (answers.include_water_test)   items.push(makeItem('bh_wtest', 'Site Work', 'Water quality lab test',   1, 'each', P.water_quality_test,{ optional: true }));
  if (answers.include_pump_install) items.push(makeItem('bh_inst',  'Site Work', 'Pump installation labour', 1, 'each', P.pump_install,      { optional: true }));

  return items;
}
