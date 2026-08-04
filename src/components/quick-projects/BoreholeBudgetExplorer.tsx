'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
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
  ShareNetwork,
  FileText,
  ArrowLeft,
  Funnel,
  Gauge,
} from '@phosphor-icons/react';
import { useToast } from '@/components/ui/Toast';
import { BOREHOLE_PRICES as P, LOCATION_DEFAULTS } from '@/lib/quick-projects/borehole/catalog';
import { calculateBoreholeBOQ } from '@/lib/quick-projects/borehole/calculations';
// Shared with calculations.ts. These used to be defined here as well, and the
// two copies drifted — the explorer showed one casing grade and the BOQ quoted
// another.
import {
  getCasingLabel,
  getCasingPrice,
  getMobilisationCost,
  getPumpPrice,
  getSurveyCost,
  getTankCost,
  type CasingGrade,
  type PumpType,
  type TankSize,
} from '@/lib/quick-projects/borehole/pricing';
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


const numberInputStyle: CSSProperties = {
  MozAppearance: 'textfield',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

// ─── Props ─────────────────────────────────────────────────────────────────────

interface BoreholeBudgetExplorerProps {
  onBack: () => void;
  /** Names the destination; the default matches the wizard these came from. */
  backLabel?: string;
  isContractor?: boolean;
  onSave?: (items: BOQItem[], answers: Answers, labor: LaborConfig) => void | Promise<void>;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function BoreholeBudgetExplorer({ onBack, backLabel = 'Back to Borehole Setup', isContractor = false, onSave }: BoreholeBudgetExplorerProps) {
  // Budget
  // The field holds raw text and the number is derived from it. Clamping with
  // Math.max(1000, ...) inside onChange meant every keystroke snapped back to
  // 1000, so the field could not be cleared and a value could not be typed
  // downward — pressing backspace on "5000" jumped straight to 1000 again.
  const [budgetInput, setBudgetInput] = useState<string>('5000');
  const budget = Number(budgetInput.replace(/[^0-9]/g, '')) || 0;
  const setBudget = (amount: number) => setBudgetInput(String(amount));

  // Guidance rather than validation: the estimate still runs, we just say when
  // the figure looks unlikely to buy a working borehole.
  const budgetNotice = (() => {
    if (budgetInput.trim() === '' || budget === 0) {
      return { tone: 'hint' as const, text: 'Enter what you have available and we will show what it covers.' };
    }
    if (budget < 2000) {
      return {
        tone: 'warn' as const,
        text: 'Most boreholes in Zimbabwe start near $2,500 once drilling, casing and a pump are counted. This will show you how far short you are.',
      };
    }
    if (budget > 100000) {
      return {
        tone: 'warn' as const,
        text: 'That is far above a typical residential borehole — worth checking the figure before you plan around it.',
      };
    }
    return null;
  })();

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

  const [isSaving, setIsSaving] = useState(false);

  const { success: showSuccess, error: showError } = useToast();

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

    const surveyCost = getSurveyCost(areaType);
    const servicesCost = enabledCards.services
      ? surveyCost + P.borehole_flushing + P.yield_test + P.water_test_bacteriological
      : 0;

    const permitsCost = enabledCards.permits ? P.zinwa_permit_gw1 + locMeta.councilFee : 0;

    const transportCost = enabledCards.transport ? getMobilisationCost(areaType) : 0;

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

  // Everything the user chose. Previously only the first six went across, so
  // the BOQ re-picked the pump, the casing grade and the tank for itself and
  // ignored every component switched off here.
  const buildAnswers = (): Answers => ({
    estimate_mode: 'budget',
    configured: true,
    budget_amount: String(budget),
    budget_depth: String(depth),
    borehole_purpose: purpose,
    project_location: location,
    area_type: areaType,
    pump_power_source: pumpType,
    casing_class: casingGrade,
    tank_capacity: tankSize,
    use_combo: useCombo,
    include_drilling: enabledCards.drilling,
    include_casing: enabledCards.casing,
    include_pump: enabledCards.pump,
    include_tank: enabledCards.tank,
    include_services: enabledCards.services,
    include_permits: enabledCards.permits,
    include_transport: enabledCards.transport,
  });

  // Generate BOQ using existing budget calculator
  const generateBOQ = () => {
    setBoqItems(calculateBoreholeBOQ(buildAnswers()));
  };

  // Saves from the action row rather than from inside the BOQ table, so the
  // three budget tabs offer the same actions in the same place. The dialog that
  // used to sit here asked for a project name and then discarded it — it only
  // ever called generateBOQ, so nothing was saved.
  const handleSaveProject = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(calculateBoreholeBOQ(buildAnswers()), buildAnswers(), labor);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    const shareText = [
      'ZimEstimate Borehole Budget',
      `Budget: $${budget.toLocaleString()}`,
      `Depth: ${depth}m`,
      `Pump: ${pumpType}`,
      `Allocated: $${Math.round(totalAllocated).toLocaleString()} (${budgetPct}% of budget)`,
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Borehole Budget Estimate', text: shareText, url: window.location.href });
        showSuccess('Estimate shared.');
        return;
      }
      await navigator.clipboard.writeText(`${shareText}\n\n${window.location.href}`);
      showSuccess('Estimate summary copied to clipboard.');
    } catch {
      showError('Sharing was cancelled or unavailable.');
    }
  };

  // ── BOQ View ──────────────────────────────────────────────────────────────
  if (boqItems) {
    return (
      <div className="w-full max-w-5xl mx-auto animate-fade-in pb-24">
        <button
          onClick={() => setBoqItems(null)}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors mb-6"
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
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors mb-6">
        <ArrowLeft size={16} /> {backLabel}
      </button>

      {/* Header */}
      <div className="mb-8">
        <span className="budget-eyebrow">BOREHOLE BUDGET EXPLORER</span>
        <h2 className="budget-display">What can your budget buy?</h2>
        <p className="budget-lede">Enter your budget, adjust depth and options. Toggle components on/off to see what fits.</p>
      </div>

      {/* ── Budget instrument ───────────────────────────────────────────────
          Shares the solar explorer's panel so both budget tools read as one
          product rather than two separately-built pages. */}
      <div className="budget-instrument mb-6">
        <div className="budget-instrument__grid" aria-hidden />

        <div className="budget-instrument__body">
          <label htmlFor="borehole-budget" className="budget-instrument__label">
            Your budget
          </label>

          <div className="budget-instrument__figure">
            <span className="budget-instrument__currency">$</span>
            <input
              id="borehole-budget"
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value.replace(/[^0-9]/g, ''))}
              aria-describedby="borehole-budget-notice"
              className="budget-instrument__input"
              style={numberInputStyle}
            />
          </div>

          {budget > 0 && (
            <div className="budget-instrument__meter" aria-hidden>
              <div
                className={`budget-instrument__fill${remaining < 0 ? ' is-over' : ''}`}
                style={{ width: `${Math.min(100, (totalAllocated / budget) * 100)}%` }}
              />
            </div>
          )}


          {budget > 0 && (
            <div className="budget-instrument__readout">
              <span>
                <strong>${totalAllocated.toLocaleString()}</strong> allocated
              </span>
              <span className={remaining >= 0 ? 'is-good' : 'is-over'}>
                <strong>${Math.abs(remaining).toLocaleString()}</strong>{' '}
                {remaining >= 0 ? 'left' : 'over'}
              </span>
            </div>
          )}

          {budgetNotice && (
            <p
              id="borehole-budget-notice"
              className={`budget-instrument__notice${budgetNotice.tone === 'warn' ? ' is-warn' : ''}`}
            >
              {budgetNotice.text}
            </p>
          )}

          <div className="budget-instrument__presets">
            {[2000, 3000, 5000, 7500, 10000, 15000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBudget(amt)}
                className={`budget-chip${budget === amt ? ' is-active' : ''}`}
              >
                ${amt.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Config Row: Depth + Purpose + Location ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Depth slider */}
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Drilling Depth</label>
          <div className="text-3xl font-extrabold text-[var(--color-text)] mb-2">{depth}m</div>
          <input
            type="range"
            min={20}
            max={160}
            step={5}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
            <span>20m</span>
            <span>160m</span>
          </div>
          {depth < 40 && (
            <p className="text-xs text-amber-600 mt-2 font-medium">Below 40m may not reach the water table in many areas of Zimbabwe.</p>
          )}
        </div>

        {/* Purpose */}
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Purpose</label>
          <div className="flex flex-col gap-2">
            {[
              { id: 'domestic' as const, label: 'Domestic', desc: 'Home use, 140mm casing' },
              { id: 'commercial' as const, label: 'Commercial', desc: 'Farm/business, 180mm casing' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPurpose(opt.id)}
                className={`text-left p-2.5 rounded-lg border text-sm transition-colors ${
                  purpose === opt.id ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-blue-800' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-blue-300'
                }`}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className="block text-xs opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Location</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-[var(--color-border)] text-sm font-medium text-slate-700 bg-[var(--color-surface)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20 outline-none"
          >
            {Object.entries(LOCATION_DEFAULTS).map(([key, meta]: [string, { depth: number; councilFee: number }]) => (
              <option key={key} value={key}>
                {key.charAt(0).toUpperCase() + key.slice(1)} (avg {meta.depth}m)
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">Average depth: {locMeta.depth}m · Council fee: ${locMeta.councilFee}</p>
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
        <div className="h-3 w-full bg-[var(--color-border-light)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              budgetPct > 100 ? 'bg-red-500' : budgetPct > 90 ? 'bg-amber-500' : 'bg-gradient-to-r from-[var(--color-accent)] to-emerald-400'
            }`}
            style={{ width: `${Math.min(budgetPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
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
                card.enabled ? 'border-blue-200 bg-[var(--color-surface)] shadow-sm' : 'border-[var(--color-border)] bg-slate-50/50 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => toggleCard(card.id)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${card.enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-dark)]'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-[var(--color-surface)] shadow transition-transform ${card.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </button>
                <div className={`flex-shrink-0 ${card.enabled ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>{card.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-sm ${card.enabled ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}>{card.label}</span>
                    <span className={`text-lg font-bold tabular-nums ${card.enabled ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
                      ${Math.round(card.cost).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">{card.description}</p>
                </div>
                {hasOptions && card.enabled && (
                  <button onClick={() => toggleExpand(card.id)} className="p-1.5 rounded-lg hover:bg-[var(--color-border-light)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors flex-shrink-0">
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
                    <div className="px-4 pb-4 pt-1 border-t border-[var(--color-border-light)]">
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
                                  pumpType === opt.id ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] ring-1 ring-[var(--color-accent)]/20' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-300'
                                }`}
                              >
                                <div className="flex w-full items-center justify-between">
                                  <span className="font-semibold text-[var(--color-text)]">{opt.label}</span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                    opt.tier === 'recommended' ? 'bg-green-100 text-green-700' : opt.tier === 'basic' ? 'bg-[var(--color-border-light)] text-[var(--color-text-secondary)]' : 'bg-blue-100 text-[var(--color-accent-dark)]'
                                  }`}>{opt.tier}</span>
                                </div>
                                <span className="text-xs text-[var(--color-text-secondary)] mt-1">{opt.desc}</span>
                                <span className="text-xs font-medium text-[var(--color-text-secondary)] mt-1">${p.price.toLocaleString()} for {depth}m depth</span>
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
                                  casingGrade === opt.id ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] ring-1 ring-[var(--color-accent)]/20' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-300'
                                }`}
                              >
                                <span className="font-semibold text-[var(--color-text)]">{opt.label}</span>
                                <span className="text-xs text-[var(--color-text-secondary)]">{opt.desc}</span>
                                <span className="text-xs font-medium text-[var(--color-text-secondary)] mt-1">${price.toFixed(2)}/m × {depth}m = ${Math.round(price * depth)}</span>
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
                                    tankSize === opt.id ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] ring-1 ring-[var(--color-accent)]/20' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-300'
                                  }`}
                                >
                                  <span className="font-semibold text-[var(--color-text)]">{opt.label}</span>
                                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">${t.cost.toLocaleString()}</span>
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
                                className="w-4 h-4 rounded border-[var(--color-border-dark)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
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
      <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm mb-6">
        <h4 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
          <CheckCircle size={20} weight="fill" className="text-[var(--color-accent)]" />
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
                <span className="text-[var(--color-text-secondary)]">{row.label}</span>
                <strong className="text-[var(--color-text)]">{row.value}</strong>
              </div>
            ))}
        </div>

        {/* Assumptions */}
        <div className="mt-4 p-3 rounded-lg bg-[var(--color-accent-muted)]/50 border border-blue-100/50">
          <p className="text-xs font-semibold text-blue-800 mb-1">Assumptions</p>
          <ul className="text-xs text-[var(--color-accent-dark)] space-y-0.5">
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
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-accent-muted)] border border-blue-100/50 mb-6">
          <Info size={18} className="flex-shrink-0 mt-0.5 text-[var(--color-accent)]" />
          <div className="text-sm text-blue-800">
            <strong>Electric pump selected.</strong> Ensure you have reliable ZESA power or a generator. Consider hybrid if power is intermittent — it auto-switches between solar and grid.
          </div>
        </div>
      )}

      {/* ── Action Buttons ───────────────────────────────────────────────────── */}
      {/* Same three actions, same order and labels as the house and solar budget
          tabs — see the note in quick-budget/page.tsx. */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6 border-t border-[var(--color-border)]">
        <Button
          variant="primary"
          icon={<FloppyDisk size={16} />}
          onClick={handleSaveProject}
          loading={isSaving}
          disabled={!onSave || totalAllocated === 0}
        >
          Save Project
        </Button>
        <Button variant="secondary" icon={<ShareNetwork size={16} />} onClick={handleShare} className="bg-[var(--color-surface)]">
          Share
        </Button>
        <Button
          variant="secondary"
          icon={<FileText size={16} />}
          onClick={generateBOQ}
          disabled={totalAllocated === 0}
          className="bg-[var(--color-surface)]"
        >
          Generate BOQ
        </Button>
      </div>
    </div>
  );
}
