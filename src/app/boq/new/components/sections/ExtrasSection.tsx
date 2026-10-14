'use client';

import type { ReactNode } from 'react';
import { Door, Drop, HouseLine, Lightning, ShieldCheck, SolarPanel, Tent, Thermometer, Toilet } from '@phosphor-icons/react';
import {
  DEFAULT_HOUSE_EXTRAS,
  extraIdOf,
  HOUSE_EXTRAS_INFO,
  normalizeHouseExtras,
  SOLAR_PACKAGE_LABELS,
  type HouseExtraId,
  type HouseExtras,
} from '@/lib/houseExtras';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const ICONS: Record<HouseExtraId, ReactNode> = {
  site_setup: <Tent size={22} weight="duotone" />,
  septic: <Toilet size={22} weight="duotone" />,
  water_tank: <Drop size={22} weight="duotone" />,
  borehole: <Drop size={22} weight="fill" />,
  solar: <SolarPanel size={22} weight="duotone" />,
  solar_geyser: <Thermometer size={22} weight="duotone" />,
  gate_motor: <Door size={22} weight="duotone" />,
  security: <ShieldCheck size={22} weight="duotone" />,
  power_connection: <Lightning size={22} weight="duotone" />,
};

const ORDER: HouseExtraId[] = ['site_setup', 'septic', 'water_tank', 'borehole', 'solar', 'solar_geyser', 'gate_motor', 'security', 'power_connection'];

const dollars = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const INPUT = 'w-24 rounded-lg border border-slate-300 px-2 py-2 text-right text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold text-slate-600">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-9 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${value === option.value ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-9 items-center gap-2 text-sm text-slate-800">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-blue-700" />
      {label}
    </label>
  );
}

function NumberField({ label, value, min, max, step = 1, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-slate-800">
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <input type="number" inputMode="numeric" min={min} max={max} step={step} value={value}
          onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))}
          className={INPUT} />
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </span>
    </label>
  );
}

export default function ExtrasSection() {
  const projectDetails = useBoqWizardStore((state) => state.projectDetails);
  const projectScope = useBoqWizardStore((state) => state.projectScope);
  const milestones = useBoqWizardStore((state) => state.milestonesState);
  const updateProjectDetails = useBoqWizardStore((state) => state.updateProjectDetails);
  const extras = normalizeHouseExtras(projectDetails.houseExtras);

  const set = <K extends HouseExtraId>(id: K, patch: Partial<HouseExtras[K]>) =>
    updateProjectDetails({ houseExtras: { ...extras, [id]: { ...extras[id], ...patch } } });

  const subtotals = new Map<HouseExtraId, { total: number; unpriced: number }>();
  for (const milestone of milestones) {
    for (const item of milestone.items) {
      const id = extraIdOf(item.materialId);
      if (!id) continue;
      const entry = subtotals.get(id) ?? { total: 0, unpriced: 0 };
      entry.total += (item.quantity || 0) * item.actualPriceUsd;
      if (!item.actualPriceUsd) entry.unpriced += 1;
      subtotals.set(id, entry);
    }
  }

  if (projectScope !== 'entire') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        Extras such as a septic tank, borehole or solar belong to a full house estimate. Choose <strong>Entire house</strong> on the first step to add them.
      </div>
    );
  }

  const options = (id: HouseExtraId): ReactNode => {
    switch (id) {
      case 'site_setup': {
        const site = extras.site_setup;
        return (
          <div className="grid gap-1 sm:grid-cols-2">
            <Check label="Cabin for the guard and materials (6×3 m)" checked={site.cabin} onChange={(cabin) => set('site_setup', { cabin })} />
            <Check label="Temporary site toilet" checked={site.toilet} onChange={(toilet) => set('site_setup', { toilet })} />
            <Check label="Site clearing & levelling" checked={site.clearing} onChange={(clearing) => set('site_setup', { clearing })} />
            <Check label="50,000 L water tank (no municipal tap)" checked={site.tank} onChange={(tank) => set('site_setup', { tank })} />
            {site.tank && <div className="sm:col-span-2"><NumberField label="Tanker fills during the build ($50 each)" value={site.waterFills} min={0} max={60} onChange={(waterFills) => set('site_setup', { waterFills })} /></div>}
          </div>
        );
      }
      case 'septic':
        return (
          <div className="space-y-3">
            <Segmented label="Tank" value={extras.septic.method} onChange={(method) => set('septic', { method })}
              options={[{ value: 'brick', label: 'Brick-built' }, { value: 'precast', label: 'Precast' }, { value: 'poly', label: 'Plastic' }]} />
            <NumberField label="People living in the house" value={extras.septic.occupants} min={1} max={30} onChange={(occupants) => set('septic', { occupants })} />
          </div>
        );
      case 'water_tank':
        return (
          <div className="space-y-3">
            <Segmented label="Tank size" value={extras.water_tank.litres} onChange={(litres) => set('water_tank', { litres })}
              options={[{ value: 2500, label: '2,500 L' }, { value: 5000, label: '5,000 L' }, { value: 10000, label: '10,000 L' }]} />
            <Check label="Booster pump for water pressure" checked={extras.water_tank.pump} onChange={(pump) => set('water_tank', { pump })} />
          </div>
        );
      case 'borehole':
        return (
          <div className="space-y-3">
            <NumberField label="Drilling depth" value={extras.borehole.depthM} min={10} max={200} step={5} suffix="m" onChange={(depthM) => set('borehole', { depthM })} />
            <Segmented label="Pump" value={extras.borehole.pump} onChange={(pump) => set('borehole', { pump })}
              options={[{ value: 'solar', label: 'Solar pump' }, { value: 'electric', label: 'Electric pump' }, { value: 'none', label: 'Drilling only' }]} />
          </div>
        );
      case 'solar':
        return (
          <Segmented label="Keep running" value={extras.solar.size} onChange={(size) => set('solar', { size })}
            options={(Object.keys(SOLAR_PACKAGE_LABELS) as (keyof typeof SOLAR_PACKAGE_LABELS)[]).map((size) => ({ value: size, label: SOLAR_PACKAGE_LABELS[size] }))} />
        );
      case 'security': {
        const security = extras.security;
        return (
          <div className="grid gap-1 sm:grid-cols-2">
            <Check label="Burglar bars on every window" checked={security.burglarBars} onChange={(burglarBars) => set('security', { burglarBars })} />
            <Check label="Security gates on outside doors" checked={security.securityGates} onChange={(securityGates) => set('security', { securityGates })} />
            <Check label="Alarm system" checked={security.alarm} onChange={(alarm) => set('security', { alarm })} />
            <Check label="Electric fence on the boundary wall" checked={security.electricFence} onChange={(electricFence) => set('security', { electricFence })} />
          </div>
        );
      }
      case 'power_connection':
        return <NumberField label="Cable from house to the road" value={extras.power_connection.cableMetres} min={5} max={500} step={5} suffix="m" onChange={(cableMetres) => set('power_connection', { cableMetres })} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><HouseLine size={20} weight="duotone" /> Everything beyond the house itself</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">
          Your BOQ already covers the boundary wall, vehicle and pedestrian gates and driveway paving (Exterior works), and a 150 L electric geyser (Finishing). Add only what your stand still needs. Lines marked <em>add your quote</em> start at $0 because there is no published Zimbabwe price; fill them in on the review step.
        </p>
      </div>

      {ORDER.map((id) => {
        const info = HOUSE_EXTRAS_INFO[id];
        const on = extras[id].enabled;
        const subtotal = subtotals.get(id);
        return (
          <section key={id} className={`overflow-hidden rounded-2xl border bg-white transition ${on ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-200'}`}>
            <div className="flex items-start gap-3 p-4 sm:p-5">
              <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{ICONS[id]}</span>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-slate-900">{info.label}</h4>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">{info.description}</p>
                {on && subtotal && (
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {dollars(subtotal.total)}{subtotal.unpriced > 0 ? ` + ${subtotal.unpriced} ${subtotal.unpriced === 1 ? 'line' : 'lines'} to quote` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Add ${info.label}`}
                onClick={() => set(id, { enabled: !on } as Partial<HouseExtras[typeof id]>)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span aria-hidden="true" className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            {on && options(id) && <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">{options(id)}</div>}
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => updateProjectDetails({ houseExtras: DEFAULT_HOUSE_EXTRAS })}
        className="text-sm font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
      >
        Clear all extras
      </button>
    </div>
  );
}
