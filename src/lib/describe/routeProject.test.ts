import { describe, expect, it } from 'vitest';
import { routeProject, type ProjectIntent } from './routeProject';
import { decodeSolarExplorerState } from '@/lib/quick-projects/solar/explorerUrl';
import { decodeBoreholeExplorerState } from '@/lib/quick-projects/borehole/explorerUrl';

const intent = (patch: Partial<ProjectIntent>): ProjectIntent => ({
  kind: 'unclear', budgetUsd: null, floorAreaM2: null, place: null, setting: null, economy: false,
  solarPriority: null, boreholeDepthM: null, boreholeCommercial: false, ...patch,
});
const query = (href: string) => new URLSearchParams(href.split('?')[1] ?? '');

describe('opening the right page for a described project', () => {
  it('sends a house with a budget to the budget check, filled in', () => {
    const route = routeProject(intent({ kind: 'house', budgetUsd: 25000, floorAreaM2: 120, setting: 'peri-urban', economy: true }));
    expect(route?.href.startsWith('/quick-budget?')).toBe(true);
    expect(Object.fromEntries(query(route!.href))).toEqual({ budget: '25000', area: '120', loc: 'peri-urban', profile: 'economy' });
    expect(route?.understood).toEqual(['House', '$25,000 budget', '120 m² floor area', 'Peri-urban site', 'Economy build']);
  });

  it('opens the estimator, not a budget check, when no budget was given', () => {
    expect(routeProject(intent({ kind: 'house' }))?.href).toBe('/boq/new?method=manual&fresh=1&preset=full_house');
    expect(routeProject(intent({ kind: 'house_stages' }))?.href).toBe('/boq/new?method=manual&fresh=1&preset=building_in_stages');
    expect(routeProject(intent({ kind: 'solar' }))?.href).toBe('/quick-projects/solar');
  });

  it('builds links the solar and borehole explorers read back', () => {
    const solar = routeProject(intent({ kind: 'solar', budgetUsd: 3000, solarPriority: 'quality' }))!;
    expect(decodeSolarExplorerState(query(solar.href))).toMatchObject({ budget: 3000, objective: 'quality' });

    const borehole = routeProject(intent({ kind: 'borehole', budgetUsd: 4000, place: 'Bulawayo', boreholeDepthM: 80 }))!;
    expect(decodeBoreholeExplorerState(query(borehole.href))).toMatchObject({ budget: 4000, location: 'bulawayo', depth: 80 });
  });

  it('leaves out a town the borehole costs do not know', () => {
    const route = routeProject(intent({ kind: 'borehole', budgetUsd: 4000, place: 'Victoria Falls' }))!;
    expect(query(route.href).has('location')).toBe(false);
  });

  it('ignores budgets and sizes that cannot be real', () => {
    const route = routeProject(intent({ kind: 'house', budgetUsd: -5, floorAreaM2: 1e9 }))!;
    expect(route.href).toBe('/boq/new?method=manual&fresh=1&preset=full_house');
  });

  it('has nowhere to send an unclear description', () => {
    expect(routeProject(intent({ kind: 'unclear', budgetUsd: 1000 }))).toBeNull();
  });

  it('carries a house\'s floor area, storeys and site into the builder link', () => {
    const route = routeProject(intent({ kind: 'house', floorAreaM2: 250, storeys: 2, setting: 'rural' }))!;
    expect(route.href.startsWith('/boq/new?')).toBe(true);
    expect(Object.fromEntries(query(route.href))).toEqual({ method: 'manual', fresh: '1', preset: 'full_house', area: '250', floors: '2', loc: 'rural' });
    expect(route.understood).toEqual(['House', '250 m² floor area', 'Double storey', 'Rural site']);
  });

  it('sends a double storey with a budget to the budget check with two floors', () => {
    const route = routeProject(intent({ kind: 'house', budgetUsd: 60000, storeys: 2 }))!;
    expect(Object.fromEntries(query(route.href))).toEqual({ budget: '60000', floors: '2' });
  });

  it('lists only what the page it opens will have filled in', () => {
    // The builder has no economy build to set.
    expect(routeProject(intent({ kind: 'house', economy: true }))!.understood).toEqual(['House']);
    // The borehole estimate takes nothing from a link.
    const borehole = routeProject(intent({ kind: 'borehole', place: 'Harare', boreholeDepthM: 60, boreholeCommercial: true }))!;
    expect(borehole).toMatchObject({ href: '/quick-projects/borehole', understood: ['Borehole'] });
  });

  it('opens material prices for a question about what a material costs', () => {
    expect(routeProject(intent({ kind: 'material_prices' }))).toMatchObject({ href: '/market-insights', understood: ['Material prices'] });
  });
});
