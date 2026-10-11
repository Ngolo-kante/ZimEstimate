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
  type SolarPackage,
} from '@/lib/quick-projects/solar/catalog';
import {
  solarSizingToBOQ,
  solarBalanceOfSystemCost,
  SOLAR_TRANSPORT_COST,
  type SolarWiringKit,
} from '@/lib/quick-projects/solar/boq';
import { allocateBudget, type Objective } from '@/lib/quick-projects/solar/allocateBudget';
import { BACKUP_LOADS, backupHours, describeBackup } from '@/lib/quick-projects/solar/backupHours';
import {
  decodeSolarExplorerState,
  encodeSolarExplorerState,
  SOLAR_CARD_IDS,
  SOLAR_EXPLORER_DEFAULTS,
} from '@/lib/quick-projects/solar/explorerUrl';
import type { BOQItem, LaborConfig } from '@/lib/quick-projects/engine/types';
import type { SolarWizardOutput } from '@/lib/quick-projects/solar/types';
import QuickBOQTable from './QuickBOQTable';
import { captureProductEvent, getBudgetBand } from '@/lib/productAnalytics';

// ─── Constants ─────────────────────────────────────────────────────────────────

// Was a local 85 while the BOQ charged 80 — another quiet divergence.
const TRANSPORT_COST = SOLAR_TRANSPORT_COST;
// Indicative figure for the 'protection disabled' warning only. Real cost is
// computed per system by solarBalanceOfSystemCost.
const PROTECTION_FIXED = Math.round(solarBalanceOfSystemCost(4, true));

/* Installation labour is negotiated in this market, so the page offers the
   range people actually pay rather than one house figure. The catalog default
   sits in the middle of it. */
const LABOR_RATE_OPTIONS = [
  { pct: 0.10, note: 'Own contact / DIY help' },
  { pct: 0.15, note: 'Typical local installer' },
  { pct: 0.20, note: 'Registered company' },
] as const;

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
  const [objective, setObjective] = useState<Objective>(SOLAR_EXPLORER_DEFAULTS.objective);

  // Custom install amount in dollars (null = use the percentage below)
  const [installCustom, setInstallCustom] = useState<number | null>(SOLAR_EXPLORER_DEFAULTS.installCustom);

  /* Installation labour as a share of hardware. A single hardcoded 20% was too
     high for this market and the user had no way to change it without typing a
     dollar figure, which most people cannot guess. Now it is a choice, and the
     percentage travels into the saved BOQ so the estimate matches what was
     shown here. */
  const [laborPct, setLaborPct] = useState<number>(SOLAR_EXPLORER_DEFAULTS.laborPct);

  /* Full kit by default, so the estimate a user saw before this option existed
     does not quietly change. The basic kit is offered on the wiring row — and
     named in its shortfall line when the full kit does not fit. */
  const [wiringKit, setWiringKit] = useState<SolarWiringKit>(SOLAR_EXPLORER_DEFAULTS.wiringKit);

  // Enabled cards — protection OFF (user can add), transport OFF (usually bundled)
  // Defaults, and why each is on or off, live in SOLAR_EXPLORER_DEFAULTS —
  // shared with the link preview so the two cannot describe different systems.
  const [enabledCards, setEnabledCards] = useState<Record<string, boolean>>({
    ...SOLAR_EXPLORER_DEFAULTS.enabledCards,
  });

  /* Spend the whole budget by default.
     This was opt-in, behind an "Optimise" button, back when panels soaked up
     every leftover dollar on their own. Now that each component is held to its
     share, the integer unit sizes leave real money behind — $441 of $2,500 —
     and a page titled "what can your budget buy?" should not answer it with a
     fifth of the budget sitting idle. The button still turns it off for
     anyone who wants to see the plain proportional split. */
  const [redistribute, setRedistribute] = useState(SOLAR_EXPLORER_DEFAULTS.redistribute);

  // Brand selections (objective hints default brands)
  const [panelBrand, setPanelBrand] = useState<string>(SOLAR_EXPLORER_DEFAULTS.panelBrand);
  const [inverterBrand, setInverterBrand] = useState<string>(SOLAR_EXPLORER_DEFAULTS.inverterBrand);
  const [batteryBrand, setBatteryBrand] = useState<string>(SOLAR_EXPLORER_DEFAULTS.batteryBrand);

  /* Open on the estimate a shared link describes. Read from window.location
     after mount, like the page around it, rather than in the initial state:
     this component is server-rendered too, where there is no URL to read, and
     a different first render on each side would be a hydration mismatch. */
  useEffect(() => {
    const shared = decodeSolarExplorerState(new URLSearchParams(window.location.search));
    if (shared.budget !== undefined) setBudgetInput(String(shared.budget));
    // setObjective, not setObjectiveAndBrands: the link's own brands must win
    // over the defaults a priority would otherwise pick.
    if (shared.objective) setObjective(shared.objective);
    if (shared.panelBrand) setPanelBrand(shared.panelBrand);
    if (shared.inverterBrand) setInverterBrand(shared.inverterBrand);
    if (shared.batteryBrand) setBatteryBrand(shared.batteryBrand);
    if (shared.laborPct !== undefined) setLaborPct(shared.laborPct);
    if (shared.installCustom !== undefined) setInstallCustom(shared.installCustom);
    if (shared.enabledCards) setEnabledCards(shared.enabledCards);
    if (shared.redistribute !== undefined) setRedistribute(shared.redistribute);
    if (shared.wiringKit) setWiringKit(shared.wiringKit);
  }, []);

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
    () =>
      allocateBudget({
        totalBudget: budget,
        panelBrand: pBrand,
        inverterBrand: iBrand,
        batteryBrand: bBrand,
        enabledCards,
        objective,
        installCustom,
        laborPct,
        redistribute,
        wiringKit,
      }),
    [budget, pBrand, iBrand, bBrand, enabledCards, objective, installCustom, laborPct, redistribute, wiringKit],
  );

  const totalAllocated =
    allocation.panels.cost +
    allocation.inverter.cost +
    allocation.battery.cost +
    allocation.protection.cost +
    allocation.installation.cost +
    allocation.transport.cost;

  const remaining = budget - totalAllocated;
  /* Every dollar figure on this page is rounded before it is shown. The
     allocator divides by ratio, so it produces values like $511.1 and $988.1,
     and a tenth of a cent of false precision next to whole-dollar supplier
     prices makes the whole estimate look machine-generated. */
  const usd = (value: number) => `$${Math.round(value).toLocaleString()}`;

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
  const backupWithFridge = backupHours(
    allocation.battery.units * allocation.battery.brand.unitKwh,
    BACKUP_LOADS[1],
  );
  const zeraTier = getRequiredZeraTier(allocation.panels.count * pBrand.watt);

  const toggleCard = useCallback((id: string) => {
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
      include_protection: enabledCards.protection && allocation.protection.cost > 0,
      include_contingency: false,
      /* The rate the user picked, so the saved BOQ charges the labour this page
         quoted rather than the catalog default. */
      install_labor_pct: allocation.installation.isCustom ? undefined : laborPct,
      wiring_kit: wiringKit,
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
    /* A link that rebuilds this exact estimate. It used to be the page's bare
       address, which opened an empty explorer for whoever received it. */
    const link = `${window.location.origin}/quick-budget?${encodeSolarExplorerState({
      budget,
      objective,
      panelBrand,
      inverterBrand,
      batteryBrand,
      laborPct,
      installCustom,
      enabledCards: Object.fromEntries(
        SOLAR_CARD_IDS.map((id) => [id, Boolean(enabledCards[id])]),
      ) as Record<(typeof SOLAR_CARD_IDS)[number], boolean>,
      redistribute,
      wiringKit,
    }).toString()}&src=share`;

    const shareText = [
      `What ${usd(budget)} buys in solar — ZimEstimate`,
      `${systemKw} kW of panels, ${allocation.inverter.kva} kVA inverter`,
      // storageKwh reads the battery actually bought. This line used the
      // selected brand's size, which was wrong whenever the cheaper fallback
      // battery had been substituted.
      allocation.battery.units > 0
        ? `${storageKwh} kWh battery — ${BACKUP_LOADS[1].label} for ${describeBackup(backupWithFridge)} when ZESA is off`
        : 'No battery at this budget',
      `Total ${usd(totalAllocated)}`,
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Solar Budget Estimate', text: shareText, url: link });
        showSuccess('Estimate shared.');
        captureProductEvent('estimate_shared', { estimate: 'solar', method: 'share_sheet', budget_band: getBudgetBand(budget) });
        return;
      }
      await navigator.clipboard.writeText(`${shareText}\n\n${link}`);
      showSuccess('Estimate summary copied to clipboard.');
      captureProductEvent('estimate_shared', { estimate: 'solar', method: 'clipboard', budget_band: getBudgetBand(budget) });
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
      band: 'system' as const,
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
      band: 'system' as const,
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
      band: 'system' as const,
      label: 'Battery Storage',
      icon: <BatteryCharging size={22} weight="duotone" />,
      enabled: enabledCards.battery,
      cost: allocation.battery.cost,
      description: allocation.battery.units > 0
        ? `${allocation.battery.units}x ${allocation.battery.brand.unitKwh}kWh ${allocation.battery.brand.label} — ${storageKwh} kWh`
        : `${bBrand.label} · $${bBrand.unitPrice}/${bBrand.unitKwh}kWh`,
      /* What the kWh figure means to the person buying it. */
      outcome: allocation.battery.units > 0
        ? `Keeps ${BACKUP_LOADS[1].label} on for ${describeBackup(backupWithFridge)} when ZESA is off`
        : undefined,
      hasBrandPicker: true,
      hasCustomInput: false,
    },
    {
      id: 'protection',
      band: 'required' as const,
      /* Was "Protection & BOS", which read like an insurance add-on for when
         something breaks. These are the parts that connect the system to the
         house — without them the panels and inverter are a pile of boxes. */
      label: 'Wiring & Essentials',
      icon: <ShieldCheck size={22} weight="duotone" />,
      enabled: enabledCards.protection,
      cost: allocation.protection.cost,
      description: wiringKit === 'full'
        ? 'Full kit — cables, breakers, changeover, DB board, earthing, AVS, surge protection, mounting'
        : 'Basic kit — cables, breakers, changeover, DB board, earthing, AVS, mounting',
      hasBrandPicker: false,
      // Expandable, to choose between the full and basic kit.
      hasCustomInput: true,
    },
    {
      id: 'installation',
      band: 'required' as const,
      label: 'Installation',
      icon: <Wrench size={22} weight="duotone" />,
      enabled: enabledCards.installation,
      cost: allocation.installation.cost,
      description: !enabledCards.installation
        ? 'Switch on if you are paying an installer, then set their rate'
        : allocation.installation.isCustom
          ? `Your installer's quote: $${installCustom?.toLocaleString()}`
          : `${allocation.installation.pct}% of hardware — tap to change the rate`,
      hasBrandPicker: false,
      hasCustomInput: true,
    },
    {
      id: 'transport',
      band: 'optional' as const,
      label: 'Transport / Delivery',
      icon: <Truck size={22} weight="duotone" />,
      enabled: enabledCards.transport,
      cost: allocation.transport.cost,
      description: `Equipment delivery to site (~$${TRANSPORT_COST} — enable if charged separately)`,
      hasBrandPicker: false,
      hasCustomInput: false,
    },
  ];

  /* ── Reading the allocation back to the user ────────────────────────────
     This section is not a shopping list, though it was laid out like one:
     allocateBudget divides the budget by ratio across inverter, battery and
     panels, then prices protection and installation on top. So a row can be
     switched on and still cost nothing — the money ran out before it. That
     showed as a bare "—", which reads as free, or broken, rather than as the
     most useful sentence on the page: how much more you would need.

     The gap is quoted against what the row actually describes — the brand the
     user has selected — not against the cheapest thing on the market. Quoting
     the market minimum next to "Dyness · $790/5.12kWh" read as a contradiction.
     The cheaper alternative is offered separately, as a way out. */
  const shortfallFor = (cardId: string): number | null => {
    if (cardId === 'battery') return bBrand?.unitPrice ?? null;
    if (cardId === 'panels') return pBrand?.pricePerPanel ?? null;
    /* The unfunded inverter row names no kVA, so the gap is the brand's
       smallest size — the least it costs to own one at all. */
    if (cardId === 'inverter') return Math.min(...Object.values(iBrand.prices));
    /* Protection is now the first thing dropped when the total will not fit, so
       it needs a gap figure too — the real cost of the kit for the system that
       was actually bought. */
    if (cardId === 'protection' && allocation.protection.droppedForBudget) {
      return solarBalanceOfSystemCost(allocation.panels.count, allocation.battery.units > 0, wiringKit);
    }
    return null;
  };

  /* Only offered when it is genuinely cheaper than the current selection. */
  const cheaperAlternativeFor = (cardId: string): { label: string; price: number } | null => {
    // Named where it helps most: on the row the full kit could not fund.
    if (cardId === 'protection') {
      if (wiringKit === 'basic') return null;
      return {
        label: 'basic kit',
        price: solarBalanceOfSystemCost(allocation.panels.count, allocation.battery.units > 0, 'basic'),
      };
    }
    if (cardId !== 'battery') return null;
    const cheapest = [...BATTERY_BRANDS].sort((a, b) => a.unitPrice - b.unitPrice)[0];
    if (!cheapest || !bBrand || cheapest.unitPrice >= bBrand.unitPrice) return null;
    return { label: cheapest.label, price: cheapest.unitPrice };
  };

  const fundedCards = cards.filter((card) => card.enabled && card.cost > 0);
  const allocatedUsd = fundedCards.reduce((sum, card) => sum + card.cost, 0);
  const remainingUsd = budget - allocatedUsd;

  /* Panels, inverter and battery are the three things people are buying, so
     they are the first band and the money goes to them first. Everything else
     is what an installer adds on top of the kit — real cost, but not what the
     budget is for, and not something to list ahead of the system. */
  const BAND_LABELS: Record<string, { title: string; note: string }> = {
    system: {
      title: 'Your system',
      note: 'Panels, inverter and battery — what your money buys, split by your priority.',
    },
    required: {
      title: 'What the installer adds on top',
      note: 'Needed to install it. When the budget is too small for both, the system comes first. Switch off anything you are arranging yourself.',
    },
    optional: { title: 'Optional', note: 'Switch on if you are charged for these separately.' },
  };
  const BAND_ORDER = ['system', 'required', 'optional'] as const;

  /* Colours for the allocation bar, keyed by card so the bar and the rows
     below it can never fall out of step. */
  const BAND_BAR_COLOUR: Record<string, string> = {
    panels: 'bg-amber-400',
    inverter: 'bg-blue-500',
    battery: 'bg-emerald-500',
    protection: 'bg-slate-400',
    installation: 'bg-slate-300',
    transport: 'bg-slate-200',
  };

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
              onChange={(e) => setBudgetInput(e.target.value.replace(/[^0-9]/g, ''))}
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
                <strong>{usd(totalAllocated)}</strong> allocated
              </span>
              <span className={remaining >= 0 ? 'is-good' : 'is-over'}>
                <strong>{usd(Math.abs(remaining))}</strong>{' '}
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
                onClick={() => setBudget(amt)}
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
          {/* The plain allocated/remaining progress bar that used to sit here is
              gone: the readout under the budget input already says how much is
              left, and the stacked bar further down says the more useful thing
              — which component took which share. Three bars for one number was
              most of why this page read as noisy. */}

          {/* ── Freed budget / reallocate ─────────────────────────────────────── */}
          {hasFreedBudget && !redistribute && (
            <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-5">
              <div className="flex items-start gap-3">
                <ArrowsClockwise size={18} className="flex-shrink-0 mt-0.5 text-emerald-600" />
                <p className="text-sm text-emerald-800">
                  <strong>{usd(remaining)} unallocated.</strong> Reallocate into more panels &amp; battery?
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
          {/* The "budget fully optimised" banner that used to sit here is gone.
              Spending the whole budget is the default now, so the banner fired
              on first load and congratulated the user for doing nothing. The
              off switch lives in the allocation bar below instead. */}

          {/* ── Fallback Battery Banner ──────────────────────────────────────── */}
          {allocation.fallbackBattery && enabledCards.battery && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-200 mb-5">
              <Info size={18} className="flex-shrink-0 mt-0.5 text-indigo-600" />
              <div className="text-sm text-indigo-900 flex-1">
                <strong>Using {allocation.fallbackBattery.label} batteries for now.</strong>{' '}
                Your selected <strong>{bBrand.label}</strong> (${bBrand.unitPrice.toLocaleString()} a unit) does not fit this budget yet.
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

          {/* ── More storage with a cheaper brand ─────────────────────────────
              Offered, never applied: the brand is the user's choice, and the
              cheapest brand is also cheapest per kWh, so applying it whenever it
              stored more would override every choice at every budget. */}
          {allocation.storageOffer && enabledCards.battery && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-5">
              <BatteryCharging size={18} className="flex-shrink-0 mt-0.5 text-emerald-700" />
              <div className="text-sm text-emerald-900 flex-1">
                <strong>More storage for the same money:</strong> {allocation.storageOffer.brand.label} batteries would give
                you {allocation.storageOffer.kwh.toFixed(1)} kWh at this budget, against {storageKwh} kWh with {bBrand.label}.
                <br />
                <button
                  type="button"
                  onClick={() => setBatteryBrand(allocation.storageOffer!.brand.brand)}
                  className="text-emerald-800 underline hover:no-underline text-xs font-semibold mt-1 inline-block"
                >
                  Switch to {allocation.storageOffer.brand.label}
                </button>
              </div>
            </div>
          )}

          {/* ── Where the money went ───────────────────────────────────────────
              A stacked bar before the rows, because the proportions are the
              finding. At a small budget, protection and installation take most
              of it before any solar is bought — that reads as a mistake in a
              plain list and as the point here. */}
          {allocatedUsd > 0 && (
            <div className="mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-[var(--color-text)]">
                  How your {usd(budget)} is split
                </span>
                <span className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span className="tabular-nums">
                    {usd(allocatedUsd)} allocated
                    {remainingUsd >= 1 && <> · {usd(remainingUsd)} unspent</>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRedistribute((prev) => !prev)}
                    className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-accent)]"
                  >
                    {redistribute ? 'show plain split' : 'spend it all'}
                  </button>
                </span>
              </div>

              <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-border-light)]">
                {fundedCards.map((card) => (
                  <div
                    key={card.id}
                    className={BAND_BAR_COLOUR[card.id] ?? 'bg-slate-400'}
                    style={{ width: `${(card.cost / allocatedUsd) * 100}%` }}
                    title={`${card.label}: $${Math.round(card.cost).toLocaleString()}`}
                  />
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {fundedCards.map((card) => (
                  <span key={card.id} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
                    <span className={`h-2 w-2 rounded-full ${BAND_BAR_COLOUR[card.id] ?? 'bg-slate-400'}`} />
                    {card.label}
                    <span className="font-bold tabular-nums text-[var(--color-text)]">
                      {Math.round((card.cost / allocatedUsd) * 100)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* The amber "what your budget did not reach" banner that used to sit
              here is gone. It restated, in four lines of prose, what the row
              itself already says in one — and it was almost always about the
              same single row. */}

          {/* ── Component Cards, grouped by what they are ──────────────────── */}
          <div className="space-y-6 mb-8">
            {BAND_ORDER.map((band) => {
              const bandCards = cards.filter((card) => card.band === band);
              if (bandCards.length === 0) return null;
              return (
                <div key={band}>
                  <div className="mb-2 px-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                      {BAND_LABELS[band].title}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{BAND_LABELS[band].note}</p>
                  </div>
                  <div className="space-y-3">
                    {bandCards.map((card) => {
                      const isExpanded = expandedCard === card.id;
                      const shortfall = card.enabled && card.cost <= 0 ? shortfallFor(card.id) : null;
                      const cheaper = shortfall !== null ? cheaperAlternativeFor(card.id) : null;

                    return (
                      <div
                        key={card.id}
                        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                          shortfall !== null
                            ? 'border-amber-300 bg-amber-50/60'
                            : card.enabled
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
                            <div className="flex items-center justify-between gap-3">
                              <span className={`font-semibold text-sm ${card.enabled ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}>
                                {card.label}
                              </span>
                              {/* Rounded: the allocator produces fractions like
                                  $511.1, which read as false precision next to
                                  whole-dollar supplier prices. */}
                              <span
                                className={`text-lg font-bold tabular-nums ${
                                  shortfall !== null
                                    ? 'text-amber-700'
                                    : card.enabled
                                      ? 'text-[var(--color-text)]'
                                      : 'text-[var(--color-text-muted)]'
                                }`}
                              >
                                {card.enabled && card.cost > 0
                                  ? usd(card.cost)
                                  : shortfall !== null
                                    ? 'Not funded'
                                    : '$0'}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">{card.description}</p>
                            {'outcome' in card && card.outcome && card.enabled && card.cost > 0 && (
                              <p className="mt-1 text-xs font-semibold text-emerald-700">{card.outcome}</p>
                            )}
                            {shortfall !== null && (
                              /* The actionable half of the message. Someone at this
                                 budget wants to know the gap, not that a dash
                                 appeared where a price should be. */
                              <p className="mt-1 text-xs font-semibold text-amber-800">
                                The budget ran out before this one — it needs {usd(shortfall)}.
                                {cheaper && (
                                  <> A {cheaper.label} is {usd(cheaper.price)}.</>
                                )}
                              </p>
                            )}
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

                                {/* Which wiring kit. Both are priced from the same
                                    parts list the BOQ emits, so the figure here is
                                    the figure the saved estimate will charge. */}
                                {card.id === 'protection' && (
                                  <div>
                                    <p className="text-xs font-bold text-[var(--color-text)] mb-2">Which kit?</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {([
                                        {
                                          kit: 'basic' as const,
                                          title: 'Basic',
                                          note: 'Everything to connect it safely. No surge arrestors, combiner box or trunking.',
                                        },
                                        {
                                          kit: 'full' as const,
                                          title: 'Full',
                                          note: 'What a registered installer fits, with surge protection on both sides.',
                                        },
                                      ]).map((option) => {
                                        const active = wiringKit === option.kit;
                                        const price = solarBalanceOfSystemCost(
                                          allocation.panels.count,
                                          allocation.battery.units > 0,
                                          option.kit,
                                        );
                                        return (
                                          <button
                                            key={option.kit}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => setWiringKit(option.kit)}
                                            className={`rounded-xl border p-3 text-left transition ${
                                              active
                                                ? 'border-blue-500 bg-[var(--color-accent-muted)] ring-1 ring-blue-500'
                                                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-dark)]'
                                            }`}
                                          >
                                            <span className="flex items-baseline justify-between gap-2">
                                              <span className="text-sm font-bold text-[var(--color-text)]">{option.title}</span>
                                              <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">{usd(price)}</span>
                                            </span>
                                            <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                                              {option.note}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Installation labour — a rate, or a quoted amount.
                                    Labour is negotiated here, so a fixed
                                    percentage was both too high and unarguable. */}
                                {card.id === 'installation' && (
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-xs font-bold text-[var(--color-text)] mb-2">
                                        What share of hardware is your installer charging?
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {LABOR_RATE_OPTIONS.map((option) => {
                                          const active = installCustom === null && laborPct === option.pct;
                                          return (
                                            <button
                                              key={option.pct}
                                              type="button"
                                              aria-pressed={active}
                                              onClick={() => { setInstallCustom(null); setLaborPct(option.pct); }}
                                              className={`rounded-xl border px-3 py-2 text-left transition ${
                                                active
                                                  ? 'border-blue-500 bg-[var(--color-accent-muted)] ring-1 ring-blue-500'
                                                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-dark)]'
                                              }`}
                                            >
                                              <span className="block text-sm font-bold text-[var(--color-text)]">
                                                {Math.round(option.pct * 100)}%
                                              </span>
                                              <span className="block text-[11px] text-[var(--color-text-secondary)]">
                                                {option.note}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div>
                                      <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                                        Already have a quote? Enter the amount and it overrides the rate.
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[var(--color-text-muted)] font-semibold">$</span>
                                        <input
                                          type="number"
                                          min={0}
                                          step={50}
                                          placeholder={`${Math.round(
                                            (allocation.panels.cost + allocation.inverter.cost + allocation.battery.cost + allocation.protection.cost) * laborPct,
                                          )} (${Math.round(laborPct * 100)}%)`}
                                          value={installCustom ?? ''}
                                          onChange={(e) => setInstallCustom(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                                          className="flex-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-blue-400"
                                        />
                                        {installCustom !== null && (
                                          <button
                                            onClick={() => setInstallCustom(null)}
                                            className="text-xs text-[var(--color-accent)] hover:underline whitespace-nowrap"
                                          >
                                            Use the rate
                                          </button>
                                        )}
                                      </div>
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
                  {
                    label: 'Load-shedding',
                    value: backupWithFridge >= 24 ? '24 h+' : `~${backupWithFridge} h with fridge`,
                    show: enabledCards.battery && allocation.battery.units > 0,
                  },
                  {
                    label: 'Wiring & essentials',
                    /* "Included" was shown whenever the toggle was on, even when
                       the budget never reached it. */
                    value: allocation.protection.cost > 0
                      ? 'Included'
                      : allocation.protection.droppedForBudget
                        ? 'Over budget'
                        : 'Not included',
                    show: true,
                  },
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
                  <li>
                    Installation:{' '}
                    {allocation.installation.isCustom
                      ? "your installer's quoted amount"
                      : `${allocation.installation.pct}% of hardware cost`}
                  </li>
                  <li>Battery: LiFePO4 with 90-95% depth of discharge</li>
                  <li>
                    Load-shedding hours: 6 LED lights, TV, WiFi, phone charging and a fridge
                    ({BACKUP_LOADS[1].watts}W average), using 81% of the battery after inverter losses.
                    Rounded down.
                  </li>
                  {!enabledCards.transport && (
                    <li className="text-[var(--color-text-secondary)]">Transport not included — enable if your supplier charges separately</li>
                  )}
                  {!enabledCards.protection && (
                    <li className="text-amber-700 font-semibold">
                      Wiring &amp; essentials switched off — not recommended
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* ── Matching Packages (grouped by kVA) ──────────────────────────────
              Below the user's own estimate, not above it. On a phone this list
              sat between the budget and the answer, five or six cards deep, so
              you scrolled past other people's systems to find out what your own
              money bought. Packages are the alternative; the split is the answer. */}
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
                <strong>Wiring &amp; essentials switched off.</strong> Cables, breakers, earthing and the changeover switch are what connect the system to your house — no installer will sign off without them. This takes ~${PROTECTION_FIXED} off the estimate, not off the job.
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
              budget tabs — see the note in quick-budget/QuickBudgetClient.tsx. */}
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
