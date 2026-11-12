import { LOCATION_DEFAULTS } from '@/lib/quick-projects/borehole/catalog';

/**
 * Turns what someone typed about their project into the page that prices it,
 * with what they said already filled in.
 *
 * The AI step (describeProject.ts) only extracts these fields from the
 * sentence; this decides where they go, and it only fills in what was
 * actually said — a missing budget opens the estimator rather than a budget
 * check with a made-up number. Every value is passed through the same URL
 * parameters the pages already read for shared links and sign-in returns, so
 * the destination validates it again.
 */

export type ProjectKind =
  | 'house'
  | 'house_stages'
  | 'solar'
  | 'borehole'
  | 'water_tank'
  | 'septic'
  | 'fencing'
  | 'paving'
  | 'quote_check'
  | 'floor_plan'
  | 'material_prices'
  | 'unclear';

export interface ProjectIntent {
  kind: ProjectKind;
  budgetUsd: number | null;
  floorAreaM2: number | null;
  /** Where in the country, as said: a town, or urban / peri-urban / rural. */
  place: string | null;
  setting: 'urban' | 'peri-urban' | 'rural' | null;
  /** "cheap", "basic" → economy; anything else is the standard build. */
  economy: boolean;
  /** Two when they say double storey, two storey or upstairs; otherwise not said. */
  storeys?: 2 | null;
  solarPriority: 'economy' | 'balanced' | 'quality' | null;
  boreholeDepthM: number | null;
  boreholeCommercial: boolean;
}

export interface ProjectRoute {
  href: string;
  /** What the page will open, in a few words. */
  destination: string;
  /** What was taken from the sentence, to show before going. */
  understood: string[];
}

const MAX_BUDGET = 5_000_000;
const MAX_AREA = 5_000;

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const sane = (n: number | null, max: number): number | null =>
  n !== null && Number.isFinite(n) && n > 0 && n <= max ? Math.round(n) : null;

export function routeProject(intent: ProjectIntent): ProjectRoute | null {
  const budget = sane(intent.budgetUsd, MAX_BUDGET);
  const area = sane(intent.floorAreaM2, MAX_AREA);
  const understood: string[] = [];
  if (budget) understood.push(`${usd(budget)} budget`);

  /* "What we understood" is a promise: each thing listed there is filled in
     on the page that opens. A borehole's town and depth used to be listed
     and then dropped when no budget was given, and a house's floor area,
     site and economy build likewise on the way to the builder. Whatever a
     destination cannot take is no longer listed. */
  switch (intent.kind) {
    case 'house':
    case 'house_stages': {
      const double = intent.storeys === 2;
      if (area) understood.push(`${area} m² floor area`);
      if (double) understood.push('Double storey');
      if (intent.setting) understood.push(intent.setting === 'peri-urban' ? 'Peri-urban site' : `${intent.setting[0].toUpperCase()}${intent.setting.slice(1)} site`);
      if (budget) {
        // With a budget the question is "how far does it go", which the
        // budget check answers by stage.
        const params = new URLSearchParams({ budget: String(budget) });
        if (area) params.set('area', String(area));
        if (double) params.set('floors', '2');
        if (intent.setting) params.set('loc', intent.setting);
        if (intent.economy) { params.set('profile', 'economy'); understood.push('Economy build'); }
        return { href: `/quick-budget?${params}`, destination: 'House budget check', understood: ['House', ...understood] };
      }
      // The builder takes the same three from its link (boq/new/page.tsx).
      // It has no economy build to set, so that is not listed here.
      const stages = intent.kind === 'house_stages';
      const params = new URLSearchParams({ method: 'manual', fresh: '1', preset: stages ? 'building_in_stages' : 'full_house' });
      if (area) params.set('area', String(area));
      if (double) params.set('floors', '2');
      if (intent.setting) params.set('loc', intent.setting);
      return {
        href: `/boq/new?${params}`,
        destination: stages ? 'Estimate by stage' : 'Full house estimate',
        understood: [stages ? 'House, built in stages' : 'House', ...understood],
      };
    }
    case 'solar': {
      if (intent.solarPriority && intent.solarPriority !== 'balanced') {
        understood.push(intent.solarPriority === 'quality' ? 'Best quality' : 'Lowest cost');
      }
      if (!budget) return { href: '/quick-projects/solar', destination: 'Solar estimate', understood: ['Solar', ...understood] };
      const params = new URLSearchParams({ mode: 'solar', budget: String(budget) });
      if (intent.solarPriority) params.set('priority', intent.solarPriority);
      return { href: `/quick-budget?${params}`, destination: 'Solar budget check', understood: ['Solar', ...understood] };
    }
    case 'borehole': {
      const town = intent.place?.trim().toLowerCase().replace(/\s+/g, '') ?? '';
      const location = town && town !== 'other' && Object.hasOwn(LOCATION_DEFAULTS, town) ? town : null;
      const depth = sane(intent.boreholeDepthM, 300);
      // The borehole estimate asks its own questions and takes nothing from a link.
      if (!budget) return { href: '/quick-projects/borehole', destination: 'Borehole estimate', understood: ['Borehole'] };
      if (location) understood.push(location[0].toUpperCase() + location.slice(1));
      if (depth) understood.push(`${depth} m deep`);
      if (intent.boreholeCommercial) understood.push('Commercial use');
      const params = new URLSearchParams({ mode: 'borehole', budget: String(budget) });
      if (location) params.set('location', location);
      if (depth) params.set('depth', String(depth));
      if (intent.boreholeCommercial) params.set('purpose', 'commercial');
      return { href: `/quick-budget?${params}`, destination: 'Borehole budget check', understood: ['Borehole', ...understood] };
    }
    case 'fencing':
    case 'paving': {
      const label = intent.kind === 'fencing' ? 'Fencing' : 'Paving';
      if (!budget) return { href: `/quick-projects/${intent.kind}`, destination: `${label} estimate`, understood: [label] };
      return {
        href: `/quick-budget?${new URLSearchParams({ mode: intent.kind, budget: String(budget) })}`,
        destination: `${label} budget check`,
        understood: [label, ...understood],
      };
    }
    case 'water_tank':
      return { href: '/quick-projects/water', destination: 'Water tank estimate', understood: ['Water tank'] };
    case 'septic':
      return { href: '/quick-projects/septic', destination: 'Septic tank estimate', understood: ['Septic tank'] };
    case 'quote_check':
      return { href: '/ai/quote-check', destination: 'Check a quote', understood: ['Checking a quote'] };
    case 'floor_plan':
      return { href: '/ai/vision-takeoff', destination: 'Read my floor plan', understood: ['Pricing from a floor plan'] };
    case 'material_prices':
      return { href: '/market-insights', destination: 'Material prices', understood: ['Material prices'] };
    default:
      return null;
  }
}
