import {
  BATTERY_BRANDS,
  type BatteryOption,
  type InverterOption,
  type PanelOption,
} from './catalog';
import { solarBalanceOfSystemCost, SOLAR_TRANSPORT_COST, type SolarWiringKit } from './boq';

/**
 * How the Solar Budget Explorer divides a budget across a system.
 *
 * Lives outside the component so its rules can be tested. They are easy to
 * break and expensive when broken: every number on the explorer, and the BOQ
 * a user saves from it, comes out of this one function.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Objective = 'economy' | 'balanced' | 'quality';

export interface BudgetAllocation {
  panels: { count: number; brand: PanelOption; cost: number };
  inverter: { kva: number; brand: InverterOption; cost: number };
  battery: { units: number; brand: BatteryOption; cost: number };
  /** droppedForBudget: switched on, but the money did not reach it. */
  protection: { cost: number; droppedForBudget: boolean };
  installation: { cost: number; pct: number; isCustom: boolean };
  transport: { cost: number };
  /** The brand used instead of the selected one, when it gives more storage. */
  fallbackBattery: BatteryOption | null;
  /** With a fallback in use: the storage the selected brand would have given. */
  selectedBrandKwh: number | null;
  /** A cheaper brand that would give more storage than the selected one — offered, not applied. */
  storageOffer: { brand: BatteryOption; kwh: number } | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function bestInverterForBudget(budget: number, brand: InverterOption): { kva: number; price: number } {
  const sizes = Object.entries(brand.prices)
    .map(([k, v]) => ({ kva: Number(k), price: v }))
    .sort((a, b) => b.kva - a.kva);
  for (const s of sizes) {
    if (s.price <= budget) return s;
  }
  const smallest = sizes[sizes.length - 1];
  return smallest ?? { kva: 3, price: 350 };
}

export interface AllocateBudgetInput {
  totalBudget: number;
  panelBrand: PanelOption;
  inverterBrand: InverterOption;
  batteryBrand: BatteryOption;
  enabledCards: Record<string, boolean>;
  objective: Objective;
  /** The installer's own quote in dollars; overrides laborPct when set. */
  installCustom: number | null;
  /** Labour as a share of hardware, e.g. 0.15. The user picks this. */
  laborPct: number;
  /** false is the plain proportional split, with no leftover spent. */
  redistribute: boolean;
  /** Defaults to the full kit. */
  wiringKit?: SolarWiringKit;
  /** Internal: size the system around this inverter instead of the largest that fits. */
  inverterSize?: { kva: number; price: number };
}

/* Sizes panels, inverter and storage for a budget, with no wiring kit. The
   wiring decision is made once, by allocateBudget below. */
function allocateSystem({
  totalBudget,
  panelBrand,
  inverterBrand,
  batteryBrand,
  enabledCards,
  objective,
  installCustom,
  laborPct,
  redistribute,
  inverterSize,
}: AllocateBudgetInput): BudgetAllocation {
  // Proportional splits — all three core components get budget simultaneously
  const ratios = {
    economy:  { inverter: 0.30, battery: 0.25, panels: 0.45 },
    balanced: { inverter: 0.33, battery: 0.28, panels: 0.39 },
    quality:  { inverter: 0.38, battery: 0.27, panels: 0.35 },
  }[objective];

  const transportCost = enabledCards.transport ? SOLAR_TRANSPORT_COST : 0;

  /* No wiring kit here — this sizes the system alone. Whether the kit is
     reserved is decided once, in allocateBudget, which only does so when the
     budget covers a complete system as well. (Reserving it unconditionally,
     as this once did, meant $1,000 bought a $511 kit and no battery.) */
  let coreBudget = totalBudget - transportCost;
  if (enabledCards.installation) {
    coreBudget = installCustom !== null
      ? Math.max(0, coreBudget - installCustom)
      : Math.max(0, coreBudget / (1 + laborPct)); // hardware = total / (1 + pct)
  }

  // ── Step 1: Select inverter ─────────────────────────────────────────────────
  const inv = inverterSize ?? bestInverterForBudget(
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

  // ── Step 3: Panels from their share ────────────────────────────────────────
  //
  // Their *share*, not everything left over. Panels used to take the whole
  // remainder, which is how a $2,500 budget ended up with a 10 kW array on an
  // 8 kVA inverter and a single 2.6 kWh battery — three components that are
  // meant to be proportional, with one of them eating the other two's
  // headroom. Panels are the cheapest unit here, so any rounding error lands
  // on them and the imbalance compounds.
  const afterBattery = afterInverter - batteryCost;
  const panelBudget = Math.min(coreBudget * ratios.panels, afterBattery);

  /* An array the inverter cannot take is not a bigger system, it is wasted
     money. Leftover budget used to pile onto panels with no ceiling, which
     produced an 18.9 kW array on a 12 kVA inverter. 1.3x the inverter rating
     is the usual limit for DC oversizing on a hybrid unit. */
  const maxPanelsForInverter = Math.max(
    1,
    Math.floor((inv.kva * 1.3 * 1000) / (panelBrand.watt || 440)),
  );

  let panelCount = enabledCards.panels && panelBudget >= panelBrand.pricePerPanel
    ? Math.min(maxPanelsForInverter, Math.floor(panelBudget / panelBrand.pricePerPanel))
    : 0;
  let panelCost = panelCount * panelBrand.pricePerPanel;

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
    const hardware = inverterCost + batteriesCost + panelsCost;
    const install = enabledCards.installation
      ? installCustom !== null && installCustom > 0
        ? installCustom
        : Math.round(hardware * laborPct)
      : 0;
    return { panelsCost, batteriesCost, hardware, install, total: hardware + install + transportCost };
  };

  let priced = priceAll(panelCount, batteryUnits);

  // ── Make the system fit ────────────────────────────────────────────────────
  //
  // Panels give way first — the divisible part. A battery or an inverter
  // cannot be bought in fractions, and dropping either changes what the
  // system can do rather than just how much of it there is.
  while (priced.total > totalBudget && panelCount > 0) {
    panelCount -= 1;
    priced = priceAll(panelCount, batteryUnits);
  }

  // Still over with no panels left: the battery is what does not fit.
  while (priced.total > totalBudget && batteryUnits > 0) {
    batteryUnits -= 1;
    priced = priceAll(panelCount, batteryUnits);
  }

  /* ── Spend what is left, in the order people here prioritise ──────────────
     Every step re-prices: another panel also means more cable, trunking and
     labour, so spending "what is left" without repricing overshoots.

     1. Storage, because it is what people buy solar for here, up to the
        System Advisor's own ideal of 2 kWh per kVA of inverter. Without a
        ceiling a large budget would turn entirely into batteries.
     2. Panels, up to what the inverter can take.
     The plain split skips both. */
  const activeBatBrand = fallbackBattery ?? batteryBrand;
  const maxStorageKwh = inv.kva * 2;

  if (redistribute) {
    while (
      enabledCards.battery &&
      activeBatBrand.unitPrice > 0 &&
      (batteryUnits + 1) * activeBatBrand.unitKwh <= maxStorageKwh
    ) {
      const trial = priceAll(panelCount, batteryUnits + 1);
      if (trial.total > totalBudget) break;
      batteryUnits += 1;
      priced = trial;
    }
  }

  if (redistribute) {
    while (enabledCards.panels && panelBrand.pricePerPanel > 0 && panelCount < maxPanelsForInverter) {
      const trial = priceAll(panelCount + 1, batteryUnits);
      if (trial.total > totalBudget) break;
      panelCount += 1;
      priced = trial;
    }
  }

  panelCost = priced.panelsCost;
  batteryCost = priced.batteriesCost;
  const installCost = priced.install;
  const installPct =
    installCustom !== null && installCustom > 0 && priced.hardware > 0
      ? Math.round((installCustom / priced.hardware) * 100)
      : Math.round(laborPct * 100);
  const isCustom = installCustom !== null && installCustom > 0;

  return {
    panels: { count: panelCount, brand: panelBrand, cost: panelCost },
    inverter: { kva: inv.kva, brand: inverterBrand, cost: inverterCost },
    battery: { units: batteryUnits, brand: fallbackBattery ?? batteryBrand, cost: batteryCost },
    protection: { cost: 0, droppedForBudget: false },
    installation: { cost: Math.round(installCost), pct: installPct, isCustom },
    transport: { cost: transportCost },
    fallbackBattery,
    selectedBrandKwh: null,
    storageOffer: null,
  };
}

const kwhOf = (a: BudgetAllocation) => a.battery.units * a.battery.brand.unitKwh;

/* The cheapest battery by unit price — the substitute when the selected brand
   would give less storage. */
const SUBSTITUTE_BATTERY = [...BATTERY_BRANDS].sort((a, b) => a.unitPrice - b.unitPrice)[0];

/**
 * Sizes the system around each inverter size the budget reaches, and keeps
 * the one with the most storage — the bigger inverter on a tie.
 *
 * Storage used to fall as the budget rose, because the inverter jumped a size
 * the moment its share reached the next price: $3,100 bought 7.7 kWh, $3,200
 * bought 5.1 kWh beside a bigger inverter. With the inverter fixed, more money
 * never buys less storage, and a bigger budget only adds sizes to choose
 * from, so the best of them cannot fall. Storage decides because it is what
 * people buy solar for here, ahead of inverter headroom most households will
 * not use.
 *
 * The battery brand is the user's. The cheapest brand is used only while the
 * selected one cannot fit at all; when the selected brand fits but a cheaper
 * one would store more, that is returned as an offer for the page to make,
 * not applied. (Applying it was tried: the cheapest brand is also the
 * cheapest per kWh, so it won at every budget and the brand picker — and the
 * battery half of the "Quality" priority — stopped doing anything.)
 */
function withBestBattery(input: AllocateBudgetInput): BudgetAllocation {
  const base = allocateSystem(input);

  const bestAcrossInverters = (batteryBrand: BatteryOption): BudgetAllocation => {
    if (!input.enabledCards.inverter) return allocateSystem({ ...input, batteryBrand });
    const sizes = Object.entries(input.inverterBrand.prices)
      .map(([kva, price]) => ({ kva: Number(kva), price }))
      .filter((size) => size.kva <= base.inverter.kva);
    return sizes
      .map((inverterSize) => allocateSystem({ ...input, batteryBrand, inverterSize }))
      .reduce((best, candidate) =>
        kwhOf(candidate) > kwhOf(best) || (kwhOf(candidate) === kwhOf(best) && candidate.inverter.kva > best.inverter.kva)
          ? candidate
          : best,
      );
  };

  const chosen = input.enabledCards.battery ? bestAcrossInverters(input.batteryBrand) : base;
  if (!input.enabledCards.battery || !SUBSTITUTE_BATTERY || SUBSTITUTE_BATTERY.brand === input.batteryBrand.brand) {
    return chosen;
  }

  const cheaper = bestAcrossInverters(SUBSTITUTE_BATTERY);

  // The selected brand does not fit at all: the cheaper unit is used, and the
  // page says the selected one does not fit.
  if (chosen.fallbackBattery || chosen.battery.units === 0) {
    const useCheaper = kwhOf(cheaper) > kwhOf(chosen);
    const result = useCheaper ? cheaper : chosen;
    return { ...result, fallbackBattery: useCheaper ? SUBSTITUTE_BATTERY : chosen.fallbackBattery, selectedBrandKwh: 0 };
  }

  // The selected brand fits. Keep it; offer the cheaper one if it stores more.
  return kwhOf(cheaper) > kwhOf(chosen)
    ? { ...chosen, storageOffer: { brand: SUBSTITUTE_BATTERY, kwh: kwhOf(cheaper) } }
    : chosen;
}

const totalOf = (a: BudgetAllocation) =>
  a.panels.cost + a.inverter.cost + a.battery.cost + a.protection.cost + a.installation.cost + a.transport.cost;

/**
 * Divides a budget across a solar system, and decides once whether the wiring
 * kit is in it.
 *
 * The kit is essential — nothing can be installed without the cable,
 * breakers, changeover and earthing — but it is the part people here value
 * least. So:
 *
 * - If the budget cannot buy a complete system (inverter, at least one panel,
 *   at least one battery) and the kit, the kit is left out and the row says
 *   what it needs. Storage and panels win at small budgets.
 * - Once it can, the kit is set aside first and the system sized on what is
 *   left, so the estimate is one that can actually be installed.
 *
 * Deciding it this way, rather than slotting the kit into the order things
 * are bought, keeps it from flickering. When it competed with each extra
 * battery it was funded at $4,500, lost at $5,500, back at $6,000 — every step
 * that bought another battery took the wiring money. Here a bigger budget
 * never loses it, and a cheaper kit or labour rate only ever brings it in
 * sooner.
 */
export function allocateBudget(input: AllocateBudgetInput): BudgetAllocation {
  const { totalBudget, enabledCards, laborPct, installCustom, wiringKit = 'full' } = input;

  const systemFor = (budget: number) => withBestBattery({
    ...input,
    totalBudget: Math.max(0, budget),
    enabledCards: { ...enabledCards, protection: false },
  });

  const withoutWiring = systemFor(totalBudget);
  if (!enabledCards.protection) return withoutWiring;

  const quoted = installCustom !== null && installCustom > 0;
  const labourOnKit = enabledCards.installation && !quoted ? 1 + laborPct : 1;
  const kitFor = (system: BudgetAllocation) =>
    solarBalanceOfSystemCost(system.panels.count, system.battery.units > 0, wiringKit);

  /* Adds the kit to a sized system, with labour charged on it like any other
     hardware, shedding panels if the kit's cable pushed the total over. */
  const addWiring = (system: BudgetAllocation): BudgetAllocation => {
    let panels = system.panels.count;
    const priceWith = (panelCount: number): BudgetAllocation => {
      const panelCost = panelCount * system.panels.brand.pricePerPanel;
      const kit = solarBalanceOfSystemCost(panelCount, system.battery.units > 0, wiringKit);
      const hardware = panelCost + system.inverter.cost + system.battery.cost + kit;
      const install = !enabledCards.installation ? 0 : quoted ? (installCustom as number) : Math.round(hardware * laborPct);
      return {
        ...system,
        panels: { ...system.panels, count: panelCount, cost: panelCost },
        protection: { cost: kit, droppedForBudget: false },
        installation: {
          ...system.installation,
          cost: Math.round(install),
          pct: quoted && hardware > 0 ? Math.round(((installCustom as number) / hardware) * 100) : Math.round(laborPct * 100),
        },
      };
    };
    let priced = priceWith(panels);
    while (totalOf(priced) > totalBudget && panels > 0) {
      panels -= 1;
      priced = priceWith(panels);
    }
    return priced;
  };

  // The kit's cable scales with the array, and the array depends on what is
  // left after the kit — so settle the reserve in a few passes.
  let reserve = kitFor(withoutWiring) * labourOnKit;
  let sized = systemFor(totalBudget - reserve);
  for (let pass = 0; pass < 3; pass++) {
    const next = kitFor(sized) * labourOnKit;
    if (Math.abs(next - reserve) < 1) break;
    reserve = next;
    sized = systemFor(totalBudget - reserve);
  }

  const wired = addWiring(sized);
  const complete =
    totalOf(wired) <= totalBudget &&
    (!enabledCards.inverter || wired.inverter.cost > 0) &&
    (!enabledCards.panels || wired.panels.count > 0) &&
    (!enabledCards.battery || wired.battery.units > 0);

  if (complete) return wired;
  return { ...withoutWiring, protection: { cost: 0, droppedForBudget: true } };
}
