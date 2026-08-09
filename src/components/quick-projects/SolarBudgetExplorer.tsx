'use client';
// v2 — combo packages + kVA guide
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { gateSaveBehindSignIn } from '@/lib/services/quickBoq';
import {
  Lightning,
  BatteryCharging,
  SolarPanel,
  ShieldCheck,
  Truck,
  Wrench,
  CaretDown,
  CaretUp,
  CheckCircle,
  Warning,
  Info,
  FloppyDisk,
  ShareNetwork,
  FileText,
  ArrowLeft,
  ArrowsClockwise,
  Coins,
  Star,
  Scales,
  Lightbulb,
  ArrowUp,
} from '@phosphor-icons/react';
import {
  INVERTER_BRANDS,
  BATTERY_BRANDS,
  PANEL_BRANDS,
  SOLAR_PACKAGES,
  KVA_POWER_GUIDE,
  getRequiredZeraTier,
  type InverterOption,
  type BatteryOption,
  type PanelOption,
  type SolarPackage,
} from '@/lib/quick-projects/solar/catalog';
import {
  solarSizingToBOQ,
  solarBalanceOfSystemCost,
  SOLAR_INSTALL_LABOR_PCT,
  SOLAR_TRANSPORT_COST,
} from '@/lib/quick-projects/solar/boq';
import type { BOQItem, LaborConfig } from '@/lib/quick-projects/engine/types';
import type { SolarWizardOutput } from '@/lib/quick-projects/solar/types';
import QuickBOQTable from './QuickBOQTable';

// ─── Constants ─────────────────────────────────────────────────────────────────

// Was a local 85 while the BOQ charged 80 — another quiet divergence.
const TRANSPORT_COST = SOLAR_TRANSPORT_COST;
// Indicative figure for the 'protection disabled' warning only. Real cost is
// computed per system by solarBalanceOfSystemCost.
const PROTECTION_FIXED = Math.round(solarBalanceOfSystemCost(4, true));

// ─── Types ─────────────────────────────────────────────────────────────────────

type Objective = 'economy' | 'balanced' | 'quality';

interface BudgetAllocation {
  panels: { count: number; brand: PanelOption; cost: number };
  inverter: { kva: number; brand: InverterOption; cost: number };
  battery: { units: number; brand: BatteryOption; cost: number };
  protection: { cost: number };
  installation: { cost: number; pct: number; isCustom: boolean };
  transport: { cost: number };
  // Advisor: cheapest battery brand that fits budget when selected brand is too expensive
  fallbackBattery: BatteryOption | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function bestInverterForBudget(budget: number, brand: InverterOption): { kva: number; price: number } {
  const sizes = Object.entries(brand.prices)
    .map(([k, v]) => ({ kva: Number(k), price: v }))
    .sort((a, b) => b.kva - a.kva);
  for (const s of sizes) {
    if (s.price <= budget) return s;
  }
  const smallest = sizes[sizes.length - 1];
  return smallest ?? { kva: 3, price: 350 };
}

function allocateBudget(
  totalBudget: number,
  panelBrand: PanelOption,
  inverterBrand: InverterOption,
  batteryBrand: BatteryOption,
  enabledCards: Record<string, boolean>,
  objective: Objective,
  installCustom: number | null,
  redistribute: boolean,
): BudgetAllocation {
  // Proportional splits — all three core components get budget simultaneously
  const ratios = {
    economy:  { inverter: 0.30, battery: 0.25, panels: 0.45 },
    balanced: { inverter: 0.33, battery: 0.28, panels: 0.39 },
    quality:  { inverter: 0.38, battery: 0.27, panels: 0.35 },
  }[objective];

  const transportCost = enabledCards.transport ? TRANSPORT_COST : 0;
  // Reserved with no panels yet, because cable and trunking scale with the
  // array. The exact figure is recomputed once the panel count is known and
  // the whole allocation is trimmed to fit below.
  const protectionReserve = enabledCards.protection ? solarBalanceOfSystemCost(0, true) : 0;

  // Reserve installation cost upfront so core components get a clean budget
  let coreBudget = totalBudget - transportCost - protectionReserve;
  if (enabledCards.installation) {
    coreBudget = installCustom !== null
      ? Math.max(0, coreBudget - installCustom)
      : Math.max(0, coreBudget / 1.20); // hardware = total / 1.20 when install = 20%
  }

  // ── Step 1: Select inverter ─────────────────────────────────────────────────
  const inv = bestInverterForBudget(
    enabledCards.inverter ? coreBudget * ratios.inverter : 0,
    inverterBrand,
  );
  const inverterCost = enabledCards.inverter ? inv.price : 0;
  const afterInverter = coreBudget - inverterCost;

  // ── Step 2: Smart battery combo — guarantee all 3 when possible ────────────
  // If selected brand doesn't fit in its proportion, try to reserve at least 1 unit
  // of the cheapest brand that still leaves room for panels.
  let batteryUnits = 0;
  let batteryCost = 0;
  let fallbackBattery: BatteryOption | null = null;

  if (enabledCards.battery) {
    const proportionalUnits = Math.floor((coreBudget * ratios.battery) / batteryBrand.unitPrice);

    if (proportionalUnits > 0) {
      // Selected brand fits proportionally
      batteryUnits = proportionalUnits;
      batteryCost = batteryUnits * batteryBrand.unitPrice;
    } else {
      // Selected brand too expensive for its proportion — try cheapest brand that
      // fits and still leaves room for at least 1 panel
      const cheapest = BATTERY_BRANDS
        .slice()
        .sort((a, b) => a.unitPrice - b.unitPrice)
        .find((b) => afterInverter - b.unitPrice >= panelBrand.pricePerPanel);

      if (cheapest) {
        // Use cheapest brand for 1 unit, signal to UI via fallbackBattery
        batteryUnits = 1;
        batteryCost = cheapest.unitPrice;
        fallbackBattery = cheapest;
      }
    }
  }

  // ── Step 3: Panels from remaining ──────────────────────────────────────────
  const afterBattery = afterInverter - batteryCost;
  let panelCount = enabledCards.panels && afterBattery >= panelBrand.pricePerPanel
    ? Math.floor((afterBattery * 0.80) / panelBrand.pricePerPanel) // leave 20% headroom
    : 0;
  let panelCost = panelCount * panelBrand.pricePerPanel;

  // ── Step 4: Redistribute leftover into panels (and battery if enough) ──────
  if (redistribute) {
    let leftover = coreBudget - inverterCost - batteryCost - panelCost;
    if (enabledCards.panels && panelBrand.pricePerPanel > 0 && leftover >= panelBrand.pricePerPanel) {
      const extra = Math.floor(leftover / panelBrand.pricePerPanel);
      panelCount += extra;
      panelCost += extra * panelBrand.pricePerPanel;
      leftover -= extra * panelBrand.pricePerPanel;
    }
    // Try adding another battery unit of the active brand
    const activeBatBrand = fallbackBattery ?? batteryBrand;
    if (enabledCards.battery && leftover >= activeBatBrand.unitPrice) {
      batteryUnits += 1;
      batteryCost += activeBatBrand.unitPrice;
    }
  }

  // ── Step 5: Price it the way the BOQ will, then make it fit ────────────────
  //
  // Everything above allocates against estimates. This step prices the result
  // with the same functions solarSizingToBOQ uses and trims until the total is
  // actually within budget. Without it the two disagreed badly: on a $1,000
  // budget the explorer reported $869 allocated and the BOQ came out at
  // $2,139 — the number the user had typed in meant nothing.
  const priceAll = (panels: number, batteries: number) => {
    const activeBattery = fallbackBattery ?? batteryBrand;
    const panelsCost = panels * panelBrand.pricePerPanel;
    const batteriesCost = batteries * activeBattery.unitPrice;
    const protection = enabledCards.protection
      ? solarBalanceOfSystemCost(panels, batteries > 0)
      : 0;
    const hardware = inverterCost + batteriesCost + panelsCost + protection;
    const install = enabledCards.installation
      ? installCustom !== null && installCustom > 0
        ? installCustom
        : Math.round(hardware * SOLAR_INSTALL_LABOR_PCT)
      : 0;
    return { panelsCost, batteriesCost, protection, hardware, install, total: hardware + install + transportCost };
  };

  let priced = priceAll(panelCount, batteryUnits);

  // Drop panels first — they are the divisible part of the system. A battery or
  // an inverter cannot be bought in fractions, and removing either changes what
  // the system can do rather than just how much of it there is.
  while (priced.total > totalBudget && panelCount > 0) {
    panelCount -= 1;
    priced = priceAll(panelCount, batteryUnits);
  }

  // Still over with no panels left: the battery is what does not fit.
  while (priced.total > totalBudget && batteryUnits > 0) {
    batteryUnits -= 1;
    priced = priceAll(panelCount, batteryUnits);
  }

  panelCost = priced.panelsCost;
  batteryCost = priced.batteriesCost;
  const protectionCost = priced.protection;
  const installCost = priced.install;
  const installPct =
    installCustom !== null && installCustom > 0 && priced.hardware > 0
      ? Math.round((installCustom / priced.hardware) * 100)
      : Math.round(SOLAR_INSTALL_LABOR_PCT * 100);
  const isCustom = installCustom !== null && installCustom > 0;

  return {
    panels: { count: panelCount, brand: panelBrand, cost: panelCost },
    inverter: { kva: inv.kva, brand: inverterBrand, cost: inverterCost },
    battery: { units: batteryUnits, brand: fallbackBattery ?? batteryBrand, cost: batteryCost },
    protection: { cost: protectionCost },
    installation: { cost: Math.round(installCost), pct: installPct, isCustom },
    transport: { cost: transportCost },
    fallbackBattery,
  };
}

// ─── Combo helpers ─────────────────────────────────────────────────────────────

function groupPackagesByKva(packages: SolarPackage[]): { label: string; packages: SolarPackage[] }[] {
  const tiers = [
    { label: '1–1.9 kVA', min: 0, max: 1.9 },
    { label: '3–3.9 kVA', min: 1.9, max: 3.9 },
    { label: '4–5.9 kVA', min: 3.9, max: 5.9 },
    { label: '6–7.9 kVA', min: 5.9, max: 7.9 },
    { label: '8–12 kVA', min: 7.9, max: 99 },
  ];
  return tiers
    .map((t) => ({
      label: t.label,
      packages: packages.filter((p) => p.kva > t.min && p.kva <= t.max),
    }))
    .filter((t) => t.packages.length > 0);
}

// ─── PackageCard sub-component ─────────────────────────────────────────────────

function PackageCard({
  pkg,
  budget,
  isLoaded,
  onSelect,
}: {
  pkg: SolarPackage;
  budget: number;
  isLoaded: boolean;
  onSelect: (pkg: SolarPackage) => void;
}) {
  const over = pkg.price > budget;
  const delta = pkg.price - budget;
  const chips = pkg.appliances.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <div className={`rounded-xl border p-4 transition-all ${isLoaded ? 'border-blue-400 bg-[var(--color-accent-muted)] ring-2 ring-blue-400/20' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-border-light)] text-[var(--color-text-secondary)]">
            {pkg.kva} kVA
          </span>
          <span className="font-semibold text-sm text-[var(--color-text)] truncate">{pkg.name}</span>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
          <span className={`font-bold text-base tabular-nums ${over ? 'text-amber-600' : 'text-emerald-600'}`}>
            ${pkg.price.toLocaleString()}
          </span>
          {over && (
            <span className="text-[10px] font-semibold text-amber-500">+${delta.toLocaleString()} over</span>
          )}
        </div>
      </div>

      {/* Specs */}
      <p className="text-xs text-[var(--color-text-secondary)] mb-2">
        {pkg.batteryKwh}kWh battery · {pkg.panelCount}×{pkg.panelWatt}W panels
        {pkg.includesInstall && (
          <span className="ml-1.5 inline-block text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
            Incl. install
          </span>
        )}
      </p>

      {/* Appliance chips */}
      <div className="flex flex-wrap gap-1 mb-3">
        {chips.map((chip) => (
          <span key={chip} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-border-light)] text-[var(--color-text-secondary)] font-medium">
            {chip}
          </span>
        ))}
      </div>

      {/* Select button */}
      {isLoaded ? (
        <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent-dark)]">
          <CheckCircle size={16} weight="fill" className="text-[var(--color-accent)]" />
          Loaded into explorer
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(pkg)}
          className="w-full py-1.5 rounded-lg text-xs font-semibold text-[var(--color-accent-dark)] border border-blue-200 hover:bg-[var(--color-accent-muted)] hover:border-blue-400 transition-colors"
        >
          Select This Combo
        </button>
      )}
    </div>
  );
}

// ─── KvaGuide sub-component ────────────────────────────────────────────────────

function KvaGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <span className="font-bold text-[var(--color-text)] flex items-center gap-2 text-sm">
          <Lightning size={16} weight="duotone" className="text-yellow-500" />
          kVA Size Guide — What Can Each System Power?
        </span>
        {open ? <CaretUp size={16} className="text-[var(--color-text-muted)]" /> : <CaretDown size={16} className="text-[var(--color-text-muted)]" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-border-light)]">
              {KVA_POWER_GUIDE.map((tier) => (
                <div key={tier.kva} className="pt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-[var(--color-text)]">{tier.label}</span>
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">{tier.priceRange}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-2">{tier.typicalUse}</p>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {tier.canPower.map((item) => (
                      <span key={item} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tier.cannotPower.map((item) => (
                      <span key={item} className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium border border-red-100">
                        ✕ {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SolarBudgetExplorerProps {
  onBack: () => void;
  /** Names the destination; the default matches the wizard these came from. */
  backLabel?: string;
  isContractor?: boolean;
  onSave?: (output: SolarWizardOutput & { boqItems?: BOQItem[] }) => void | Promise<void>;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SolarBudgetExplorer({ onBack, backLabel = 'Back to Solar Setup', isContractor = false, onSave }: SolarBudgetExplorerProps) {
  const router = useRouter();
  // Budget — starts at 0 so user enters their amount
  const [budgetInput, setBudgetInput] = useState<string>('');
  const budget = Number(budgetInput.replace(/[^0-9]/g, '')) || 0;
  const setBudget = (amount: number) => setBudgetInput(String(amount));

  // Guidance, not validation — the explorer still runs and shows the shortfall.
  const budgetNotice = (() => {
    if (budgetInput.trim() === '' || budget === 0) {
      return { tone: 'hint' as const, text: 'Enter what you have available and we will show what it buys.' };
    }
    if (budget < 400) {
      return {
        tone: 'warn' as const,
        text: 'Even a starter solar kit — one panel, a small battery and an inverter — runs close to $750. This will show you the gap.',
      };
    }
    if (budget > 60000) {
      return {
        tone: 'warn' as const,
        text: 'That is well beyond a residential system — worth checking the figure before planning around it.',
      };
    }
    return null;
  })();

  // Objective
  const [objective, setObjective] = useState<Objective>('balanced');

  // Custom install amount (null = use 20% auto)
  const [installCustom, setInstallCustom] = useState<number | null>(null);

  // Enabled cards — protection OFF (user can add), transport OFF (usually bundled)
  const [enabledCards, setEnabledCards] = useState<Record<string, boolean>>({
    panels: true,
    inverter: true,
    battery: true,
    // Was OFF by default. That made the headline "what your budget buys" figure
    // describe a system with no isolators, surge protection, earthing or AVS —
    // which this same component warns is unsafe and which no installer would
    // quote. The budget looked further-stretching than it was, and the BOQ then
    // added the missing parts anyway. On by default; the toggle still lets
    // someone price the difference deliberately.
    protection: true,
    installation: true,
    transport: false,  // OFF by default — typically bundled in ZW urban quotes
  });

  // Redistribute leftover budget into panels/battery when true
  const [redistribute, setRedistribute] = useState(false);

  // Brand selections (objective hints default brands)
  const [panelBrand, setPanelBrand] = useState<string>('ja_solar');
  const [inverterBrand, setInverterBrand] = useState<string>('must');
  const [batteryBrand, setBatteryBrand] = useState<string>('dyness');

  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { success: showSuccess, error: showError } = useToast();
  const { isAuthenticated } = useAuth();
  const [boqItems, setBoqItems] = useState<BOQItem[] | null>(null);
  const [labor, setLabor] = useState<LaborConfig>({ enabled: false, method: 'percentage', percentage: 25 });
  const [comboLoaded, setComboLoaded] = useState<string | null>(null);
  const budgetRef = useRef<HTMLDivElement>(null);

  // Resolve brand objects
  const pBrand = PANEL_BRANDS.find((b) => b.brand === panelBrand) ?? PANEL_BRANDS[1];
  const iBrand = INVERTER_BRANDS.find((b) => b.brand === inverterBrand) ?? INVERTER_BRANDS[0];
  const bBrand = BATTERY_BRANDS.find((b) => b.brand === batteryBrand) ?? BATTERY_BRANDS[2];

  // Compute allocation
  const allocation = useMemo(
    () => allocateBudget(budget, pBrand, iBrand, bBrand, enabledCards, objective, installCustom, redistribute),
    [budget, pBrand, iBrand, bBrand, enabledCards, objective, installCustom, redistribute],
  );

  const totalAllocated =
    allocation.panels.cost +
    allocation.inverter.cost +
    allocation.battery.cost +
    allocation.protection.cost +
    allocation.installation.cost +
    allocation.transport.cost;

  const remaining = budget - totalAllocated;
  const budgetPct = budget > 0 ? Math.min(100, Math.round((totalAllocated / budget) * 100)) : 0;

  // Freed budget suggestions — shown when significant unallocated budget exists
  const hasFreedBudget = budget > 0 && remaining > 120;
  const freedSuggestions: string[] = [];
  if (hasFreedBudget) {
    if (!enabledCards.transport && remaining >= TRANSPORT_COST) freedSuggestions.push('Enable transport delivery');
    if (enabledCards.battery && allocation.battery.units < 2) freedSuggestions.push('Add another battery unit');
    if (enabledCards.panels && allocation.panels.count > 0) freedSuggestions.push('Add more solar panels');
  }

  // Matching pre-built packages — within 10% over budget, sorted by kVA then price
  const matchingPackages = useMemo(() => {
    if (budget === 0) return [];
    return SOLAR_PACKAGES
      .filter((pkg) => pkg.price <= budget * 1.1)
      .sort((a, b) => a.kva !== b.kva ? a.kva - b.kva : a.price - b.price);
  }, [budget]);

  const packageGroups = useMemo(() => groupPackagesByKva(matchingPackages), [matchingPackages]);

  const systemKw = ((allocation.panels.count * pBrand.watt) / 1000).toFixed(1);
  const storageKwh = (allocation.battery.units * allocation.battery.brand.unitKwh).toFixed(1);
  const zeraTier = getRequiredZeraTier(allocation.panels.count * pBrand.watt);

  const toggleCard = useCallback((id: string) => {
    setRedistribute(false); // reset when user changes cards
    setEnabledCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedCard((prev) => (prev === id ? null : id));
  }, []);

  // Set objective and update default brands accordingly
  const setObjectiveAndBrands = (obj: Objective) => {
    setObjective(obj);
    if (obj === 'economy') {
      setInverterBrand('must');
      setBatteryBrand('dyness');
      setPanelBrand('longi');   // cheapest panel in ZW market
    } else if (obj === 'quality') {
      setInverterBrand('deye');
      setBatteryBrand('pylontech');
      setPanelBrand('jinko');
    }
    // balanced: keep current selections
  };

  // Select a combo package — pre-fills budget + brands
  const handleSelectCombo = useCallback((pkg: SolarPackage) => {
    setBudget(pkg.price);
    if (pkg.inverterBrandKey) setInverterBrand(pkg.inverterBrandKey);
    if (pkg.panelBrandKey) setPanelBrand(pkg.panelBrandKey);
    if (pkg.batteryBrandKey) setBatteryBrand(pkg.batteryBrandKey);
    setRedistribute(false);
    setComboLoaded(pkg.id);
    budgetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Auto-dismiss combo loaded banner when user edits budget away from loaded price
  useEffect(() => {
    if (comboLoaded) {
      const loadedPkg = SOLAR_PACKAGES.find((p) => p.id === comboLoaded);
      if (loadedPkg && budget !== loadedPkg.price) {
        const timeoutId = window.setTimeout(() => setComboLoaded(null), 0);
        return () => window.clearTimeout(timeoutId);
      }
    }
  }, [budget, comboLoaded]);

  // The answers a budget-mode solar estimate carries. Shared by the BOQ build
  // and by save, which previously described the same estimate in two places.
  const buildAnswers = () => ({
    intent: 'budget' as const,
    backupHours: null,
    location: '',
    propertyType: null,
    appliances: {},
    simultaneousLoads: { kettleMicrowave: false, pumpWithHouse: false, geyserWithHouse: false },
    roof: { type: null, shading: null, orientation: '', spaceM2: null },
    existing: { hasExisting: false, inverterKva: null, batteryKwh: null, panelCount: null, issues: '' },
    budgetUsd: budget,
    quote: { totalUsd: null, inverterKva: null, batteryKwh: null, panelCount: null, panelWatt: null, notes: '' },
  });

  // Generate BOQ
  const buildBoqItems = () => {
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

    const augAnswers = {
      ...buildAnswers(),
      panel_brand: panelBrand,
      inverter_brand: inverterBrand,
      battery_brand: batteryBrand,
      include_transport: enabledCards.transport,
      include_install: enabledCards.installation,
      // Was never passed, so the BOQ always charged for protection regardless
      // of the toggle the user had just set.
      include_protection: enabledCards.protection,
      include_contingency: false,
    };

    return solarSizingToBOQ(sizingResult, augAnswers as Parameters<typeof solarSizingToBOQ>[1]);
  };

  const generateBOQ = () => setBoqItems(buildBoqItems());

  // Saves from the action row rather than from inside the BOQ table, so the
  // three budget tabs offer the same actions in the same place. The dialog that
  // used to sit here asked for a project name and then discarded it — it only
  // ever called generateBOQ, so nothing was saved.
  const handleSaveProject = async () => {
    if (!onSave) return;
    const answers = buildAnswers();
    const items = buildBoqItems();

    // Same gap as the borehole explorer: Save called onSave with no auth check,
    // so a signed-out user pressed it and nothing happened at all.
    const signInUrl = gateSaveBehindSignIn({
      isAuthenticated,
      projectType: 'solar',
      answers: answers as unknown as Record<string, unknown>,
      boqItems: items,
      labor,
    });
    if (signInUrl) {
      router.push(signInUrl);
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ answers, result: null, boqItems: items } as Parameters<NonNullable<typeof onSave>>[0]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    const shareText = [
      'ZimEstimate Solar Budget',
      `Budget: $${budget.toLocaleString()}`,
      `System: ${systemKw} kW array, ${allocation.inverter.kva} kVA inverter`,
      `Battery: ${(allocation.battery.units * bBrand.unitKwh).toFixed(1)} kWh`,
      `Allocated: $${Math.round(totalAllocated).toLocaleString()}`,
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Solar Budget Estimate', text: shareText, url: window.location.href });
        showSuccess('Estimate shared.');
        return;
      }
      await navigator.clipboard.writeText(`${shareText}\n\n${window.location.href}`);
      showSuccess('Estimate summary copied to clipboard.');
    } catch {
      showError('Sharing was cancelled or unavailable.');
    }
  };

  // ── BOQ View ──────────────────────────────────────────────────────────────────
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
          projectType="solar"
          initialItems={boqItems}
          labor={labor}
          onLaborChange={setLabor}
          isContractor={isContractor}
          answers={buildAnswers() as unknown as Record<string, unknown>}
          onSave={
            onSave
              ? (items) =>
                  onSave({ answers: buildAnswers(), result: null, boqItems: items } as Parameters<NonNullable<typeof onSave>>[0])
              : undefined
          }
        />
      </div>
    );
  }

  // ── Card definitions ──────────────────────────────────────────────────────────
  const cards = [
    {
      id: 'panels',
      label: 'Solar Panels',
      icon: <SolarPanel size={22} weight="duotone" />,
      enabled: enabledCards.panels,
      cost: allocation.panels.cost,
      description: allocation.panels.count > 0
        ? `${allocation.panels.count}x ${pBrand?.watt ?? 440}W ${pBrand?.label ?? 'Solar Panel'} — ${systemKw} kW array`
        : `${pBrand?.label ?? 'Solar Panel'} · $${pBrand?.pricePerPanel ?? '—'}/panel`,
      hasBrandPicker: true,
      hasCustomInput: false,
    },
    {
      id: 'inverter',
      label: 'Inverter',
      icon: <Lightning size={22} weight="duotone" />,
      enabled: enabledCards.inverter,
      cost: allocation.inverter.cost,
      description: `${allocation.inverter.kva > 0 ? `${allocation.inverter.kva} kVA ` : ''}${iBrand.label} hybrid inverter`,
      hasBrandPicker: true,
      hasCustomInput: false,
    },
    {
      id: 'battery',
      label: 'Battery Storage',
      icon: <BatteryCharging size={22} weight="duotone" />,
      enabled: enabledCards.battery,
      cost: allocation.battery.cost,
      description: allocation.battery.units > 0
        ? `${allocation.battery.units}x ${allocation.battery.brand.unitKwh}kWh ${allocation.battery.brand.label} — ${storageKwh} kWh`
        : `${bBrand.label} · $${bBrand.unitPrice}/${bBrand.unitKwh}kWh`,
      hasBrandPicker: true,
      hasCustomInput: false,
    },
    {
      id: 'protection',
      label: 'Protection & BOS',
      icon: <ShieldCheck size={22} weight="duotone" />,
      enabled: enabledCards.protection,
      cost: allocation.protection.cost,
      description: 'AVS, breakers, changeover switch, DB, earthing, surge protection, mounting',
      hasBrandPicker: false,
      hasCustomInput: false,
    },
    {
      id: 'installation',
      label: 'Installation',
      icon: <Wrench size={22} weight="duotone" />,
      enabled: enabledCards.installation,
      cost: allocation.installation.cost,
      description: allocation.installation.isCustom
        ? `Custom amount: $${installCustom?.toLocaleString()}`
        : `Labor — ${allocation.installation.pct}% of hardware cost`,
      hasBrandPicker: false,
      hasCustomInput: true,
    },
    {
      id: 'transport',
      label: 'Transport / Delivery',
      icon: <Truck size={22} weight="duotone" />,
      enabled: enabledCards.transport,
      cost: allocation.transport.cost,
      description: `Equipment delivery to site (~$${TRANSPORT_COST} — enable if charged separately)`,
      hasBrandPicker: false,
      hasCustomInput: false,
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto pb-24">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors mb-6"
      >
        <ArrowLeft size={16} /> {backLabel}
      </button>

      {/* Header */}
      <div className="mb-8">
        <span className="budget-eyebrow">
          SOLAR BUDGET EXPLORER
        </span>
        <h2 className="budget-display">
          What can your budget buy?
        </h2>
        <p className="budget-lede">
          Enter your budget below. Toggle components on/off and change brands to see what fits.
        </p>
      </div>

      {/* ── Objective Selector ───────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-700 mb-3">What&apos;s your priority?</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'economy',  label: 'Economy',  sub: 'Best value, proven brands', icon: <Coins size={18} /> },
            { key: 'balanced', label: 'Balanced',  sub: 'Quality meets budget',      icon: <Scales size={18} /> },
            { key: 'quality',  label: 'Quality',   sub: 'Premium & long-lasting',    icon: <Star size={18} /> },
          ] as const).map(({ key, label, sub, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setObjectiveAndBrands(key)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                objective === key
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] ring-2 ring-[var(--color-accent)]/20 text-[var(--color-accent-dark)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-blue-300'
              }`}
            >
              <span className={objective === key ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}>{icon}</span>
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-[11px] text-[var(--color-text-secondary)] leading-tight">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Budget instrument ───────────────────────────────────────────────
          The moment of truth on this page is a single number, so it is treated
          as one: a dark panel that lifts it off the white page, the figure set
          in tabular mono so digits do not jitter as you type, and an allocation
          meter directly beneath answering "how much of it is spoken for". */}
      <div ref={budgetRef} className="budget-instrument mb-6">
        <div className="budget-instrument__grid" aria-hidden />

        <div className="budget-instrument__body">
          <label htmlFor="solar-budget" className="budget-instrument__label">
            Your budget
          </label>

          <div className="budget-instrument__figure">
            <span className="budget-instrument__currency">$</span>
            <input
              id="solar-budget"
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              placeholder="0"
              value={budgetInput}
              onChange={(e) => { setRedistribute(false); setBudgetInput(e.target.value.replace(/[^0-9]/g, '')); }}
              aria-describedby="solar-budget-notice"
              className="budget-instrument__input"
              style={{ MozAppearance: 'textfield' } as CSSProperties}
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
              id="solar-budget-notice"
              className={`budget-instrument__notice${budgetNotice.tone === 'warn' ? ' is-warn' : ''}`}
            >
              {budgetNotice.text}
            </p>
          )}

          <div className="budget-instrument__presets">
            {[500, 1000, 1500, 2500, 3500, 5000, 7500].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => { setRedistribute(false); setBudget(amt); }}
                className={`budget-chip${budget === amt ? ' is-active' : ''}`}
              >
                ${amt.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Combo loaded banner */}
      <AnimatePresence>
        {comboLoaded && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-accent-muted)] border border-blue-200 mb-4"
          >
            <CheckCircle size={16} weight="fill" className="text-[var(--color-accent)] flex-shrink-0" />
            <p className="text-sm text-blue-800 flex-1">
              <strong>Combo loaded.</strong> Budget and brands have been updated from the selected package.
            </p>
            <button type="button" onClick={() => setComboLoaded(null)} className="text-xs text-[var(--color-accent)] hover:underline">
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state — no budget entered yet */}
      {budget === 0 && (
        <div>
          <div className="text-center py-10 mb-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-slate-50/50">
            <Lightning size={36} weight="duotone" className="text-[var(--color-border-dark)] mx-auto mb-3" />
            <p className="text-[var(--color-text-secondary)] text-sm">Enter your budget above or tap a quick amount to see what you can get.</p>
          </div>
          <KvaGuide defaultOpen={true} />
        </div>
      )}

      {budget > 0 && (
        <>
          {/* ── Budget Progress Bar ────────────────────────────────────────────── */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-slate-700">
                ${totalAllocated.toLocaleString()} allocated
              </span>
              <span className={`font-semibold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {remaining >= 0
                  ? `$${remaining.toLocaleString()} remaining`
                  : `$${Math.abs(remaining).toLocaleString()} over budget`}
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

          {/* ── Freed budget / reallocate ─────────────────────────────────────── */}
          {hasFreedBudget && !redistribute && (
            <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-5">
              <div className="flex items-start gap-3">
                <ArrowsClockwise size={18} className="flex-shrink-0 mt-0.5 text-emerald-600" />
                <p className="text-sm text-emerald-800">
                  <strong>${remaining.toLocaleString()} unallocated.</strong> Reallocate into more panels &amp; battery?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRedistribute(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
              >
                <ArrowsClockwise size={14} />
                Optimise
              </button>
            </div>
          )}
          {redistribute && remaining >= 0 && remaining < 120 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-5">
              <CheckCircle size={16} weight="fill" className="text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-800 flex-1">Budget fully optimised — all funds allocated.</p>
              <button
                type="button"
                onClick={() => setRedistribute(false)}
                className="text-xs text-emerald-700 underline hover:no-underline"
              >
                Reset
              </button>
            </div>
          )}

          {/* ── Fallback Battery Banner ──────────────────────────────────────── */}
          {allocation.fallbackBattery && enabledCards.battery && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-200 mb-5">
              <Info size={18} className="flex-shrink-0 mt-0.5 text-indigo-600" />
              <div className="text-sm text-indigo-900 flex-1">
                <strong>Using {allocation.fallbackBattery.label} ({allocation.fallbackBattery.unitKwh}kWh) to fit your budget.</strong>{' '}
                Your selected <strong>{bBrand.label}</strong> costs ${bBrand.unitPrice.toLocaleString()} — ${(bBrand.unitPrice - allocation.fallbackBattery.unitPrice).toLocaleString()} more than currently allocated.
                <br />
                <button
                  type="button"
                  onClick={() => setBatteryBrand(allocation.fallbackBattery!.brand)}
                  className="text-indigo-700 underline hover:no-underline text-xs font-semibold mt-1 inline-block"
                >
                  Keep {allocation.fallbackBattery.label} as selection
                </button>
              </div>
            </div>
          )}

          {/* ── Matching Packages (grouped by kVA) ──────────────────────────────── */}
          {packageGroups.length > 0 && (
            <div className="mb-6">
              <h4 className="font-bold text-[var(--color-text)] mb-1 text-sm flex items-center gap-2">
                <Lightning size={16} weight="duotone" className="text-yellow-500" />
                Packages Within Your Budget
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">Real Zimbabwe market combos — click to load into the explorer.</p>
              {packageGroups.map((group) => (
                <div key={group.label} className="mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">{group.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.packages.map((pkg) => (
                      <PackageCard
                        key={pkg.id}
                        pkg={pkg}
                        budget={budget}
                        isLoaded={comboLoaded === pkg.id}
                        onSelect={handleSelectCombo}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Component Cards ────────────────────────────────────────────────── */}
          <div className="space-y-3 mb-8">
            {cards.map((card) => {
              const isExpanded = expandedCard === card.id;

              return (
                <div
                  key={card.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    card.enabled
                      ? 'border-blue-200 bg-[var(--color-surface)] shadow-sm'
                      : 'border-[var(--color-border)] bg-slate-50/50 opacity-60'
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-center gap-3 p-4">
                    {/* Toggle switch */}
                    <button
                      onClick={() => toggleCard(card.id)}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                        card.enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-dark)]'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-[var(--color-surface)] shadow transition-transform ${
                          card.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>

                    {/* Icon + label */}
                    <div className={`flex-shrink-0 ${card.enabled ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>
                      {card.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold text-sm ${card.enabled ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}>
                          {card.label}
                        </span>
                        <span className={`text-lg font-bold tabular-nums ${card.enabled ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
                          {card.enabled && card.cost > 0 ? `$${card.cost.toLocaleString()}` : card.enabled ? '—' : '$0'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">{card.description}</p>
                    </div>

                    {/* Expand button */}
                    {card.enabled && (card.hasBrandPicker || card.hasCustomInput) && (
                      <button
                        onClick={() => toggleExpand(card.id)}
                        className="p-1.5 rounded-lg hover:bg-[var(--color-border-light)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors flex-shrink-0"
                      >
                        {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                      </button>
                    )}
                  </div>

                  {/* Expanded section */}
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

                          {/* Panel brand picker */}
                          {card.id === 'panels' && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {PANEL_BRANDS.map((b) => (
                                <button key={b.brand} type="button" onClick={() => setPanelBrand(b.brand)}
                                  className={`flex flex-col items-start p-3 rounded-xl border text-left text-sm transition-colors ${
                                    panelBrand === b.brand ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] ring-1 ring-[var(--color-accent)]/20' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-300'
                                  }`}
                                >
                                  <span className="font-semibold text-[var(--color-text)]">{b.label}</span>
                                  <span className="text-xs text-[var(--color-text-secondary)]">{b.watt}W · ${b.pricePerPanel}/panel</span>
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
                                  <button key={b.brand} type="button" onClick={() => setInverterBrand(b.brand)}
                                    className={`flex flex-col items-start p-3 rounded-xl border text-left text-sm transition-colors ${
                                      inverterBrand === b.brand ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] ring-1 ring-[var(--color-accent)]/20' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-300'
                                    }`}
                                  >
                                    <div className="flex w-full items-center justify-between">
                                      <span className="font-semibold text-[var(--color-text)]">{b.label}</span>
                                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                        b.tier === 'budget' ? 'bg-green-100 text-green-700' : b.tier === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-[var(--color-accent-dark)]'
                                      }`}>{b.tier}</span>
                                    </div>
                                    <span className="text-xs text-[var(--color-text-secondary)] mt-1">{b.description}</span>
                                    <span className="text-xs font-medium text-[var(--color-text-secondary)] mt-1">~${price5kva} for 5kVA</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Battery brand picker */}
                          {card.id === 'battery' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {BATTERY_BRANDS.map((b) => (
                                <button key={b.brand} type="button" onClick={() => setBatteryBrand(b.brand)}
                                  className={`flex flex-col items-start p-3 rounded-xl border text-left text-sm transition-colors ${
                                    batteryBrand === b.brand ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] ring-1 ring-[var(--color-accent)]/20' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-300'
                                  }`}
                                >
                                  <div className="flex w-full items-center justify-between">
                                    <span className="font-semibold text-[var(--color-text)]">{b.label}</span>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                      b.tier === 'budget' ? 'bg-green-100 text-green-700' : b.tier === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-[var(--color-accent-dark)]'
                                    }`}>{b.tier}</span>
                                  </div>
                                  <span className="text-xs text-[var(--color-text-secondary)] mt-1">{b.description}</span>
                                  <span className="text-xs font-medium text-[var(--color-text-secondary)] mt-1">
                                    ${b.unitPrice} per {b.unitKwh}kWh · ${b.pricePerKwh}/kWh
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Installation custom amount */}
                          {card.id === 'installation' && (
                            <div className="space-y-3">
                              <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                                Leave blank to use <strong>20% of hardware cost</strong> (Zimbabwe standard). Or enter the amount your installer quoted.
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--color-text-muted)] font-semibold">$</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={50}
                                  placeholder={`${Math.round((allocation.panels.cost + allocation.inverter.cost + allocation.battery.cost + allocation.protection.cost) * 0.20)} (auto)`}
                                  value={installCustom ?? ''}
                                  onChange={(e) => setInstallCustom(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                                  className="flex-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-blue-400"
                                />
                                {installCustom !== null && (
                                  <button
                                    onClick={() => setInstallCustom(null)}
                                    className="text-xs text-[var(--color-accent)] hover:underline whitespace-nowrap"
                                  >
                                    Reset to auto
                                  </button>
                                )}
                              </div>
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

          {/* ── System Summary Card ────────────────────────────────────────────── */}
          {totalAllocated > 0 && (
            <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm mb-6">
              <h4 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
                <CheckCircle size={20} weight="fill" className="text-[var(--color-accent)]" />
                Your System Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {[
                  { label: 'Solar Array', value: `${systemKw} kW`, show: enabledCards.panels && allocation.panels.count > 0 },
                  { label: 'Panels', value: `${allocation.panels.count}x ${pBrand.watt}W`, show: enabledCards.panels && allocation.panels.count > 0 },
                  { label: 'Inverter', value: `${allocation.inverter.kva} kVA`, show: enabledCards.inverter },
                  { label: 'Battery', value: `${storageKwh} kWh`, show: enabledCards.battery && allocation.battery.units > 0 },
                  { label: 'Protection', value: enabledCards.protection ? 'Included' : 'Not included', show: true },
                  { label: 'ZERA Tier', value: zeraTier, show: enabledCards.panels && allocation.panels.count > 0 },
                ]
                  .filter((r) => r.show)
                  .map((row) => (
                    <div key={row.label} className="flex justify-between p-2.5 rounded-lg bg-slate-50">
                      <span className="text-[var(--color-text-secondary)]">{row.label}</span>
                      <strong className="text-[var(--color-text)]">{row.value}</strong>
                    </div>
                  ))}
              </div>

              <div className="mt-4 p-3 rounded-lg bg-[var(--color-accent-muted)]/50 border border-blue-100/50">
                <p className="text-xs font-semibold text-blue-800 mb-1">Assumptions</p>
                <ul className="text-xs text-[var(--color-accent-dark)] space-y-0.5">
                  <li>Prices: Zimbabwe Q1 2026 mid-range market rates</li>
                  <li>Sun hours: 5.5h/day average (Zimbabwe)</li>
                  <li>Installation: {allocation.installation.isCustom ? 'custom amount' : '20% of hardware cost'}</li>
                  <li>Battery: LiFePO4 with 90-95% depth of discharge</li>
                  {!enabledCards.transport && (
                    <li className="text-[var(--color-text-secondary)]">Transport not included — enable if your supplier charges separately</li>
                  )}
                  {!enabledCards.protection && (
                    <li className="text-amber-700 font-semibold">
                      Protection & BOS disabled — not recommended
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* ── System Advisor ─────────────────────────────────────────────────── */}
          {enabledCards.inverter && allocation.inverter.kva > 0 && (() => {
            const invKva = allocation.inverter.kva;
            // Ideal sizing rules of thumb
            const idealArrayKw = invKva * 1.3;
            const idealPanelCount = Math.ceil((idealArrayKw * 1000) / pBrand.watt);
            const idealBatteryKwh = invKva * 2; // 4hr backup at 50% DoD
            const activeBatBrand = allocation.battery.brand;
            const idealBatteryUnits = Math.ceil(idealBatteryKwh / activeBatBrand.unitKwh);

            const currentPanels = allocation.panels.count;
            const currentBatteryUnits = allocation.battery.units;
            const currentStorageKwh = (currentBatteryUnits * activeBatBrand.unitKwh).toFixed(1);
            const extraPanels = Math.max(0, idealPanelCount - currentPanels);
            const extraBattery = Math.max(0, idealBatteryUnits - currentBatteryUnits);
            const costToIdeal = extraPanels * pBrand.pricePerPanel + extraBattery * activeBatBrand.unitPrice;
            const alreadyIdeal = extraPanels === 0 && extraBattery === 0;

            return (
              <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50 shadow-sm mb-6">
                <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                  <Lightbulb size={20} weight="fill" className="text-amber-500" />
                  System Advisor
                </h4>
                <p className="text-xs text-amber-800 mb-4">
                  For a <strong>{invKva} kVA {iBrand.label}</strong> inverter, here&apos;s the ideal system vs what your budget buys:
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Ideal column */}
                  <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-amber-200">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">Ideal</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Array</span>
                        <strong className="text-[var(--color-text)]">{idealArrayKw.toFixed(1)} kW</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Panels</span>
                        <strong className="text-[var(--color-text)]">{idealPanelCount}× {pBrand.watt}W</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Battery</span>
                        <strong className="text-[var(--color-text)]">{idealBatteryKwh.toFixed(1)} kWh</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Units</span>
                        <strong className="text-[var(--color-text)]">{idealBatteryUnits}× {activeBatBrand.unitKwh}kWh</strong>
                      </div>
                    </div>
                  </div>

                  {/* Current column */}
                  <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Your Budget</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Array</span>
                        <strong className={`${enabledCards.panels && currentPanels > 0 ? (currentPanels >= idealPanelCount ? 'text-emerald-600' : 'text-amber-700') : 'text-[var(--color-text-muted)]'}`}>
                          {enabledCards.panels && currentPanels > 0 ? `${systemKw} kW` : '—'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Panels</span>
                        <strong className={`${enabledCards.panels && currentPanels > 0 ? (currentPanels >= idealPanelCount ? 'text-emerald-600' : 'text-amber-700') : 'text-[var(--color-text-muted)]'}`}>
                          {enabledCards.panels && currentPanels > 0 ? `${currentPanels}× ${pBrand.watt}W` : '—'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Battery</span>
                        <strong className={`${enabledCards.battery && currentBatteryUnits > 0 ? (currentBatteryUnits >= idealBatteryUnits ? 'text-emerald-600' : 'text-amber-700') : 'text-[var(--color-text-muted)]'}`}>
                          {enabledCards.battery && currentBatteryUnits > 0 ? `${currentStorageKwh} kWh` : '—'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Units</span>
                        <strong className={`${enabledCards.battery && currentBatteryUnits > 0 ? (currentBatteryUnits >= idealBatteryUnits ? 'text-emerald-600' : 'text-amber-700') : 'text-[var(--color-text-muted)]'}`}>
                          {enabledCards.battery && currentBatteryUnits > 0 ? `${currentBatteryUnits}× ${activeBatBrand.unitKwh}kWh` : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gap / upgrade prompt */}
                {alreadyIdeal ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
                    <CheckCircle size={16} weight="fill" className="text-emerald-500" />
                    Your system matches the ideal sizing for this inverter. Great setup!
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-surface)] border border-amber-200">
                    <ArrowUp size={16} className="flex-shrink-0 mt-0.5 text-amber-600" />
                    <div className="text-sm text-amber-900">
                      To reach ideal:{' '}
                      {extraPanels > 0 && (
                        <strong>+{extraPanels} panel{extraPanels > 1 ? 's' : ''} (${(extraPanels * pBrand.pricePerPanel).toLocaleString()})</strong>
                      )}
                      {extraPanels > 0 && extraBattery > 0 && ' + '}
                      {extraBattery > 0 && (
                        <strong>+{extraBattery} battery unit{extraBattery > 1 ? 's' : ''} (${(extraBattery * activeBatBrand.unitPrice).toLocaleString()})</strong>
                      )}
                      {' '}— add approximately{' '}
                      <strong className="text-amber-800">${costToIdeal.toLocaleString()} to your budget</strong>.
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── kVA Power Guide ───────────────────────────────────────────────── */}
          <KvaGuide />

          {/* ── Warnings ──────────────────────────────────────────────────────── */}
          {!enabledCards.protection && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
              <Warning size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <div className="text-sm text-amber-800">
                <strong>Protection & BOS disabled.</strong> Wiring, breakers, AVS, and surge protection are essential — every professional Zimbabwe installation includes them. Disabling removes ~${PROTECTION_FIXED} but significantly increases failure risk.
              </div>
            </div>
          )}

          {budget > 0 && budget < 900 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
              <Warning size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <div className="text-sm text-amber-800">
                <strong>Budget below $900.</strong> The minimum entry-level solar system in Zimbabwe starts around $900. Consider increasing your budget or a basic lighting kit instead.
              </div>
            </div>
          )}

          {/* ── Action Buttons ────────────────────────────────────────────────── */}
          {/* Same three actions, same order and labels as the house and borehole
              budget tabs — see the note in quick-budget/page.tsx. */}
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
            <Button
              variant="secondary"
              icon={<ShareNetwork size={16} />}
              onClick={handleShare}
              className="bg-[var(--color-surface)]"
            >
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
        </>
      )}
    </div>
  );
}
