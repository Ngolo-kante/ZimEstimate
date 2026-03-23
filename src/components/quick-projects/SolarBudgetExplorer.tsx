'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  Lightning,
  BatteryCharging,
  SolarPanel,
  ShieldCheck,
  Truck,
  CaretDown,
  CaretUp,
  CheckCircle,
  Warning,
  Info,
  FloppyDisk,
  ArrowLeft,
} from '@phosphor-icons/react';
import {
  INVERTER_BRANDS,
  BATTERY_BRANDS,
  PANEL_BRANDS,
  SOLAR_PACKAGES,
  getRequiredZeraTier,
  type InverterOption,
  type BatteryOption,
  type PanelOption,
} from '@/lib/quick-projects/solar/catalog';
import { solarSizingToBOQ } from '@/lib/quick-projects/solar/boq';
import type { BOQItem, LaborConfig } from '@/lib/quick-projects/engine/types';
import type { SolarWizardOutput } from '@/lib/quick-projects/solar/types';
import QuickBOQTable from './QuickBOQTable';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ComponentCard {
  id: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  cost: number;
  description: string;
}

interface BudgetAllocation {
  panels: { count: number; brand: PanelOption; cost: number };
  inverter: { kva: number; brand: InverterOption; cost: number };
  battery: { units: number; brand: BatteryOption; cost: number };
  protection: { cost: number };
  installation: { cost: number; pct: number };
}

type SolarBudgetBoqAnswers = Parameters<typeof solarSizingToBOQ>[1];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const PROTECTION_FIXED = 35 + 28 + 45 + 55 + 45 + 25 + 25 + 22 + 18 + 35 + 120 + 8; // AVS+breaker+changeover+DB+earth+surgeDC+surgeAC+dcIso+acIso+combiner+mount+antitheft
const numberInputStyle: CSSProperties = {
  MozAppearance: 'textfield',
};

function buildBudgetAnswers(budget: number): SolarWizardOutput['answers'] {
  return {
    intent: 'budget',
    backupHours: null,
    location: '',
    propertyType: null,
    appliances: {},
    simultaneousLoads: { kettleMicrowave: false, pumpWithHouse: false, geyserWithHouse: false },
    roof: { type: null, shading: null, orientation: '', spaceM2: null },
    existing: { hasExisting: false, inverterKva: null, batteryKwh: null, panelCount: null, issues: '' },
    budgetUsd: budget,
    quote: { totalUsd: null, inverterKva: null, batteryKwh: null, panelCount: null, panelWatt: null, notes: '' },
  };
}

function bestInverterForBudget(budget: number, brand: InverterOption): { kva: number; price: number } {
  const sizes = Object.entries(brand.prices)
    .map(([k, v]) => ({ kva: Number(k), price: v }))
    .sort((a, b) => b.kva - a.kva);
  for (const s of sizes) {
    if (s.price <= budget) return s;
  }
  // Return smallest available
  const smallest = sizes[sizes.length - 1];
  return smallest ?? { kva: 3, price: 350 };
}

function allocateBudget(
  totalBudget: number,
  panelBrand: PanelOption,
  inverterBrand: InverterOption,
  batteryBrand: BatteryOption,
  enabledCards: Record<string, boolean>,
  reinvestSavings: boolean
): BudgetAllocation {

  let hardwarePool = 0;
  
  if (reinvestSavings) {
     // Reinvesting means the full budget is actively divided among the *remaining* features.
     hardwarePool = (totalBudget - (enabledCards.protection ? PROTECTION_FIXED : 0)) / (enabledCards.installation ? 1.20 : 1.0);
  } else {
     // Not reinvesting means we simulate the hardware pool as if we were still paying for installation.
     // The installation portion is simply unspent, representing pure savings below the budget limit.
     hardwarePool = (totalBudget - PROTECTION_FIXED) / 1.20; 
  }
  
  if (hardwarePool < 0) hardwarePool = 0;

  let remaining = hardwarePool;

  // 1. Inverter first (core component)
  const inv = bestInverterForBudget(
    enabledCards.inverter ? remaining * 0.35 : 0,
    inverterBrand,
  );
  const inverterCost = enabledCards.inverter ? inv.price : 0;
  remaining -= inverterCost;

  // 2. Battery — allocate ~45% of remaining hardware pool
  let batteryUnits = 0;
  let batteryCost = 0;
  if (enabledCards.battery && remaining > batteryBrand.unitPrice) {
    batteryUnits = Math.max(1, Math.floor((remaining * 0.45) / batteryBrand.unitPrice));
    batteryCost = batteryUnits * batteryBrand.unitPrice;
    remaining -= batteryCost;
  }

  // 3. Panels — allocate from remaining
  let panelCount = 0;
  let panelCost = 0;
  if (enabledCards.panels && remaining > panelBrand.pricePerPanel) {
    panelCount = Math.max(1, Math.floor((remaining * 0.6) / panelBrand.pricePerPanel));
    panelCost = panelCount * panelBrand.pricePerPanel;
    remaining -= panelCost;
  }

  // 4. Protection (fixed cost)
  const protectionCost = enabledCards.protection ? Math.min(PROTECTION_FIXED, totalBudget) : 0;

  // 5. Installation (20% of hardware)
  const hardwareTotal = inverterCost + batteryCost + panelCost + protectionCost;
  const installCost = enabledCards.installation ? Math.min(hardwareTotal * 0.20, totalBudget) : 0;

  return {
    panels: { count: panelCount, brand: panelBrand, cost: panelCost },
    inverter: { kva: inv.kva, brand: inverterBrand, cost: inverterCost },
    battery: { units: batteryUnits, brand: batteryBrand, cost: batteryCost },
    protection: { cost: protectionCost },
    installation: { cost: Math.round(installCost), pct: 20 },
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SolarBudgetExplorerProps {
  onBack: () => void;
  isContractor?: boolean;
  onSave?: (output: SolarWizardOutput & { boqItems?: BOQItem[] }) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SolarBudgetExplorer({ onBack, isContractor = false, onSave }: SolarBudgetExplorerProps) {
  // Budget
  const [budget, setBudget] = useState<number>(2500);

  // Enabled cards
  const [enabledCards, setEnabledCards] = useState<Record<string, boolean>>({
    panels: true,
    inverter: true,
    battery: true,
    protection: true,
    installation: true,
  });

  // Brand selections
  const [panelBrand, setPanelBrand] = useState<string>('ja_solar');
  const [inverterBrand, setInverterBrand] = useState<string>('must');
  const [batteryBrand, setBatteryBrand] = useState<string>('dyness');

  // Expanded card for brand picker
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Project name for saving
  const [projectName, setProjectName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // BOQ view
  const [boqItems, setBoqItems] = useState<BOQItem[] | null>(null);
  const [labor, setLabor] = useState<LaborConfig>({ enabled: false, method: 'percentage', percentage: 25 });

  // Reinvest behavior toggle
  const [reinvestSavings, setReinvestSavings] = useState(true);

  // Resolve brand objects
  const pBrand = PANEL_BRANDS.find((b) => b.brand === panelBrand) ?? PANEL_BRANDS[1]; // JA Solar
  const iBrand = INVERTER_BRANDS.find((b) => b.brand === inverterBrand) ?? INVERTER_BRANDS[0]; // Must
  const bBrand = BATTERY_BRANDS.find((b) => b.brand === batteryBrand) ?? BATTERY_BRANDS[2]; // Dyness

  // Compute allocation
  const allocation = useMemo(
    () => allocateBudget(budget, pBrand, iBrand, bBrand, enabledCards, reinvestSavings),
    [budget, pBrand, iBrand, bBrand, enabledCards, reinvestSavings],
  );

  const totalAllocated = allocation.panels.cost + allocation.inverter.cost + allocation.battery.cost + allocation.protection.cost + allocation.installation.cost;
  const remaining = budget - totalAllocated;
  const budgetPct = Math.min(100, Math.round((totalAllocated / budget) * 100));

  // Matching pre-built packages
  const matchingPackages = useMemo(() => {
    return SOLAR_PACKAGES
      .filter((pkg) => pkg.price <= budget * 1.1) // within 10% over budget
      .sort((a, b) => b.price - a.price)
      .slice(0, 3);
  }, [budget]);

  const toggleCard = useCallback((id: string) => {
    setEnabledCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedCard((prev) => (prev === id ? null : id));
  }, []);

  // System summary
  const systemKw = ((allocation.panels.count * pBrand.watt) / 1000).toFixed(1);
  const storageKwh = (allocation.battery.units * bBrand.unitKwh).toFixed(1);
  const zeraTier = getRequiredZeraTier(allocation.panels.count * pBrand.watt);

  // Generate BOQ
  const generateBOQ = () => {
    const sizingResult = {
      peakLoadWatts: allocation.inverter.kva * 800,
      inverterKva: allocation.inverter.kva,
      batteryKwh: allocation.battery.units * bBrand.unitKwh,
      solarArrayKw: Number(systemKw),
      panelCount: allocation.panels.count,
      dailyEnergyKwh: Number(systemKw) * 5.5 * 0.8,
      tier: (allocation.inverter.kva <= 3 ? 'small' : allocation.inverter.kva <= 5 ? 'standard' : 'large') as 'small' | 'standard' | 'large',
      estimatedCostUsd: { low: totalAllocated * 0.9, high: totalAllocated * 1.1 },
      warnings: [] as string[],
    };

    const augAnswers: SolarBudgetBoqAnswers = {
      ...buildBudgetAnswers(budget),
      panel_brand: panelBrand,
      inverter_brand: inverterBrand,
      battery_brand: batteryBrand,
      include_transport: enabledCards.installation,
      include_install: enabledCards.installation,
      include_contingency: false,
    };

    const items = solarSizingToBOQ(sizingResult, augAnswers);
    setBoqItems(items);
  };

  // ── BOQ View ──────────────────────────────────────────────────────────────────
  if (boqItems) {
    return (
      <div className="w-full max-w-5xl mx-auto animate-fade-in pb-24">
        <button
          onClick={() => setBoqItems(null)}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to Budget Explorer
        </button>
        <QuickBOQTable
          projectType="solar"
          initialItems={boqItems}
          labor={labor}
          onLaborChange={setLabor}
          isContractor={isContractor}
          onSave={
            onSave
              ? (items) =>
                  onSave({
                    answers: buildBudgetAnswers(budget),
                    result: null,
                    boqItems: items,
                  })
              : undefined
          }
        />
      </div>
    );
  }

  // ── Card definitions ──────────────────────────────────────────────────────────
  const cards: ComponentCard[] = [
    {
      id: 'panels',
      label: 'Solar Panels',
      icon: <SolarPanel size={22} weight="duotone" />,
      enabled: enabledCards.panels,
      cost: allocation.panels.cost,
      description: `${allocation.panels.count}x ${pBrand.watt}W ${pBrand.label} — ${systemKw} kW array`,
    },
    {
      id: 'inverter',
      label: 'Inverter',
      icon: <Lightning size={22} weight="duotone" />,
      enabled: enabledCards.inverter,
      cost: allocation.inverter.cost,
      description: `${allocation.inverter.kva} kVA ${iBrand.label} hybrid inverter`,
    },
    {
      id: 'battery',
      label: 'Battery Storage',
      icon: <BatteryCharging size={22} weight="duotone" />,
      enabled: enabledCards.battery,
      cost: allocation.battery.cost,
      description: `${allocation.battery.units}x ${bBrand.unitKwh}kWh ${bBrand.label} — ${storageKwh} kWh total`,
    },
    {
      id: 'protection',
      label: 'Protection & BOS',
      icon: <ShieldCheck size={22} weight="duotone" />,
      enabled: enabledCards.protection,
      cost: allocation.protection.cost,
      description: 'AVS, breakers, changeover switch, DB, earthing, surge protection, mounting',
    },
    {
      id: 'installation',
      label: 'Installation & Transport',
      icon: <Truck size={22} weight="duotone" />,
      enabled: enabledCards.installation,
      cost: allocation.installation.cost,
      description: `Labor (${allocation.installation.pct}% of hardware) + equipment delivery`,
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto pb-24">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mb-6"
      >
        <ArrowLeft size={16} /> Back to Solar Setup
      </button>

      {/* Header */}
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500 mb-2 block">
          SOLAR BUDGET EXPLORER
        </span>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          What can your budget buy?
        </h2>
        <p className="text-slate-600 text-base">
          Enter your budget below. Toggle components on/off and change brands to see what fits.
        </p>
      </div>

      {/* ── Budget Input ─────────────────────────────────────────────────────── */}
      <div className="p-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 mb-6">
        <label className="block text-sm font-bold text-slate-700 mb-3">Your Budget (USD)</label>
        <div className="flex items-center gap-4">
          <span className="text-3xl font-extrabold text-slate-400">$</span>
          <input
            type="number"
            min={500}
            step={100}
            value={budget}
            onChange={(e) => setBudget(Math.max(500, Number(e.target.value) || 500))}
            className="flex-1 text-4xl font-extrabold text-slate-900 bg-transparent border-none outline-none focus:ring-0 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={numberInputStyle}
          />
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[1000, 1500, 2500, 3500, 5000, 7500].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setBudget(amt)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                budget === amt
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              ${amt.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Budget Progress Bar ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-semibold text-slate-700">
            ${totalAllocated.toLocaleString()} allocated
          </span>
          <span className={`font-semibold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {remaining >= 0 ? `$${remaining.toLocaleString()} remaining` : `$${Math.abs(remaining).toLocaleString()} over budget`}
          </span>
        </div>
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              budgetPct > 100 ? 'bg-red-500' : budgetPct > 90 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-emerald-400'
            }`}
            style={{ width: `${Math.min(budgetPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>$0</span>
          <span>${budget.toLocaleString()}</span>
        </div>
      </div>

      {/* ── Sizing Tips ────────────────────────────────────────────────────── */}
      <details className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50">
        <summary className="flex items-center gap-2 p-3 cursor-pointer text-sm font-semibold text-amber-800 select-none">
          <Info size={16} weight="duotone" className="text-amber-600" />
          Zimbabwe Sizing Rules
          <span className="text-xs font-normal text-amber-600 ml-auto">from your NotebookLM</span>
        </summary>
        <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-900">
          <div className="flex items-start gap-1.5">
            <Lightning size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <span>Inverter should be <strong>25-30%</strong> larger than your simultaneous load</span>
          </div>
          <div className="flex items-start gap-1.5">
            <Warning size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <span>Motors/compressors need <strong>3×</strong> inverter capacity for starting surge</span>
          </div>
          <div className="flex items-start gap-1.5">
            <SolarPanel size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <span>Panel Wh × <strong>1.3</strong> for system losses, ÷ <strong>3.1</strong> (Zim gen factor)</span>
          </div>
          <div className="flex items-start gap-1.5">
            <BatteryCharging size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <span>LiFePO4 DoD: <strong>80-95%</strong> • Nighttime load max: <strong>25%</strong> of capacity</span>
          </div>
        </div>
      </details>

      {/* ── Component Cards ──────────────────────────────────────────────────── */}
      <div className="space-y-3 mb-8">
        {cards.map((card) => {
          const isExpanded = expandedCard === card.id;
          const hasBrandPicker = ['panels', 'inverter', 'battery'].includes(card.id);

          return (
            <div
              key={card.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                card.enabled
                  ? 'border-blue-200 bg-white shadow-sm'
                  : 'border-slate-200 bg-slate-50/50 opacity-60'
              }`}
            >
              {/* Card header */}
              <div className="flex items-center gap-3 p-4">
                {/* Toggle switch */}
                <button
                  onClick={() => toggleCard(card.id)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    card.enabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      card.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>

                {/* Icon + label */}
                <div className={`flex-shrink-0 ${card.enabled ? 'text-blue-600' : 'text-slate-400'}`}>
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-sm ${card.enabled ? 'text-slate-900' : 'text-slate-500'}`}>
                      {card.label}
                    </span>
                    <span className={`text-lg font-bold tabular-nums ${card.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                      ${card.cost.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{card.description}</p>
                </div>

                {/* Expand button for brand picker */}
                {hasBrandPicker && card.enabled && (
                  <button
                    onClick={() => toggleExpand(card.id)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0"
                  >
                    {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                  </button>
                )}
              </div>

              {/* Expanded brand picker */}
              <AnimatePresence>
                {isExpanded && card.enabled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                      {/* Panel brand picker */}
                      {card.id === 'panels' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {PANEL_BRANDS.map((b) => (
                            <button
                              key={b.brand}
                              type="button"
                              onClick={() => setPanelBrand(b.brand)}
                              className={`flex flex-col items-start p-3 rounded-xl border text-left text-sm transition-colors ${
                                panelBrand === b.brand
                                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20'
                                  : 'border-slate-200 bg-white hover:border-blue-300'
                              }`}
                            >
                              <span className="font-semibold text-slate-800">{b.label}</span>
                              <span className="text-xs text-slate-500">{b.watt}W · ${b.pricePerPanel}/panel</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Inverter brand picker */}
                      {card.id === 'inverter' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {INVERTER_BRANDS.map((b) => {
                            const price5kva = b.prices[5] ?? Object.values(b.prices)[0];
                            return (
                              <button
                                key={b.brand}
                                type="button"
                                onClick={() => setInverterBrand(b.brand)}
                                className={`flex flex-col items-start p-3 rounded-xl border text-left text-sm transition-colors ${
                                  inverterBrand === b.brand
                                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20'
                                    : 'border-slate-200 bg-white hover:border-blue-300'
                                }`}
                              >
                                <div className="flex w-full items-center justify-between">
                                  <span className="font-semibold text-slate-800">{b.label}</span>
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                      b.tier === 'budget'
                                        ? 'bg-green-100 text-green-700'
                                        : b.tier === 'premium'
                                          ? 'bg-purple-100 text-purple-700'
                                          : 'bg-blue-100 text-blue-700'
                                    }`}
                                  >
                                    {b.tier}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-500 mt-1">{b.description}</span>
                                <span className="text-xs font-medium text-slate-600 mt-1">~${price5kva} for 5kVA</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Battery brand picker */}
                      {card.id === 'battery' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {BATTERY_BRANDS.map((b) => (
                            <button
                              key={b.brand}
                              type="button"
                              onClick={() => setBatteryBrand(b.brand)}
                              className={`flex flex-col items-start p-3 rounded-xl border text-left text-sm transition-colors ${
                                batteryBrand === b.brand
                                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20'
                                  : 'border-slate-200 bg-white hover:border-blue-300'
                              }`}
                            >
                              <div className="flex w-full items-center justify-between">
                                <span className="font-semibold text-slate-800">{b.label}</span>
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                    b.tier === 'budget'
                                      ? 'bg-green-100 text-green-700'
                                      : b.tier === 'premium'
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {b.tier}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 mt-1">{b.description}</span>
                              <span className="text-xs font-medium text-slate-600 mt-1">
                                ${b.unitPrice} per {b.unitKwh}kWh · ${b.pricePerKwh}/kWh
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* ── System Summary Card ──────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm mb-6">
        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle size={20} weight="fill" className="text-blue-600" />
          Your System Summary
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: 'Solar Array', value: `${systemKw} kW`, show: enabledCards.panels },
            { label: 'Panels', value: `${allocation.panels.count}x ${pBrand.watt}W`, show: enabledCards.panels },
            { label: 'Inverter', value: `${allocation.inverter.kva} kVA`, show: enabledCards.inverter },
            { label: 'Battery', value: `${storageKwh} kWh`, show: enabledCards.battery },
            { label: 'Protection', value: enabledCards.protection ? 'Included' : 'Not included', show: true },
            { label: 'ZERA Tier', value: zeraTier, show: enabledCards.panels },
          ]
            .filter((r) => r.show)
            .map((row) => (
              <div key={row.label} className="flex justify-between p-2.5 rounded-lg bg-slate-50">
                <span className="text-slate-500">{row.label}</span>
                <strong className="text-slate-900">{row.value}</strong>
              </div>
            ))}
        </div>

        {/* Assumptions */}
        <div className="mt-4 p-3 rounded-lg bg-blue-50/50 border border-blue-100/50">
          <p className="text-xs font-semibold text-blue-800 mb-1">Assumptions</p>
          <ul className="text-xs text-blue-700 space-y-0.5">
            <li>Prices: Zimbabwe Q1 2026 mid-range market rates</li>
            <li>Sun hours: 5.5h/day average (Zimbabwe)</li>
            <li>Installation: 20% of hardware cost</li>
            <li>Battery: LiFePO4 with 90-95% depth of discharge</li>
            {!enabledCards.protection && (
              <li className="text-amber-700 font-semibold">
                Protection layer disabled — not recommended, #1 cause of system failure
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* ── Matching Packages ────────────────────────────────────────────────── */}
      {matchingPackages.length > 0 && (
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm mb-6">
          <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Info size={18} className="text-blue-600" />
            Pre-Built Packages Near Your Budget
          </h4>
          <p className="text-xs text-slate-500 mb-3">Real packages from Zimbabwe suppliers:</p>
          <div className="space-y-2">
            {matchingPackages.map((pkg) => (
              <div key={pkg.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-800">{pkg.name}</span>
                  <span className={`font-bold ${pkg.price <= budget ? 'text-emerald-600' : 'text-amber-600'}`}>
                    ${pkg.price.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pkg.provider} · {pkg.kva}kVA · {pkg.batteryKwh}kWh · {pkg.panelCount}x {pkg.panelWatt}W
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Runs: {pkg.appliances}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Reinvest Savings Callout ─────────────────────────────────────────── */}
      {(!enabledCards.installation) && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex flex-col gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-6 overflow-hidden"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-emerald-600 bg-emerald-100 p-1.5 rounded-full flex-shrink-0">
                <Lightning size={16} weight="bold" />
              </div>
              <div className="flex-1 text-sm text-emerald-800">
                <strong>You&apos;ve unlocked extra budget!</strong> By toggling off installation, you&apos;ve saved roughly 20% of your total budget limit. 
                <br/>Do you want to use these savings to upgrade your hardware (better brands, bigger battery), or keep it as unspent savings?
              </div>
            </div>
            
            <div className="flex bg-white rounded-lg border border-emerald-200 overflow-hidden divide-x divide-emerald-100 mt-2">
              <button 
                onClick={() => setReinvestSavings(true)}
                className={`flex-1 flex flex-col items-center p-3 transition-colors ${reinvestSavings ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50 text-emerald-700'}`}
              >
                <span className="font-bold text-sm">Upgrade Hardware</span>
                <span className={`text-[10px] ${reinvestSavings ? 'text-emerald-100' : 'text-emerald-500'}`}>Maximized specs</span>
              </button>
              <button 
                onClick={() => setReinvestSavings(false)}
                className={`flex-1 flex flex-col items-center p-3 transition-colors ${!reinvestSavings ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-blue-700'}`}
              >
                <span className="font-bold text-sm">Keep The Savings</span>
                <span className={`text-[10px] ${!reinvestSavings ? 'text-blue-100' : 'text-blue-500'}`}>Stay below budget</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Warning if no protection ─────────────────────────────────────────── */}
      {!enabledCards.protection && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
          <Warning size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <div className="text-sm text-amber-800">
            <strong>Protection layer disabled.</strong> AVS, surge protection, and proper earthing are the #1 factor preventing premature system failure. Strongly recommended even on tight budgets.
          </div>
        </div>
      )}

      {/* ── Budget too low warning ───────────────────────────────────────────── */}
      {budget < 900 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
          <Warning size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <div className="text-sm text-amber-800">
            <strong>Budget below $900.</strong> The minimum entry-level solar system in Zimbabwe starts around $900. Consider increasing your budget or starting with a basic lighting kit.
          </div>
        </div>
      )}

      {/* ── Action Buttons ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6 border-t border-slate-200">
        <Button
          variant="primary"
          onClick={generateBOQ}
          className="shadow-lg shadow-blue-500/25 flex-1"
          disabled={totalAllocated === 0}
        >
          Generate Detailed BOQ
        </Button>
        {onSave && (
          <Button
            variant="secondary"
            onClick={() => setShowSaveDialog(true)}
            icon={<FloppyDisk size={18} />}
            className="bg-white"
          >
            Save as Project
          </Button>
        )}
      </div>

      {/* ── Save Dialog ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowSaveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-4">Save Project</h3>
              <Input
                label="Project name"
                placeholder="e.g. My Solar System"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setShowSaveDialog(false)} className="flex-1 bg-white">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    generateBOQ();
                    setShowSaveDialog(false);
                  }}
                  disabled={!projectName.trim()}
                  className="flex-1"
                >
                  Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
