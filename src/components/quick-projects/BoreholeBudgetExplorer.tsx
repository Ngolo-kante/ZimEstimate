'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  Drop,
  Lightning,
  ShieldCheck,
  Truck,
  CaretDown,
  CaretUp,
  CheckCircle,
  Warning,
  Info,
  FloppyDisk,
  ArrowLeft,
  Funnel,
  Gauge,
} from '@phosphor-icons/react';
import { BOREHOLE_PRICES as P, LOCATION_DEFAULTS } from '@/lib/quick-projects/borehole/catalog';
import { calculateBoreholeBOQ } from '@/lib/quick-projects/borehole/calculations';
import type { BOQItem, LaborConfig, Answers } from '@/lib/quick-projects/engine/types';
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

type PumpType = 'solar' | 'hybrid' | 'electric' | 'hand';
type CasingGrade = 'class_6' | 'class_9' | 'class_10';
type TankSize = '2000' | '2500' | '5000' | '10000' | 'none';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getSolarKitPrice(depth: number): { price: number; desc: string } {
  if (depth > 120) return { price: P.solar_kit_3hp, desc: '3.0 HP solar kit (deep/commercial)' };
  if (depth > 100) return { price: P.solar_kit_2hp, desc: '2.0 HP solar kit' };
  if (depth > 80)  return { price: P.solar_kit_15hp, desc: '1.5 HP solar kit (high yield)' };
  if (depth > 50)  return { price: P.solar_kit_1hp, desc: '1.0 HP solar kit' };
  if (depth > 30)  return { price: P.solar_kit_075hp, desc: '0.75 HP solar kit' };
  return { price: P.solar_kit_05hp, desc: '0.5 HP solar kit' };
}

function getHybridKitPrice(depth: number): { price: number; desc: string } {
  if (depth > 100) return { price: P.hybrid_kit_2hp, desc: '2.0 HP hybrid AC/DC kit' };
  if (depth > 60)  return { price: P.hybrid_kit_15hp, desc: '1.5 HP hybrid AC/DC kit' };
  return { price: P.hybrid_kit_1hp, desc: '1.0 HP hybrid AC/DC kit' };
}

function getElectricKitPrice(depth: number): { price: number; desc: string } {
  if (depth > 120) return { price: P.electric_kit_3hp, desc: '3.0 HP electric submersible' };
  if (depth > 100) return { price: P.electric_kit_2hp, desc: '2.0 HP electric submersible' };
  if (depth > 50)  return { price: P.electric_kit_1hp, desc: '1.0 HP electric submersible' };
  return { price: P.electric_kit_075hp, desc: '0.75 HP electric submersible' };
}

function getPumpPrice(type: PumpType, depth: number): { price: number; desc: string } {
  switch (type) {
    case 'solar': return getSolarKitPrice(depth);
    case 'hybrid': return getHybridKitPrice(depth);
    case 'electric': return getElectricKitPrice(depth);
    case 'hand': return { price: P.pump_hand_afridev, desc: 'Afridev hand pump' };
  }
}

function getCasingPrice(grade: CasingGrade, diameter: '140mm' | '180mm'): number {
  const d = diameter === '180mm' ? '180' : '140';
  const c = grade === 'class_10' ? 'c10' : grade === 'class_9' ? 'c9' : 'c6';
  const key = `casing_upvc_${d}_${c}` as keyof typeof P;
  return (P[key] as number) ?? P.casing_upvc_140_c6;
}

function getCasingLabel(grade: CasingGrade): string {
  if (grade === 'class_10') return 'Class 10 — premium';
  if (grade === 'class_9') return 'Class 9 — mid-grade';
  return 'Class 6 — standard';
}

function getTankCost(size: TankSize, useCombo: boolean): { cost: number; desc: string } {
  if (size === 'none') return { cost: 0, desc: 'No tank' };
  if (useCombo && size === '10000') return { cost: P.combo_10000L_4m, desc: '10,000L tank + 4m stand (combo)' };
  if (useCombo && size === '5000') return { cost: P.combo_5000L_4m, desc: '5,000L tank + 4m stand (combo)' };
  const tankKey = `tank_${size}L` as keyof typeof P;
  const tankPrice = (P[tankKey] as number) ?? 700;
  return { cost: tankPrice + P.tank_stand_4m, desc: `${Number(size).toLocaleString()}L tank + 4m stand (separate)` };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface BoreholeBudgetExplorerProps {
  onBack: () => void;
  isContractor?: boolean;
  onSave?: (items: BOQItem[], answers: Answers, labor: LaborConfig) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function BoreholeBudgetExplorer({ onBack, isContractor = false, onSave }: BoreholeBudgetExplorerProps) {
  // Budget
  const [budget, setBudget] = useState<number>(5000);

  // Depth slider
  const [depth, setDepth] = useState<number>(40);

  // Purpose
  const [purpose, setPurpose] = useState<'domestic' | 'commercial'>('domestic');

  // Location
  const [location, setLocation] = useState<string>('other');

  // Enabled cards
  const [enabledCards, setEnabledCards] = useState<Record<string, boolean>>({
    drilling: true,
    casing: true,
    pump: true,
    tank: true,
    services: true,
    permits: true,
    transport: true,
  });

  // Options
  const [pumpType, setPumpType] = useState<PumpType>('solar');
  const [casingGrade, setCasingGrade] = useState<CasingGrade>('class_6');
  const [tankSize, setTankSize] = useState<TankSize>('5000');
  const [useCombo, setUseCombo] = useState(true);

  // Expanded card
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // BOQ view
  const [boqItems, setBoqItems] = useState<BOQItem[] | null>(null);
  const [labor, setLabor] = useState<LaborConfig>({ enabled: false, method: 'percentage', percentage: 25 });

  // Save dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState('');

  const locMeta = LOCATION_DEFAULTS[location] || LOCATION_DEFAULTS.other;
  const areaType = ['harare', 'bulawayo', 'chitungwiza'].includes(location) ? 'urban' : 'peri_urban';
  const diameter = purpose === 'domestic' ? '140mm' as const : '180mm' as const;

  // ── Costs ─────────────────────────────────────────────────────────────────
  const costs = useMemo(() => {
    const drillingCost = enabledCards.drilling ? depth * P.drilling_per_m : 0;

    const casingPerM = getCasingPrice(casingGrade, diameter);
    const casingCost = enabledCards.casing ? depth * casingPerM : 0;
    const gravelCost = enabledCards.casing ? +(depth * 0.03).toFixed(1) * P.gravel_pack_per_m3 + P.wellhead_assembly : 0;

    const pump = getPumpPrice(pumpType, depth);
    const risingMain = pumpType !== 'hand' ? (depth + 5) * (purpose === 'domestic' ? P.rising_hdpe_25mm : P.rising_hdpe_32mm) : 0;
    const pumpCost = enabledCards.pump ? pump.price + risingMain + P.pump_installation : 0;

    const tank = getTankCost(tankSize, useCombo);
    const tankCost = enabledCards.tank ? tank.cost : 0;

    const surveyKey = `site_survey_${areaType}` as keyof typeof P;
    const surveyCost = (P[surveyKey] as number) || P.site_survey_peri_urban;
    const servicesCost = enabledCards.services
      ? surveyCost + P.borehole_flushing + P.yield_test + P.water_test_bacteriological
      : 0;

    const permitsCost = enabledCards.permits ? P.zinwa_permit_gw1 + locMeta.councilFee : 0;

    const extraKm = areaType === 'urban' ? 0 : 15;
    const mobilCost = P.mobilization_base + Math.max(0, extraKm) * P.mobilization_per_km;
    const transportCost = enabledCards.transport ? mobilCost : 0;

    return {
      drilling: drillingCost,
      casing: casingCost + gravelCost,
      pump: pumpCost,
      tank: tankCost,
      services: servicesCost,
      permits: permitsCost,
      transport: transportCost,
      pumpDesc: pump.desc,
      tankDesc: tank.desc,
      casingLabel: getCasingLabel(casingGrade),
    };
  }, [enabledCards, depth, pumpType, casingGrade, tankSize, useCombo, purpose, diameter, areaType, locMeta]);

  const totalAllocated = Object.entries(costs)
    .filter(([k]) => !['pumpDesc', 'tankDesc', 'casingLabel'].includes(k))
    .reduce((s, [, v]) => s + (typeof v === 'number' ? v : 0), 0);
  const remaining = budget - totalAllocated;
  const budgetPct = Math.min(100, Math.round((totalAllocated / budget) * 100));

  const toggleCard = useCallback((id: string) => {
    setEnabledCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedCard((prev) => (prev === id ? null : id));
  }, []);

  // Generate BOQ using existing budget calculator
  const generateBOQ = () => {
    const answers: Answers = {
      estimate_mode: 'budget',
      budget_amount: String(budget),
      budget_depth: String(depth),
      borehole_purpose: purpose,
      project_location: location,
      area_type: areaType,
    };
    const items = calculateBoreholeBOQ(answers);
    setBoqItems(items);
  };

  // ── BOQ View ──────────────────────────────────────────────────────────────
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
          projectType="borehole"
          initialItems={boqItems}
          labor={labor}
          onLaborChange={setLabor}
          isContractor={isContractor}
          onSave={onSave ? (items) => onSave(items, { estimate_mode: 'budget', budget_amount: String(budget), budget_depth: String(depth), borehole_purpose: purpose, project_location: location, area_type: areaType }, labor) : undefined}
        />
      </div>
    );
  }

  // ── Card definitions ──────────────────────────────────────────────────────
  const cards: ComponentCard[] = [
    {
      id: 'drilling',
      label: 'Drilling',
      icon: <Gauge size={22} weight="duotone" />,
      enabled: enabledCards.drilling,
      cost: costs.drilling,
      description: `${depth}m depth × $${P.drilling_per_m}/m — standard rotary drilling`,
    },
    {
      id: 'casing',
      label: 'Casing & Wellhead',
      icon: <Funnel size={22} weight="duotone" />,
      enabled: enabledCards.casing,
      cost: costs.casing,
      description: `PVC ${diameter} ${costs.casingLabel} + gravel pack + wellhead`,
    },
    {
      id: 'pump',
      label: 'Pump & Power',
      icon: <Lightning size={22} weight="duotone" />,
      enabled: enabledCards.pump,
      cost: costs.pump,
      description: costs.pumpDesc + ' + rising main + installation',
    },
    {
      id: 'tank',
      label: 'Water Storage',
      icon: <Drop size={22} weight="duotone" />,
      enabled: enabledCards.tank,
      cost: costs.tank,
      description: costs.tankDesc,
    },
    {
      id: 'services',
      label: 'Professional Services',
      icon: <ShieldCheck size={22} weight="duotone" />,
      enabled: enabledCards.services,
      cost: costs.services,
      description: 'Site survey, flushing, yield test, water quality test',
    },
    {
      id: 'permits',
      label: 'Permits & Compliance',
      icon: <CheckCircle size={22} weight="duotone" />,
      enabled: enabledCards.permits,
      cost: costs.permits,
      description: `ZINWA GW1 permit ($${P.zinwa_permit_gw1}) + council fee ($${locMeta.councilFee})`,
    },
    {
      id: 'transport',
      label: 'Mobilization',
      icon: <Truck size={22} weight="duotone" />,
      enabled: enabledCards.transport,
      cost: costs.transport,
      description: 'Drilling rig transport to site',
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto pb-24">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mb-6">
        <ArrowLeft size={16} /> Back to Borehole Setup
      </button>

      {/* Header */}
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500 mb-2 block">BOREHOLE BUDGET EXPLORER</span>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">What can your budget buy?</h2>
        <p className="text-slate-600 text-base">Enter your budget, adjust depth and options. Toggle components on/off to see what fits.</p>
      </div>

      {/* ── Budget Input ─────────────────────────────────────────────────────── */}
      <div className="p-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 mb-6">
        <label className="block text-sm font-bold text-slate-700 mb-3">Your Budget (USD)</label>
        <div className="flex items-center gap-4">
          <span className="text-3xl font-extrabold text-slate-400">$</span>
          <input
            type="number"
            min={1000}
            step={500}
            value={budget}
            onChange={(e) => setBudget(Math.max(1000, Number(e.target.value) || 1000))}
            className="flex-1 text-4xl font-extrabold text-slate-900 bg-transparent border-none outline-none focus:ring-0 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{ MozAppearance: 'textfield' } as any}
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {[2000, 3000, 5000, 7500, 10000, 15000].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setBudget(amt)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                budget === amt ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              ${amt.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Config Row: Depth + Purpose + Location ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Depth slider */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Drilling Depth</label>
          <div className="text-3xl font-extrabold text-slate-900 mb-2">{depth}m</div>
          <input
            type="range"
            min={20}
            max={160}
            step={5}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>20m</span>
            <span>160m</span>
          </div>
          {depth < 40 && (
            <p className="text-xs text-amber-600 mt-2 font-medium">Below 40m may not reach the water table in many areas of Zimbabwe.</p>
          )}
        </div>

        {/* Purpose */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Purpose</label>
          <div className="flex flex-col gap-2">
            {[
              { id: 'domestic' as const, label: 'Domestic', desc: 'Home use, 140mm casing' },
              { id: 'commercial' as const, label: 'Commercial', desc: 'Farm/business, 180mm casing' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPurpose(opt.id)}
                className={`text-left p-2.5 rounded-lg border text-sm transition-colors ${
                  purpose === opt.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:border-blue-300'
                }`}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className="block text-xs opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none"
          >
            {Object.entries(LOCATION_DEFAULTS).map(([key, meta]: [string, { depth: number; councilFee: number }]) => (
              <option key={key} value={key}>
                {key.charAt(0).toUpperCase() + key.slice(1)} (avg {meta.depth}m)
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-2">Average depth: {locMeta.depth}m · Council fee: ${locMeta.councilFee}</p>
        </div>
      </div>

      {/* ── Budget Progress Bar ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-semibold text-slate-700">${totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })} allocated</span>
          <span className={`font-semibold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {remaining >= 0 ? `$${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} remaining` : `$${Math.abs(remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })} over budget`}
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

      {/* ── Component Cards ──────────────────────────────────────────────────── */}
      <div className="space-y-3 mb-8">
        {cards.map((card) => {
          const isExpanded = expandedCard === card.id;
          const hasOptions = ['pump', 'casing', 'tank'].includes(card.id);

          return (
            <div
              key={card.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                card.enabled ? 'border-blue-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50/50 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => toggleCard(card.id)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${card.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${card.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </button>
                <div className={`flex-shrink-0 ${card.enabled ? 'text-blue-600' : 'text-slate-400'}`}>{card.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-sm ${card.enabled ? 'text-slate-900' : 'text-slate-500'}`}>{card.label}</span>
                    <span className={`text-lg font-bold tabular-nums ${card.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                      ${Math.round(card.cost).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{card.description}</p>
                </div>
                {hasOptions && card.enabled && (
                  <button onClick={() => toggleExpand(card.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0">
                    {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                  </button>
                )}
              </div>

              {/* Expanded options */}
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
                      {/* Pump picker */}
                      {card.id === 'pump' && (
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { id: 'solar' as PumpType, label: 'Solar', desc: 'Pump + panels + controller + frame', tier: 'recommended' },
                            { id: 'hybrid' as PumpType, label: 'Hybrid AC/DC', desc: 'Auto-switches between solar & ZESA grid', tier: 'mid' },
                            { id: 'electric' as PumpType, label: 'Electric', desc: 'Requires ZESA grid or generator power', tier: 'budget' },
                            { id: 'hand' as PumpType, label: 'Hand Pump', desc: 'Afridev — no electricity needed', tier: 'basic' },
                          ]).map((opt) => {
                            const p = getPumpPrice(opt.id, depth);
                            return (
                              <button
                                key={opt.id}
                                onClick={() => setPumpType(opt.id)}
                                className={`flex flex-col items-start p-3 rounded-xl border text-left text-sm transition-colors ${
                                  pumpType === opt.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-blue-300'
                                }`}
                              >
                                <div className="flex w-full items-center justify-between">
                                  <span className="font-semibold text-slate-800">{opt.label}</span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                    opt.tier === 'recommended' ? 'bg-green-100 text-green-700' : opt.tier === 'basic' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'
                                  }`}>{opt.tier}</span>
                                </div>
                                <span className="text-xs text-slate-500 mt-1">{opt.desc}</span>
                                <span className="text-xs font-medium text-slate-600 mt-1">${p.price.toLocaleString()} for {depth}m depth</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Casing picker */}
                      {card.id === 'casing' && (
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { id: 'class_6' as CasingGrade, label: 'Class 6', desc: 'Standard residential' },
                            { id: 'class_9' as CasingGrade, label: 'Class 9', desc: 'Mid-grade durability' },
                            { id: 'class_10' as CasingGrade, label: 'Class 10', desc: 'Premium / deep wells' },
                          ]).map((opt) => {
                            const price = getCasingPrice(opt.id, diameter);
                            return (
                              <button
                                key={opt.id}
                                onClick={() => setCasingGrade(opt.id)}
                                className={`flex flex-col items-start p-3 rounded-xl border text-left text-sm transition-colors ${
                                  casingGrade === opt.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-blue-300'
                                }`}
                              >
                                <span className="font-semibold text-slate-800">{opt.label}</span>
                                <span className="text-xs text-slate-500">{opt.desc}</span>
                                <span className="text-xs font-medium text-slate-600 mt-1">${price.toFixed(2)}/m × {depth}m = ${Math.round(price * depth)}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Tank picker */}
                      {card.id === 'tank' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {([
                              { id: '2000' as TankSize, label: '2,000L' },
                              { id: '2500' as TankSize, label: '2,500L' },
                              { id: '5000' as TankSize, label: '5,000L' },
                              { id: '10000' as TankSize, label: '10,000L' },
                            ]).map((opt) => {
                              const t = getTankCost(opt.id, useCombo);
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => setTankSize(opt.id)}
                                  className={`flex flex-col items-center p-3 rounded-xl border text-sm transition-colors ${
                                    tankSize === opt.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-blue-300'
                                  }`}
                                >
                                  <span className="font-semibold text-slate-800">{opt.label}</span>
                                  <span className="text-xs font-medium text-slate-600">${t.cost.toLocaleString()}</span>
                                </button>
                              );
                            })}
                          </div>
                          {(tankSize === '5000' || tankSize === '10000') && (
                            <label className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={useCombo}
                                onChange={(e) => setUseCombo(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                              />
                              <span className="text-sm text-emerald-800 font-medium">Use combo package (tank + stand bundled — saves ~$200)</span>
                            </label>
                          )}
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

      {/* ── System Summary ───────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm mb-6">
        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle size={20} weight="fill" className="text-blue-600" />
          Your Borehole Summary
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: 'Depth', value: `${depth}m`, show: enabledCards.drilling },
            { label: 'Casing', value: `${diameter} ${getCasingLabel(casingGrade).split(' — ')[0]}`, show: enabledCards.casing },
            { label: 'Pump', value: pumpType.charAt(0).toUpperCase() + pumpType.slice(1), show: enabledCards.pump },
            { label: 'Tank', value: tankSize === 'none' ? 'None' : `${Number(tankSize).toLocaleString()}L`, show: enabledCards.tank },
            { label: 'Location', value: location.charAt(0).toUpperCase() + location.slice(1), show: true },
            { label: 'Purpose', value: purpose.charAt(0).toUpperCase() + purpose.slice(1), show: true },
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
            <li>Drilling: Standard rotary at ${P.drilling_per_m}/m</li>
            <li>Solar kits: Includes pump + panels + controller + mounting frame</li>
            <li>Rising main: HDPE {purpose === 'domestic' ? '25mm' : '32mm'} pipe to surface</li>
            {!enabledCards.permits && <li className="text-amber-700 font-semibold">Permits disabled — ZINWA permit is legally required</li>}
          </ul>
        </div>
      </div>

      {/* ── Warnings ─────────────────────────────────────────────────────────── */}
      {depth < 40 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
          <Warning size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <div className="text-sm text-amber-800">
            <strong>Depth below 40m.</strong> Most Zimbabwe locations require at least 40m to reliably hit the water table. Shallower boreholes risk dry holes or low yield.
          </div>
        </div>
      )}

      {!enabledCards.permits && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
          <Warning size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <div className="text-sm text-amber-800">
            <strong>ZINWA permit is legally required.</strong> Drilling without a permit can result in a $2,000 penalty. Budget at least ${P.zinwa_permit_gw1 + locMeta.councilFee} for permits.
          </div>
        </div>
      )}

      {budget < 2000 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
          <Warning size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <div className="text-sm text-amber-800">
            <strong>Budget below $2,000.</strong> A basic borehole (drilling + casing + hand pump) typically starts around $2,000-$2,500 in Zimbabwe.
          </div>
        </div>
      )}

      {/* ZESA tip for electric pumps */}
      {pumpType === 'electric' && enabledCards.pump && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100/50 mb-6">
          <Info size={18} className="flex-shrink-0 mt-0.5 text-blue-600" />
          <div className="text-sm text-blue-800">
            <strong>Electric pump selected.</strong> Ensure you have reliable ZESA power or a generator. Consider hybrid if power is intermittent — it auto-switches between solar and grid.
          </div>
        </div>
      )}

      {/* ── Action Buttons ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6 border-t border-slate-200">
        <Button variant="primary" onClick={generateBOQ} className="shadow-lg shadow-blue-500/25 flex-1" disabled={totalAllocated === 0}>
          Generate Detailed BOQ
        </Button>
        {onSave && (
          <Button variant="secondary" onClick={() => setShowSaveDialog(true)} icon={<FloppyDisk size={18} />} className="bg-white">
            Save as Project
          </Button>
        )}
      </div>

      {/* ── Save Dialog ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowSaveDialog(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Save Project</h3>
              <Input label="Project name" placeholder="e.g. My Borehole Project" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setShowSaveDialog(false)} className="flex-1 bg-white">Cancel</Button>
                <Button variant="primary" onClick={() => { generateBOQ(); setShowSaveDialog(false); }} disabled={!projectName.trim()} className="flex-1">Save</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
