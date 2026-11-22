'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CardBadge } from '@/components/ui/CardBadge';
import { BatteryCharging, CheckCircle, Lightning, Question, SolarPanel } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useIsClient } from '@/hooks/useIsClient';
import { buildDefaultSelections, computeSolarSizing, estimateHardwareCost } from '@/lib/quick-projects/solar/calculations';
import { SOLAR_APPLIANCES, SOLAR_PACKAGES, type SolarPackage } from '@/lib/quick-projects/solar/catalog';
import { solarPackageToBOQ, solarSizingToBOQ } from '@/lib/quick-projects/solar/boq';
import type { SolarWizardAnswers, SolarWizardOutput, SolarSizingResult } from '@/lib/quick-projects/solar/types';
import type { BOQItem, LaborConfig } from '@/lib/quick-projects/engine/types';
import { restoreQuickBOQSession, clearQuickBOQSession } from '@/lib/services/quickBoq';
import QuickBOQTable from './QuickBOQTable';
import styles from './WizardChoices.module.css';

const defaults: SolarWizardAnswers = {
  intent: null, backupHours: null, location: '', propertyType: null,
  appliances: buildDefaultSelections(),
  simultaneousLoads: { kettleMicrowave: false, pumpWithHouse: false, geyserWithHouse: false },
  roof: { type: null, shading: null, orientation: '', spaceM2: null },
  existing: { hasExisting: false, inverterKva: null, batteryKwh: null, panelCount: null, issues: '' },
  budgetUsd: null,
  quote: { totalUsd: null, inverterKva: null, batteryKwh: null, panelCount: null, panelWatt: null, notes: '' },
};

const groups = [
  { label: '1kVA', match: (kva: number) => kva < 2, icon: Lightning },
  { label: '3kVA', match: (kva: number) => kva >= 2 && kva < 4, icon: BatteryCharging },
  { label: '5kVA', match: (kva: number) => kva >= 4 && kva < 7, icon: SolarPanel },
  { label: '8kVA and up', match: (kva: number) => kva >= 7, icon: SolarPanel },
];
function typicalHomeSelections() {
  const selections = buildDefaultSelections();
  for (const id of ['lights', 'tv', 'wifi', 'phone_charger', 'fridge']) {
    selections[id] = { ...selections[id], include: true, qty: id === 'lights' ? 6 : 1, hours: id === 'lights' ? 6 : 4 };
  }
  return selections;
}
type Path = 'size' | 'guided' | 'quote';
type Step = 'size' | 'options' | 'backup' | 'appliances' | 'results' | 'quote';
interface Props {
  onChange: (output: SolarWizardOutput & { boqItems?: BOQItem[] }) => void;
  isContractor?: boolean;
  onSave?: (output: SolarWizardOutput & { boqItems?: BOQItem[]; labor: LaborConfig; markupPct: number }) => void;
}

function SolarQuickWizardInner({ onChange, onSave, isContractor = false }: Props) {
  const restored = useState(() => typeof window === 'undefined' ? null : restoreQuickBOQSession())[0];
  const saved = restored?.projectType === 'solar' ? restored : null;
  useEffect(() => { if (saved) clearQuickBOQSession(); }, [saved]);
  const [answers, setAnswers] = useState<SolarWizardAnswers>(() => {
    const old = saved?.answers as Partial<SolarWizardAnswers> | undefined;
    return { ...defaults, ...old, appliances: { ...buildDefaultSelections(), ...old?.appliances },
      simultaneousLoads: { ...defaults.simultaneousLoads, ...old?.simultaneousLoads },
      roof: { ...defaults.roof, ...old?.roof }, existing: { ...defaults.existing, ...old?.existing },
      quote: { ...defaults.quote, ...old?.quote } };
  });
  const restoredIntent = (saved?.answers as Partial<SolarWizardAnswers> | undefined)?.intent;
  const [path, setPath] = useState<Path>(restoredIntent === 'quote_check' ? 'quote' : restoredIntent ? 'guided' : 'size');
  const [step, setStep] = useState<Step>(restoredIntent === 'quote_check' ? 'quote' : restoredIntent ? 'backup' : 'size');
  const [groupIndex, setGroupIndex] = useState<number | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [panelBrand, setPanelBrand] = useState('no_pref');
  const [inverterBrand, setInverterBrand] = useState('no_pref');
  const [batteryBrand, setBatteryBrand] = useState('no_pref');
  const [transport, setTransport] = useState(false);
  const [install, setInstall] = useState(true);
  const [contingency, setContingency] = useState(false);
  const [boqItems, setBoqItems] = useState<BOQItem[] | null>(saved?.boqItems?.length ? saved.boqItems : null);
  const [labor, setLabor] = useState<LaborConfig>(saved?.labor ?? { enabled: false, method: 'percentage', percentage: 25 });
  const selectedPackage = SOLAR_PACKAGES.find((pkg) => pkg.id === packageId) ?? null;
  const result = useMemo(() => path === 'guided' && step === 'results' ? computeSolarSizing(answers) : null, [answers, path, step]);
  const cost = result ? estimateHardwareCost(result) : null;
  const length = path === 'guided' ? 4 : path === 'quote' ? 3 : 2;
  const number = step === 'size' ? 1 : step === 'options' || step === 'backup' || step === 'quote' ? 2 : step === 'appliances' ? 3 : path === 'quote' ? 3 : 4;

  const update = (patch: Partial<SolarWizardAnswers>) => {
    setAnswers((before) => {
      const next = { ...before, ...patch };
      onChange({ answers: next, result: next.intent === 'quote_check' ? null : computeSolarSizing(next) });
      return next;
    });
  };
  const packageResult = (pkg: SolarPackage): SolarSizingResult => ({
    peakLoadWatts: pkg.kva * 800, inverterKva: pkg.kva, batteryKwh: pkg.batteryKwh,
    solarArrayKw: +(pkg.panelCount * pkg.panelWatt / 1000).toFixed(2), panelCount: pkg.panelCount,
    dailyEnergyKwh: 0, tier: pkg.kva <= 3 ? 'small' : pkg.kva <= 5 ? 'standard' : 'large',
    estimatedCostUsd: { low: pkg.price, high: pkg.price }, warnings: [],
  });
  const packageBrandsKept = panelBrand === 'no_pref' && inverterBrand === 'no_pref' && batteryBrand === 'no_pref';
  const makeBoq = () => {
    const sizing = selectedPackage ? packageResult(selectedPackage) : result;
    if (!sizing) return;
    // A package with its own brands is priced as the supplier sells it; once
    // the person changes a brand it is a custom build, priced part by part.
    const ownBrands = panelBrand === 'no_pref' && inverterBrand === 'no_pref' && batteryBrand === 'no_pref';
    const parts = selectedPackage && ownBrands ? solarPackageToBOQ(selectedPackage, {
      include_transport: transport, include_contingency: contingency,
    }) : solarSizingToBOQ(sizing, {
      ...answers,
      panel_brand: panelBrand === 'no_pref' ? selectedPackage?.panelBrandKey : panelBrand,
      inverter_brand: inverterBrand === 'no_pref' ? selectedPackage?.inverterBrandKey : inverterBrand,
      battery_brand: batteryBrand === 'no_pref' ? selectedPackage?.batteryBrandKey : batteryBrand,
      include_transport: transport, include_install: install && !selectedPackage?.includesInstall,
      include_contingency: contingency,
    });
    setBoqItems(parts);
    onChange({ answers, result: sizing, boqItems: parts });
  };
  const back = () => {
    if (boqItems) { setBoqItems(null); return; }
    if (step === 'results') setStep(path === 'quote' ? 'quote' : 'appliances');
    else if (step === 'appliances') setStep('backup');
    else setStep('size');
  };
  if (boqItems) return <div className="w-full max-w-5xl mx-auto">
    <button type="button" className="min-h-11 text-sm text-slate-600" onClick={back}>← Back to wizard</button>
    <QuickBOQTable initialMarkupPct={saved?.markupPct} projectType="solar" initialItems={boqItems} labor={labor} onLaborChange={setLabor}
      isContractor={isContractor} answers={answers as unknown as Record<string, unknown>}
      onSave={onSave ? (items, markupPct) => onSave({ answers, markupPct, labor, result: selectedPackage ? packageResult(selectedPackage) : result, boqItems: items }) : undefined} />
  </div>;
  const title = step === 'size' ? 'What size are you looking at?' : step === 'options' ? `Your ${groups[groupIndex ?? 0].label} options` :
    step === 'backup' ? 'Backup hours' : step === 'appliances' ? 'Appliances' : step === 'quote' ? 'Check your solar quote' : 'Solar recommendation';
  return <div className="w-full">
    {/* The same step header as the other quick project wizards. */}
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-500">
        <span>Step {number} of {length}</span>
        <span className="text-blue-600">{Math.round(((number - 1) / length) * 100)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-accent motion-safe:transition-[width] motion-safe:duration-200" style={{ width: `${Math.round(((number - 1) / length) * 100)}%` }} />
      </div>
    </div>
    <p className="mb-2 text-sm font-semibold text-blue-700">Solar setup</p>
    <h2 className="mb-2 text-xl sm:text-2xl font-bold text-slate-900">{title}</h2>
    {step === 'size' && <>
      <p className="mb-5 text-slate-600">Most homes start with 1kVA and add more later.</p>
      <div className={styles.grid}>{groups.map((group, index) => {
        const packages = SOLAR_PACKAGES.filter((pkg) => group.match(pkg.kva));
        const Icon = group.icon;
        return <button type="button" key={group.label} className={`${styles.card} ${index === 0 ? styles.popular : ''}`}
          onClick={() => { setPath('size'); setGroupIndex(index); setPackageId(null); setStep('options'); update({ intent: 'backup' }); }}>
          <span className={styles.icon}><Icon size={28} weight="duotone" /></span>
          <span className={styles.name}>{group.label}</span>
          <span className={styles.detail}>{packages[0]?.appliances}</span>
          {index === 0 && <CardBadge variant="featured" className={styles.badge}>Most popular</CardBadge>}
        </button>;
      })}
      <button type="button" className={styles.card} onClick={() => { setPath('guided'); setStep('backup'); update({ intent: 'backup' }); }}>
        <span className={styles.icon}><Question size={28} weight="duotone" /></span>
        <span className={styles.name}>Not sure? Help me choose</span>
        <span className={styles.detail}>Answer a few questions for a recommendation.</span>
      </button></div>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link className="min-h-11 content-center text-blue-700 underline" href="/quick-budget?mode=solar">Have a budget? See what it buys</Link>
        <button type="button" className="min-h-11 text-left text-blue-700 underline" onClick={() => { setPath('quote'); setStep('quote'); update({ intent: 'quote_check' }); }}>Check a solar quote you have</button>
      </div>
    </>}
    {step === 'options' && <div className="grid gap-4">
      {SOLAR_PACKAGES.filter((pkg) => groups[groupIndex ?? 0].match(pkg.kva)).sort((a, b) => a.price - b.price).map((pkg, index) =>
        <button type="button" key={pkg.id} aria-pressed={packageId === pkg.id} className={`${styles.card} ${styles.package} ${packageId === pkg.id ? styles.selected : ''}`} onClick={() => setPackageId(pkg.id)}>
          <span className={styles.icon}><SolarPanel size={28} weight="duotone" /></span>
          <span className={styles.name}>{pkg.name}{packageId === pkg.id && <CheckCircle className={styles.choiceCheck} weight="fill" aria-hidden="true" />}</span>
          <span className={styles.detail}>{pkg.appliances}</span>
          {index === 0 && <CardBadge variant="info" className={styles.badge}>Lowest price</CardBadge>}
        </button>)}
      {selectedPackage && <>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 font-semibold text-slate-900">Included parts</h3>
          <ol className="grid gap-2 text-sm text-slate-700">
            <li>Battery: {selectedPackage.batteryKwh} kWh</li>
            <li>Panels: {selectedPackage.panelCount} × {selectedPackage.panelWatt} W</li>
            <li>Inverter: {selectedPackage.kva} kVA</li>
            <li>Wiring and protection: included</li>
            <li>Installation: included</li>
          </ol>
        </div>
        {preferences()}
      </>}
    </div>}
    {step === 'backup' && <div className={styles.grid}>{[2, 4, 6, 8, 12, 24].map((hours) =>
      <button type="button" key={hours} aria-pressed={answers.backupHours === hours} className={`${styles.card} ${answers.backupHours === hours ? styles.selected : ''}`}
        onClick={() => update({ backupHours: hours, intent: hours >= 8 ? 'off_grid' : 'backup' })}>
        <span className={styles.icon}><BatteryCharging size={28} weight="duotone" /></span><span className={styles.name}>{hours} hours{answers.backupHours === hours && <CheckCircle className={styles.choiceCheck} weight="fill" aria-hidden="true" />}</span>
        <span className={styles.detail}>{hours >= 8 ? 'Off-grid' : 'Backup'}</span>
      </button>)}
      <button type="button" className={styles.card} onClick={() => update({ backupHours: 4, intent: 'backup' })}>
        <span className={styles.icon}><Question size={28} weight="duotone" /></span><span className={styles.name}>Not sure — use 4 hours</span>
      </button></div>}
    {step === 'appliances' && <div className="grid gap-3">
      <button type="button" className="min-h-11 justify-self-start text-sm font-semibold text-blue-700 underline" onClick={() => update({ appliances: typicalHomeSelections() })}>Not sure — use a typical home</button>
      {SOLAR_APPLIANCES.map((appliance) => {
        const selection = answers.appliances[appliance.id] ?? { id: appliance.id, include: false, qty: 0, hours: 0 };
        const loadKey = appliance.id === 'kettle' || appliance.id === 'microwave' ? 'kettleMicrowave' :
          appliance.id === 'geyser' ? 'geyserWithHouse' : appliance.category === 'pump' ? 'pumpWithHouse' : null;
        return <div key={appliance.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="flex min-h-11 items-center gap-3 font-semibold text-slate-900">
            <input type="checkbox" checked={selection.include} onChange={(event) => update({ appliances: { ...answers.appliances, [appliance.id]: { ...selection, include: event.target.checked, qty: event.target.checked ? selection.qty || 1 : 0, hours: event.target.checked ? selection.hours || 2 : 0 } } })} />
            {appliance.label}<span className="ml-auto text-sm text-slate-500">{appliance.watts} W</span>
          </label>
          {selection.include && <div className="mt-3 grid grid-cols-2 gap-3">
            <Input label="Qty" type="number" min={1} value={selection.qty || ''} onChange={(event) => update({ appliances: { ...answers.appliances, [appliance.id]: { ...selection, qty: Number(event.target.value) } } })} />
            <Input label="Hours/day" type="number" min={0} value={selection.hours || ''} onChange={(event) => update({ appliances: { ...answers.appliances, [appliance.id]: { ...selection, hours: Number(event.target.value) } } })} />
            {loadKey && <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={answers.simultaneousLoads[loadKey]} onChange={(event) => update({ simultaneousLoads: { ...answers.simultaneousLoads, [loadKey]: event.target.checked } })} />Runs at the same time as other loads</label>}
          </div>}
        </div>;
      })}
    </div>}
    {step === 'results' && path === 'guided' && result && <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Recommended system</h3>
        <p>Inverter: <strong>{result.inverterKva} kVA</strong></p><p>Battery: <strong>{result.batteryKwh} kWh</strong></p>
        <p>Solar array: <strong>{result.solarArrayKw} kW</strong> · {result.panelCount} panels</p>
        <p>Daily energy: {result.dailyEnergyKwh} kWh</p>
        {cost && <p className="mt-2">Estimated total: ${cost.total.toLocaleString('en-US')}</p>}
        <p className="mt-3">Each panel needs about 2 m² of roof.</p>
        {result.warnings.map((warning) => <p className="mt-2 text-amber-700" key={warning}>{warning}</p>)}
      </div>
      {preferences()}
    </div>}
    {step === 'quote' && <div className="grid gap-3">
      {([
        ['totalUsd', 'Quoted total price (USD)'], ['inverterKva', 'Inverter size (kVA)'], ['batteryKwh', 'Battery size (kWh)'],
        ['panelCount', 'Panel count'], ['panelWatt', 'Panel wattage'],
      ] as const).map(([key, label]) => <Input key={key} label={label} type="number" min={0} value={answers.quote[key] ?? ''} onChange={(event) => update({ quote: { ...answers.quote, [key]: Number(event.target.value) } })} />)}
      <Input label="Notes about the quote" value={answers.quote.notes} onChange={(event) => update({ quote: { ...answers.quote, notes: event.target.value } })} />
    </div>}
    {step === 'results' && path === 'quote' && <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold">Quote check summary</h3>
      <p>We will compare your quote against Zimbabwe system tiers once you save this quick project.</p>
      <p>Quoted total: {answers.quote.totalUsd ? `$${answers.quote.totalUsd}` : 'Not provided'}</p>
      <p>Inverter: {answers.quote.inverterKva ?? 'Not provided'} kVA</p>
      <p>Battery: {answers.quote.batteryKwh ?? 'Not provided'} kWh</p>
      <p>Panels: {answers.quote.panelCount ?? 'Not provided'}</p>
    </div>}
    {step !== 'size' && <div className="mt-8 flex justify-between border-t border-slate-200 pt-5">
      <Button variant="secondary" onClick={back}>Back</Button>
      {step === 'options' ? <Button variant="primary" onClick={makeBoq} disabled={!selectedPackage}>Generate BOQ</Button> :
        step === 'backup' ? <Button variant="primary" onClick={() => setStep('appliances')}>Continue</Button> :
        step === 'appliances' || step === 'quote' ? <Button variant="primary" onClick={() => setStep('results')}>Continue</Button> :
        path === 'guided' ? <Button variant="primary" onClick={makeBoq}>Generate BOQ</Button> : null}
    </div>}
  </div>;

  function preferences() {
    return <>
      <details className="rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="min-h-11 cursor-pointer font-semibold text-slate-900">Change brands <span className="font-normal text-slate-500">(No preference)</span></summary>
        <div className="grid gap-3 pt-3">{([
          ['Panel brand', panelBrand, setPanelBrand, [['no_pref', 'No preference'], ['ja_solar', 'JA Solar'], ['canadian_solar', 'Canadian Solar'], ['cheapest', 'Cheapest available']]],
          ['Inverter brand', inverterBrand, setInverterBrand, [['no_pref', 'No preference'], ['deye', 'Deye'], ['victron', 'Victron'], ['solarmd', 'SolarMD']]],
          ['Battery brand', batteryBrand, setBatteryBrand, [['no_pref', 'No preference'], ['pylontech', 'Pylontech'], ['freedom_won', 'Freedom Won']]],
        ] as const).map(([label, value, setter, options]) => <label key={label} className="grid gap-1 text-sm font-medium text-slate-700">{label}
          <select className="min-h-11 rounded-xl border border-slate-300 bg-white px-3" value={value} onChange={(event) => setter(event.target.value)}>
            {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>)}</div>
      </details>
      <div className="grid gap-2">
        <h3 className="font-semibold text-slate-900">Optional costs</h3>
        {/* A package's price already includes installation, so it has no switch. */}
        {([['Equipment delivery / transport', transport, setTransport], ...(selectedPackage && packageBrandsKept ? [] : [['Installation labour', install, setInstall]] as const), ['Contingency (5%)', contingency, setContingency]] as const).map(([label, value, setter]) =>
          <label key={label} className="flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800">
            <input type="checkbox" checked={value} onChange={(event) => setter(event.target.checked)} />{label}
          </label>)}
      </div>
    </>;
  }
}

export default function SolarQuickWizard(props: Props) {
  const isClient = useIsClient();
  if (!isClient) return <div className="h-2 w-full rounded-full bg-slate-100" aria-busy="true" />;
  return <SolarQuickWizardInner {...props} />;
}
