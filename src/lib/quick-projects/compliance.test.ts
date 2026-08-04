import { describe, expect, it } from 'vitest';
import {
  getQuickComplianceRequirements,
  getComplianceProgress,
  type ComplianceStatus,
} from './compliance';

/**
 * "Compliance still applies for quick projects but stages are not applicable."
 *
 * The house checklist is keyed by build stage — substructure, roofing,
 * occupation certificate. A borehole has none of those. It has a drilling
 * permit and a groundwater registration, and they apply to the whole job.
 */

describe('requirements are keyed by project type', () => {
  it('gives a borehole its drilling permit, not a roof certificate', () => {
    const ids = getQuickComplianceRequirements('borehole').map((r) => r.id);
    expect(ids).toContain('zinwa_drilling_permit');
    expect(ids).toContain('groundwater_registration');
    expect(ids).not.toContain('itc_roof_loading_certificate');
  });

  it('gives solar an electrical certificate of compliance', () => {
    const ids = getQuickComplianceRequirements('solar').map((r) => r.id);
    expect(ids).toContain('electrician_coc');
  });

  it('returns nothing for a type we have no gates for, rather than guessing', () => {
    expect(getQuickComplianceRequirements('unknown_type')).toEqual([]);
  });
});

describe('conditional requirements are filtered, not greyed out', () => {
  it('spares a household borehole the commercial abstraction licence', () => {
    // Showing it and leaving the user to work out it is not theirs is worse
    // than not showing it.
    const ids = getQuickComplianceRequirements('borehole', { borehole_purpose: 'domestic' })
      .map((r) => r.id);
    expect(ids).not.toContain('ema_commercial_licence');
  });

  it('adds it for a commercial borehole', () => {
    const ids = getQuickComplianceRequirements('borehole', { borehole_purpose: 'commercial' })
      .map((r) => r.id);
    expect(ids).toContain('ema_commercial_licence');
  });

  it('asks for council siting approval in town but not on a rural plot', () => {
    const urban = getQuickComplianceRequirements('borehole', { project_location: 'harare' });
    const rural = getQuickComplianceRequirements('borehole', { project_location: 'other', area_type: 'rural' });
    expect(urban.map((r) => r.id)).toContain('council_siting_approval');
    expect(rural.map((r) => r.id)).not.toContain('council_siting_approval');
  });

  it('only asks for grid-tie approval on a grid-tied solar system', () => {
    const islanded = getQuickComplianceRequirements('solar', { system_type: 'off_grid' });
    const tied = getQuickComplianceRequirements('solar', { system_type: 'grid_tie' });
    expect(islanded.map((r) => r.id)).not.toContain('zetdc_grid_tie_approval');
    expect(tied.map((r) => r.id)).toContain('zetdc_grid_tie_approval');
  });

  it('treats missing answers as the ordinary domestic case', () => {
    const ids = getQuickComplianceRequirements('borehole').map((r) => r.id);
    expect(ids).not.toContain('ema_commercial_licence');
    expect(ids).toContain('zinwa_drilling_permit');
  });
});

describe('progress', () => {
  const reqs = getQuickComplianceRequirements('borehole', { borehole_purpose: 'domestic' });
  const statuses = (over: Record<string, ComplianceStatus> = {}) => over;

  it('is not clear while a required item is outstanding', () => {
    const p = getComplianceProgress(reqs, statuses({ zinwa_drilling_permit: 'done' }));
    expect(p.clear).toBe(false);
    expect(p.requiredDone).toBeLessThan(p.requiredTotal);
  });

  it('counts not-applicable as settled — the user has answered it', () => {
    const all = Object.fromEntries(
      reqs.map((r) => [r.id, 'not_applicable' as ComplianceStatus]),
    );
    expect(getComplianceProgress(reqs, all).clear).toBe(true);
  });

  it('clears on required items alone — advisory ones do not gate', () => {
    const done = Object.fromEntries(
      reqs.filter((r) => r.required).map((r) => [r.id, 'done' as ComplianceStatus]),
    );
    const p = getComplianceProgress(reqs, done);
    expect(p.clear).toBe(true);
    // ...while still reporting honestly that there is more on the list.
    expect(p.done).toBeLessThan(p.total);
  });

  it('does not count in-progress as done', () => {
    const p = getComplianceProgress(reqs, statuses({ zinwa_drilling_permit: 'in_progress' }));
    expect(p.done).toBe(0);
  });

  it('is vacuously clear for a type with no requirements', () => {
    expect(getComplianceProgress([], {}).clear).toBe(true);
  });
});
