import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROJECT_SOIL_TYPES,
  PROJECT_SITE_SLOPES,
  PROJECT_GEOTECH_MODES,
} from './database.types';

/**
 * The app's enums and the database's CHECK constraints have to agree.
 *
 * They did not: the site conditions step offered "Not Sure", ProjectSoilType
 * declared 'not_sure', and projects_soil_type_check listed four values that did
 * not include it. Saving a finished BOQ failed outright with
 *
 *   new row for relation "projects" violates check constraint
 *   "projects_soil_type_check"
 *
 * shown to the user as a raw Postgres constraint name. Nothing in TypeScript
 * could catch it, because the type was the half that was right.
 *
 * These read the migrations as the source of truth and assert the TypeScript
 * unions match — so adding an option in either place without the other fails
 * here rather than in production at the last step of a long form.
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

/**
 * The values a constraint currently allows, honouring later migrations that
 * redefine it. Reads files in order and keeps the last definition, which is how
 * Postgres ends up seeing it.
 */
function allowedValues(constraintName: string): string[] {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  let latest: string[] | null = null;

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    // Find the constraint definition, then the in (...) list that follows it.
    const at = sql.indexOf(constraintName);
    if (at === -1) continue;
    const after = sql.slice(at);
    const inList = after.match(/\bin\s*\(([^)]*)\)/i);
    if (!inList) continue;
    const values = [...inList[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    if (values.length) latest = values;
  }

  if (!latest) throw new Error(`No constraint definition found for ${constraintName}`);
  return latest;
}

describe('projects_soil_type_check', () => {
  it('allows every soil type the app can produce', () => {
    const allowed = allowedValues('projects_soil_type_check');
    PROJECT_SOIL_TYPES.forEach((value) => {
      expect(allowed, `${value} is offered by the app but rejected by the database`).toContain(value);
    });
  });

  it('allows not_sure specifically', () => {
    // The regression that lost a completed BOQ at the save step.
    expect(allowedValues('projects_soil_type_check')).toContain('not_sure');
  });

  it('does not allow values the app never produces', () => {
    const allowed = allowedValues('projects_soil_type_check');
    allowed.forEach((value) => {
      expect(PROJECT_SOIL_TYPES as readonly string[]).toContain(value);
    });
  });
});

describe('projects_site_slope_check', () => {
  it('matches the slopes the app offers, in both directions', () => {
    const allowed = allowedValues('projects_site_slope_check');
    expect([...allowed].sort()).toEqual([...PROJECT_SITE_SLOPES].sort());
  });
});

describe('projects_geotech_analysis_mode_check', () => {
  it('matches the modes the app assigns, in both directions', () => {
    const allowed = allowedValues('projects_geotech_analysis_mode_check');
    expect([...allowed].sort()).toEqual([...PROJECT_GEOTECH_MODES].sort());
  });
});
