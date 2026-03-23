'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  Lightning,
  CheckCircle,
  Warning,
  HouseSimple,
  SunDim,
  ShieldCheck,
  Wrench,
  Info,
} from '@phosphor-icons/react';
import {
  buildDefaultSelections,
  computeSolarSizing,
  estimateHardwareCost,
} from '@/lib/quick-projects/solar/calculations';
import {
  SOLAR_APPLIANCES,
  SOLAR_INTENT_LABELS,
  SOLAR_PANEL_WATT,
  SOLAR_PACKAGES,
  INVERTER_BRANDS,
  BATTERY_BRANDS,
  PANEL_BRANDS,
  MAINTENANCE_SERVICES,
  getRequiredZeraTier,
} from '@/lib/quick-projects/solar/catalog';
import type {
  PropertyType,
  RoofShading,
  RoofType,
  SolarIntent,
  SolarWizardAnswers,
  SolarWizardOutput,
} from '@/lib/quick-projects/solar/types';
import { solarSizingToBOQ, maintenanceToBOQ } from '@/lib/quick-projects/solar/boq';
import type { BOQItem, LaborConfig } from '@/lib/quick-projects/engine/types';
import QuickBOQTable from './QuickBOQTable';
import SolarBudgetExplorer from './SolarBudgetExplorer';

const INTENTS: SolarIntent[] = ['backup', 'heavy_backup', 'off_grid', 'replace', 'budget', 'quote_check', 'maintenance'];
const PROPERTY_OPTIONS: Array<{ id: PropertyType; label: string }> = [
  { id: 'apartment', label: 'Apartment' },
  { id: 'house', label: 'House' },
  { id: 'farm', label: 'Farm / Plot' },
  { id: 'business', label: 'Business' },
];
const ROOF_TYPE_OPTIONS: Array<{ id: RoofType; label: string }> = [
  { id: 'tile', label: 'Tile' },
  { id: 'ibr', label: 'IBR (corrugated)' },
  { id: 'concrete', label: 'Concrete flat' },
  { id: 'other', label: 'Other' },
];
const SHADING_OPTIONS: Array<{ id: RoofShading; label: string }> = [
  { id: 'none', label: 'No shading' },
  { id: 'partial', label: 'Partial shading' },
  { id: 'heavy', label: 'Heavy shading' },
];

const INTENT_DESCRIPTIONS: Record<SolarIntent, string> = {
  backup: 'Keep lights, WiFi, and TV running during ZESA outages.',
  heavy_backup: 'Run fridge, freezer, and heavy loads during 4-8 hour outages.',
  off_grid: 'Full independence from ZESA — power everything 24/7.',
  replace: 'Upgrade or replace existing panels, inverter, or batteries.',
  budget: 'Tell us your budget and we\'ll find the best system that fits.',
  quote_check: 'Got a quote? We\'ll verify it against Zimbabwe market prices.',
  maintenance: 'Panel cleaning, diagnostics, battery replacement, or repairs.',
};

const defaultAnswers: SolarWizardAnswers = {
  intent: null,
  backupHours: null,
  location: '',
  propertyType: null,
  appliances: buildDefaultSelections(),
  simultaneousLoads: {
    kettleMicrowave: false,
    pumpWithHouse: false,
    geyserWithHouse: false,
  },
  roof: {
    type: null,
    shading: null,
    orientation: '',
    spaceM2: null,
  },
  existing: {
    hasExisting: false,
    inverterKva: null,
    batteryKwh: null,
    panelCount: null,
    issues: '',
  },
  budgetUsd: null,
  quote: {
    totalUsd: null,
    inverterKva: null,
    batteryKwh: null,
    panelCount: null,
    panelWatt: null,
    notes: '',
  },
};

const stepOrder = [
  'intent',
  'maintenance_select',
  'context',
  'backup',
  'appliances',
  'simultaneous',
  'roof',
  'existing',
  'budget',
  'quote',
  'results',
  'brands',
  'optional_costs',
] as const;

type StepId = typeof stepOrder[number];

const stepTitles: Record<StepId, { title: string; subtitle: string }> = {
  intent: {
    title: 'What do you need?',
    subtitle: 'Choose your goal — we\'ll tailor the experience to match.',
  },
  maintenance_select: {
    title: 'What services do you need?',
    subtitle: 'Select all maintenance and servicing tasks you need done.',
  },
  context: {
    title: 'Property context',
    subtitle: 'Location and property type help us size your system correctly.',
  },
  backup: {
    title: 'Backup hours',
    subtitle: 'Most households target 4–8 hours due to ZESA load shedding.',
  },
  appliances: {
    title: 'Appliance audit',
    subtitle: 'Tick what you need during outages. Heavy loads increase system size.',
  },
  simultaneous: {
    title: 'Simultaneous loads',
    subtitle: 'These raise inverter size because motors have surge power (up to 3× running watts).',
  },
  roof: {
    title: 'Roof and installation',
    subtitle: `Each panel needs about 2 m². Panel wattage assumed at ${SOLAR_PANEL_WATT}W.`,
  },
  existing: {
    title: 'Existing system',
    subtitle: 'Tell us what you already have so we can size upgrades properly.',
  },
  budget: {
    title: 'Budget fit',
    subtitle: 'Enter your budget and we\'ll find the best system from real Zimbabwe packages.',
  },
  quote: {
    title: 'Quote check',
    subtitle: 'Enter the details from your supplier quote — we\'ll check it against market rates.',
  },
  results: {
    title: 'Your Solar Recommendation',
    subtitle: 'Here is your sizing summary, matching packages, and cost estimate.',
  },
  brands: {
    title: 'Equipment preferences',
    subtitle: 'Choose your preferred brands or leave as default for the best value.',
  },
  optional_costs: {
    title: 'Optional costs',
    subtitle: 'Toggle any additional cost items you want included in the BOQ.',
  },
};

interface SolarQuickWizardProps {
  onChange: (output: SolarWizardOutput & { boqItems?: BOQItem[] }) => void;
  isContractor?: boolean;
  onSave?: (output: SolarWizardOutput & { boqItems?: BOQItem[] }) => void;
}

export default function SolarQuickWizard({ onChange, isContractor = false, onSave }: SolarQuickWizardProps) {
  const [answers, setAnswers] = useState<SolarWizardAnswers>(defaultAnswers);
  const [currentStep, setCurrentStep] = useState<StepId>('intent');

  // Brand preferences
  const [panelBrand, setPanelBrand] = useState('ja_solar');
  const [inverterBrand, setInverterBrand] = useState('must');
  const [batteryBrand, setBatteryBrand] = useState('dyness');

  // Optional costs
  const [includeTransport, setIncludeTransport] = useState(true);
  const [includeInstall, setIncludeInstall] = useState(true);
  const [includeContingency, setIncludeContingency] = useState(false);

  // Maintenance selections
  const [selectedMaintenance, setSelectedMaintenance] = useState<string[]>([]);

  // BOQ output
  const [boqItems, setBoqItems] = useState<BOQItem[] | null>(null);
  const [labor, setLabor] = useState<LaborConfig>({ enabled: false, method: 'percentage', percentage: 25 });

  const activeSteps = useMemo(() => {
    return stepOrder.filter((step) => {
      if (step === 'maintenance_select') return answers.intent === 'maintenance';
      if (step === 'backup') {
        return ['backup', 'heavy_backup', 'off_grid', 'replace', 'budget'].includes(answers.intent || '');
      }
      if (step === 'appliances' || step === 'simultaneous' || step === 'roof') {
        return answers.intent !== 'quote_check' && answers.intent !== 'maintenance';
      }
      if (step === 'existing') return answers.intent === 'replace';
      if (step === 'budget') return answers.intent === 'budget';
      if (step === 'quote') return answers.intent === 'quote_check';
      if (step === 'results') return answers.intent !== 'maintenance';
      if (step === 'brands' || step === 'optional_costs') {
        return answers.intent !== 'quote_check' && answers.intent !== 'maintenance';
      }
      return true;
    });
  }, [answers.intent]);

  const stepIndex = activeSteps.indexOf(currentStep);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === activeSteps.length - 1;

  const result = useMemo(() => {
    if (!answers.intent || answers.intent === 'quote_check' || answers.intent === 'maintenance') return null;
    return computeSolarSizing(answers);
  }, [answers]);

  const costEstimate = result ? estimateHardwareCost(result) : null;

  // Find matching packages for budget/results
  const matchingPackages = useMemo(() => {
    if (!result) return [];
    return SOLAR_PACKAGES
      .filter((pkg) => pkg.kva >= result.inverterKva - 2 && pkg.kva <= result.inverterKva + 3)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3);
  }, [result]);

  const budgetPackages = useMemo(() => {
    if (answers.intent !== 'budget' || !answers.budgetUsd) return [];
    return SOLAR_PACKAGES
      .filter((pkg) => pkg.price <= (answers.budgetUsd || 0))
      .sort((a, b) => b.price - a.price) // best value first (most expensive within budget)
      .slice(0, 4);
  }, [answers.intent, answers.budgetUsd]);

  const emitChange = (nextAnswers: SolarWizardAnswers) => {
    const nextResult = nextAnswers.intent && nextAnswers.intent !== 'quote_check' && nextAnswers.intent !== 'maintenance'
      ? computeSolarSizing(nextAnswers)
      : null;
    onChange({ answers: nextAnswers, result: nextResult });
  };

  const updateAnswers = (updates: Partial<SolarWizardAnswers>) => {
    setAnswers((prev) => {
      const next = { ...prev, ...updates };
      emitChange(next);
      return next;
    });
  };

  const goNext = () => {
    if (isLast) {
      // Maintenance path → generate maintenance BOQ
      if (answers.intent === 'maintenance') {
        const items = maintenanceToBOQ(selectedMaintenance);
        setBoqItems(items);
        return;
      }
      // Normal path → generate sizing BOQ
      if (result) {
        const augAnswers = {
          ...answers,
          panel_brand: panelBrand,
          inverter_brand: inverterBrand,
          battery_brand: batteryBrand,
          include_transport: includeTransport,
          include_install: includeInstall,
          include_contingency: includeContingency,
        };
        const items = solarSizingToBOQ(result, augAnswers as Parameters<typeof solarSizingToBOQ>[1]);
        setBoqItems(items);
      }
      return;
    }
    const nextStep = activeSteps[stepIndex + 1];
    if (nextStep) setCurrentStep(nextStep);
  };

  const goBack = () => {
    if (boqItems) {
      setBoqItems(null);
      return;
    }
    if (isFirst) return;
    const prevStep = activeSteps[stepIndex - 1];
    if (prevStep) setCurrentStep(prevStep);
  };

  // ── Budget Explorer view ─────────────────────────────────────────────────
  if (answers.intent === 'budget' && currentStep !== 'intent') {
    return (
      <SolarBudgetExplorer
        onBack={() => setCurrentStep('intent')}
        isContractor={isContractor}
        onSave={onSave ? (output) => onSave(output) : undefined}
      />
    );
  }

  // ── BOQ results view ──────────────────────────────────────────────────────
  if (boqItems) {
    return (
      <div className="w-full max-w-5xl mx-auto animate-fade-in pb-24">
        <button onClick={goBack} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mb-6">
          ← Back to wizard
        </button>
        <QuickBOQTable
          projectType="solar"
          initialItems={boqItems}
          labor={labor}
          onLaborChange={setLabor}
          isContractor={isContractor}
          onSave={onSave ? (items) => onSave({ answers, result, boqItems: items }) : undefined}
        />
      </div>
    );
  }

  const progressPct = Math.round((stepIndex / activeSteps.length) * 100);

  return (
    <div className="w-full max-w-3xl mx-auto pb-24">
      {/* Progress */}
      <div className="mb-10">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          <span>Step {stepIndex + 1} of {activeSteps.length}</span>
          <span className="text-blue-600">{progressPct}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Header */}
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500 mb-2 block">SOLAR GUIDED SETUP</span>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{stepTitles[currentStep].title}</h2>
        <p className="text-slate-600 text-base">{stepTitles[currentStep].subtitle}</p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full"
        >

      {/* ── Intent Selection ──────────────────────────────────────────────── */}
      {currentStep === 'intent' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {INTENTS.map((intent) => {
            const active = answers.intent === intent;
            const isMaint = intent === 'maintenance';
            return (
              <button
                key={intent}
                type="button"
                onClick={() => updateAnswers({ intent })}
                className={`group relative flex flex-col items-start p-4 rounded-xl border transition-all duration-200 text-left ${active ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'}`}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                     {isMaint
                       ? <Wrench size={20} className={active ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500 transition-colors'} />
                       : <Lightning size={20} className={active ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500 transition-colors'} />
                     }
                     <span className={`text-sm font-semibold ${active ? 'text-blue-900' : 'text-slate-800'}`}>
                       {SOLAR_INTENT_LABELS[intent]}
                     </span>
                  </div>
                  {active ? (
                    <CheckCircle weight="fill" className="text-blue-600 flex-shrink-0" size={20} />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-300 flex-shrink-0 group-hover:border-blue-300 transition-colors" />
                  )}
                </div>
                <p className={`mt-2 text-xs leading-relaxed ${active ? 'text-blue-700' : 'text-slate-500'}`}>
                  {INTENT_DESCRIPTIONS[intent]}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Maintenance Selection ────────────────────────────────────────── */}
      {currentStep === 'maintenance_select' && (
        <div className="grid gap-3">
          {MAINTENANCE_SERVICES.map((svc) => {
            const selected = selectedMaintenance.includes(svc.id);
            return (
              <label
                key={svc.id}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${selected ? 'border-blue-500 bg-blue-50/20 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300'}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  className="mt-0.5 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                  onChange={() => {
                    setSelectedMaintenance((prev) =>
                      prev.includes(svc.id)
                        ? prev.filter((id) => id !== svc.id)
                        : [...prev, svc.id]
                    );
                  }}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{svc.label}</span>
                    <span className="text-sm font-bold text-slate-600">${svc.price}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{svc.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* ── Context ──────────────────────────────────────────────────────── */}
      {currentStep === 'context' && (
        <div className="grid gap-6">
          <Input
            label="City / Suburb"
            placeholder="e.g. Borrowdale, Harare"
            value={answers.location}
            onChange={(event) => updateAnswers({ location: event.target.value })}
          />
          <div className="flex flex-wrap gap-2">
            {PROPERTY_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm transition-colors ${answers.propertyType === item.id ? 'border-blue-600 bg-blue-50 text-blue-800 font-medium' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
                onClick={() => updateAnswers({ propertyType: item.id })}
              >
                <HouseSimple size={16} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Backup Hours ─────────────────────────────────────────────────── */}
      {currentStep === 'backup' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[2, 4, 6, 8, 12, 24].map((hours) => {
            const active = answers.backupHours === hours;
            return (
              <button
                key={hours}
                type="button"
                onClick={() => updateAnswers({ backupHours: hours })}
                className={`flex flex-col items-center justify-center p-6 rounded-xl border transition-all duration-200 ${active ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-sm text-blue-700' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 text-slate-600'}`}
              >
                <SunDim size={28} className="mb-2" />
                <span className="font-semibold">{hours} hrs</span>
                <span className="text-xs opacity-70">backup</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Appliances ───────────────────────────────────────────────────── */}
      {currentStep === 'appliances' && (
        <div className="grid gap-3">
          {SOLAR_APPLIANCES.map((appliance) => {
            const selection = answers.appliances[appliance.id];
            if (!selection) return null;
            return (
              <div key={appliance.id} className={`p-4 rounded-xl border transition-colors ${selection.include ? 'border-blue-500 bg-blue-50/20 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selection.include}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                    onChange={(event) => {
                      const include = event.target.checked;
                      setAnswers((prev) => {
                        const next = {
                          ...prev,
                          appliances: {
                            ...prev.appliances,
                            [appliance.id]: {
                              ...prev.appliances[appliance.id],
                              include,
                              qty: include ? prev.appliances[appliance.id].qty || 1 : 0,
                              hours: include ? prev.appliances[appliance.id].hours || 2 : 0,
                            },
                          },
                        };
                        emitChange(next);
                        return next;
                      });
                    }}
                  />
                  <span className="font-semibold text-slate-900">{appliance.label}</span>
                  <small className="ml-auto text-slate-500 font-medium">{appliance.watts}W</small>
                </label>
                {selection.include && (
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-blue-100/50">
                    <Input
                      label="Qty"
                      type="number"
                      min={1}
                      value={selection.qty || ''}
                      onChange={(event) => {
                        const qty = Number(event.target.value);
                        setAnswers((prev) => {
                          const next = { ...prev, appliances: { ...prev.appliances, [appliance.id]: { ...prev.appliances[appliance.id], qty } } };
                          emitChange(next);
                          return next;
                        });
                      }}
                    />
                    <Input
                      label="Hours/day"
                      type="number"
                      min={0}
                      value={selection.hours || ''}
                      onChange={(event) => {
                        const hours = Number(event.target.value);
                        setAnswers((prev) => {
                          const next = { ...prev, appliances: { ...prev.appliances, [appliance.id]: { ...prev.appliances[appliance.id], hours } } };
                          emitChange(next);
                          return next;
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Simultaneous Loads ────────────────────────────────────────────── */}
      {currentStep === 'simultaneous' && (
        <div className="grid gap-3 p-6 rounded-2xl bg-white border border-slate-200/60 shadow-sm">
          {[
            { key: 'kettleMicrowave' as const, label: 'Kettle and microwave run together', warn: 'This draws 3,500W+ — needs at least 5kVA inverter' },
            { key: 'pumpWithHouse' as const, label: 'Pump runs with household loads', warn: 'Pump startup surge can be 3× running watts' },
            { key: 'geyserWithHouse' as const, label: 'Geyser runs with household loads', warn: 'Geyser draws 3,000W — may need dedicated circuit or 8kVA+ inverter' },
          ].map((item) => (
            <label key={item.key} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                checked={answers.simultaneousLoads[item.key]}
                onChange={(event) => updateAnswers({
                  simultaneousLoads: { ...answers.simultaneousLoads, [item.key]: event.target.checked },
                })}
              />
              <div>
                <span className="text-slate-700 font-medium">{item.label}</span>
                {answers.simultaneousLoads[item.key] && (
                  <p className="text-xs text-amber-600 mt-1">⚡ {item.warn}</p>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {/* ── Roof ─────────────────────────────────────────────────────────── */}
      {currentStep === 'roof' && (
        <div className="grid gap-6">
          <Input
            label="Roof orientation"
            placeholder="e.g. North-facing"
            value={answers.roof.orientation}
            onChange={(event) => updateAnswers({ roof: { ...answers.roof, orientation: event.target.value } })}
          />
          <Input
            label="Available roof space (m²)"
            type="number"
            min={0}
            value={answers.roof.spaceM2 || ''}
            onChange={(event) => updateAnswers({ roof: { ...answers.roof, spaceM2: Number(event.target.value) } })}
          />
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Roof type</label>
            <div className="flex flex-wrap gap-2">
              {ROOF_TYPE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors ${answers.roof.type === item.id ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
                  onClick={() => updateAnswers({ roof: { ...answers.roof, type: item.id } })}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Shading</label>
            <div className="flex flex-wrap gap-2">
              {SHADING_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors ${answers.roof.shading === item.id ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
                  onClick={() => updateAnswers({ roof: { ...answers.roof, shading: item.id } })}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Existing System ──────────────────────────────────────────────── */}
      {currentStep === 'existing' && (
        <div className="grid gap-4">
          <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              checked={answers.existing.hasExisting}
              onChange={(event) => updateAnswers({ existing: { ...answers.existing, hasExisting: event.target.checked } })}
            />
            <span className="font-medium text-slate-800">I already have a solar system</span>
          </label>
          {answers.existing.hasExisting && (
            <div className="grid gap-4 p-4 rounded-xl border border-slate-200 bg-white">
              <Input label="Current inverter (kVA)" type="number" min={0} value={answers.existing.inverterKva || ''} onChange={(e) => updateAnswers({ existing: { ...answers.existing, inverterKva: Number(e.target.value) } })} />
              <Input label="Current battery (kWh)" type="number" min={0} value={answers.existing.batteryKwh || ''} onChange={(e) => updateAnswers({ existing: { ...answers.existing, batteryKwh: Number(e.target.value) } })} />
              <Input label="Current panel count" type="number" min={0} value={answers.existing.panelCount || ''} onChange={(e) => updateAnswers({ existing: { ...answers.existing, panelCount: Number(e.target.value) } })} />
              <Input label="Main issues (optional)" placeholder="e.g. Battery not lasting, inverter trips, ZESA temper mode" value={answers.existing.issues} onChange={(e) => updateAnswers({ existing: { ...answers.existing, issues: e.target.value } })} />
            </div>
          )}
        </div>
      )}

      {/* ── Budget ───────────────────────────────────────────────────────── */}
      {currentStep === 'budget' && (
        <div className="grid gap-6">
          <Input
            label="Target budget (USD)"
            type="number"
            min={500}
            step={100}
            value={answers.budgetUsd || ''}
            onChange={(event) => updateAnswers({ budgetUsd: Number(event.target.value) })}
          />
          {budgetPackages.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-700">Packages within your budget:</h4>
              {budgetPackages.map((pkg) => (
                <div key={pkg.id} className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900">{pkg.name}</span>
                    <span className="text-lg font-bold text-emerald-600">${pkg.price.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-500">{pkg.provider} · {pkg.kva}kVA · {pkg.batteryKwh}kWh · {pkg.panelCount}× {pkg.panelWatt}W panels</p>
                  <p className="text-xs text-slate-400 mt-1">Runs: {pkg.appliances}</p>
                </div>
              ))}
            </div>
          )}
          {answers.budgetUsd && budgetPackages.length === 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-100">
              <Warning size={18} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm">No standard packages found within ${answers.budgetUsd}. The minimum entry-level system starts around $900. We&apos;ll still size a custom system for your budget.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Quote Check ──────────────────────────────────────────────────── */}
      {currentStep === 'quote' && (
        <div className="grid gap-4">
          <Input label="Quoted total price (USD)" type="number" min={0} value={answers.quote.totalUsd || ''} onChange={(e) => updateAnswers({ quote: { ...answers.quote, totalUsd: Number(e.target.value) } })} />
          <Input label="Inverter size (kVA)" type="number" min={0} value={answers.quote.inverterKva || ''} onChange={(e) => updateAnswers({ quote: { ...answers.quote, inverterKva: Number(e.target.value) } })} />
          <Input label="Battery size (kWh)" type="number" min={0} value={answers.quote.batteryKwh || ''} onChange={(e) => updateAnswers({ quote: { ...answers.quote, batteryKwh: Number(e.target.value) } })} />
          <Input label="Panel count" type="number" min={0} value={answers.quote.panelCount || ''} onChange={(e) => updateAnswers({ quote: { ...answers.quote, panelCount: Number(e.target.value) } })} />
          <Input label="Panel wattage" type="number" min={0} value={answers.quote.panelWatt || ''} onChange={(e) => updateAnswers({ quote: { ...answers.quote, panelWatt: Number(e.target.value) } })} />
          <Input label="Notes about the quote" placeholder="e.g. Deye inverter, Dyness battery, 2 year warranty" value={answers.quote.notes} onChange={(e) => updateAnswers({ quote: { ...answers.quote, notes: e.target.value } })} />
        </div>
      )}

      {/* ── Results (sizing) ─────────────────────────────────────────────── */}
      {currentStep === 'results' && result && (
        <div className="space-y-4">
          {/* System sizing card */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><ShieldCheck size={20} className="text-blue-600" /> Recommended System</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Inverter', value: `${result.inverterKva} kVA` },
                { label: 'Battery storage', value: `${result.batteryKwh} kWh` },
                { label: 'Solar array', value: `${result.solarArrayKw} kW` },
                { label: 'Panels needed', value: `${result.panelCount} panels` },
                { label: 'Daily energy', value: `${result.dailyEnergyKwh} kWh` },
                { label: 'ZERA tier required', value: getRequiredZeraTier(result.solarArrayKw * 1000) },
              ].map((row) => (
                <div key={row.label} className="flex justify-between p-2 rounded-lg bg-slate-50">
                  <span className="text-slate-500">{row.label}</span>
                  <strong className="text-slate-900">{row.value}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Cost estimate card */}
          {costEstimate && (
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <h4 className="font-bold text-slate-900 mb-4">Estimated Cost (USD)</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Hardware</span><strong>${costEstimate.hardware.toLocaleString()}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Installation (20%)</span><strong>${costEstimate.install.toLocaleString()}</strong></div>
                <div className="flex justify-between border-t border-slate-100 pt-2"><span className="font-semibold text-slate-700">Total</span><strong className="text-lg text-emerald-600">${costEstimate.total.toLocaleString()}</strong></div>
              </div>
              <p className="text-xs text-slate-400 mt-3">Typical range: ${result.estimatedCostUsd.low.toLocaleString()}–${result.estimatedCostUsd.high.toLocaleString()}</p>
            </div>
          )}

          {/* Matching packages */}
          {matchingPackages.length > 0 && (
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <h4 className="font-bold text-slate-900 mb-3">Matching Pre-Built Packages</h4>
              <p className="text-xs text-slate-500 mb-3">Real packages from Zimbabwe suppliers that match your sizing:</p>
              {matchingPackages.map((pkg) => (
                <div key={pkg.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 mb-2 last:mb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800">{pkg.name}</span>
                    <span className="font-bold text-emerald-600">${pkg.price.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{pkg.provider} · {pkg.kva}kVA · {pkg.batteryKwh}kWh · {pkg.panelCount}× {pkg.panelWatt}W</p>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50/50">
              <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2"><Warning size={18} /> Important Notes</h4>
              <ul className="space-y-2">
                {result.warnings.map((note) => (
                  <li key={note} className="text-sm text-amber-800 flex items-start gap-2">
                    <span className="mt-1 block w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ZESA integration tip */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100/50">
            <Info size={18} className="flex-shrink-0 mt-0.5 text-blue-600" />
            <div className="text-sm text-blue-800">
              <strong>ZESA Integration:</strong> Your installer must separate the solar neutral from the ZESA neutral wire during installation. Incorrect wiring causes prepaid meters to enter &quot;temper mode&quot; and refuse to load tokens.
            </div>
          </div>
        </div>
      )}

      {/* ── Results (quote check) ────────────────────────────────────────── */}
      {currentStep === 'results' && answers.intent === 'quote_check' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50/50">
            <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2"><Warning size={18} /> Quote Check Summary</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Quoted total</span><strong>{answers.quote.totalUsd ? `$${answers.quote.totalUsd.toLocaleString()}` : 'Not provided'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-600">Inverter</span><strong>{answers.quote.inverterKva ? `${answers.quote.inverterKva} kVA` : 'Not provided'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-600">Battery</span><strong>{answers.quote.batteryKwh ? `${answers.quote.batteryKwh} kWh` : 'Not provided'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-600">Panels</span><strong>{answers.quote.panelCount ? `${answers.quote.panelCount} panels` : 'Not provided'}</strong></div>
            </div>
            <p className="text-xs text-amber-700 mt-3">We&apos;ll compare your quote against Zimbabwe market tiers once you generate the BOQ.</p>
          </div>
        </div>
      )}

        </motion.div>
      </AnimatePresence>

      {/* ── Brand Picker ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {currentStep === 'brands' && (
          <motion.div
            key="brands"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Panel brands */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Solar Panel Brand</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PANEL_BRANDS.map((b) => (
                  <button
                    key={b.brand}
                    type="button"
                    className={`flex flex-col items-start p-3 rounded-xl border text-left text-sm transition-colors ${panelBrand === b.brand ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                    onClick={() => setPanelBrand(b.brand)}
                  >
                    <span className="font-semibold text-slate-800">{b.label}</span>
                    <span className="text-xs text-slate-500">{b.watt}W · ${b.pricePerPanel}/panel</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Inverter brands */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Inverter Brand</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {INVERTER_BRANDS.map((b) => {
                  const price5kva = b.prices[5] ?? Object.values(b.prices)[0];
                  return (
                    <button
                      key={b.brand}
                      type="button"
                      className={`flex flex-col items-start p-3 rounded-xl border text-left text-sm transition-colors ${inverterBrand === b.brand ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                      onClick={() => setInverterBrand(b.brand)}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-semibold text-slate-800">{b.label}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${b.tier === 'budget' ? 'bg-green-100 text-green-700' : b.tier === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{b.tier}</span>
                      </div>
                      <span className="text-xs text-slate-500 mt-1">{b.description}</span>
                      <span className="text-xs font-medium text-slate-600 mt-1">~${price5kva} for 5kVA</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Battery brands */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Battery Brand</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BATTERY_BRANDS.map((b) => (
                  <button
                    key={b.brand}
                    type="button"
                    className={`flex flex-col items-start p-3 rounded-xl border text-left text-sm transition-colors ${batteryBrand === b.brand ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                    onClick={() => setBatteryBrand(b.brand)}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-semibold text-slate-800">{b.label}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${b.tier === 'budget' ? 'bg-green-100 text-green-700' : b.tier === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{b.tier}</span>
                    </div>
                    <span className="text-xs text-slate-500 mt-1">{b.description}</span>
                    <span className="text-xs font-medium text-slate-600 mt-1">${b.unitPrice} per {b.unitKwh}kWh unit · ${b.pricePerKwh}/kWh</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Optional Costs ───────────────────────────────────────────────── */}
        {currentStep === 'optional_costs' && (
          <motion.div
            key="optional-costs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid gap-2"
          >
            {[
              { id: 'transport',   label: 'Equipment delivery / transport ($80)', val: includeTransport, set: setIncludeTransport },
              { id: 'install',     label: 'Installation labor (20% of hardware)', val: includeInstall, set: setIncludeInstall },
              { id: 'contingency', label: 'Contingency (5%)', val: includeContingency, set: setIncludeContingency },
            ].map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={opt.val} onChange={(e) => opt.set(e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 focus:ring-offset-0" />
                <span className="font-medium text-slate-800">{opt.label}</span>
              </label>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-12 flex items-center justify-between border-t border-slate-200/50 pt-6">
        <div>
          {(!isFirst || boqItems) && (
             <Button variant="secondary" onClick={goBack} className="bg-white">
               Back
             </Button>
          )}
        </div>
        <Button
          variant="primary"
          onClick={goNext}
          className={isLast ? "bg-emerald-600 shadow-lg shadow-emerald-500/25 hover:bg-emerald-700 text-white" : "shadow-lg shadow-blue-500/25"}
        >
          {isLast ? 'Generate BOQ' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
