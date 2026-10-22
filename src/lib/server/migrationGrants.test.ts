import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * From 30 October 2026 Supabase no longer grants new tables in `public` to
 * the Data API roles automatically (github.com/orgs/supabase/discussions/45329).
 * A table created without its own GRANT works in the SQL editor and fails in
 * the app with "permission denied" (42501). Tables that existed before keep
 * their grants, so this checks migrations from 066 on: each new table or view
 * needs a GRANT, and a table needs row level security as well.
 */
const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const FIRST_CHECKED = 66;

const strip = (sql: string) => sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const nameOf = (raw: string) => raw.replace(/"/g, '').replace(/^public\./i, '').toLowerCase();

export function missingGrants(sql: string): string[] {
  const text = strip(sql);
  const problems: string[] = [];
  const created = [...text.matchAll(/create\s+(?:or\s+replace\s+)?(table|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?((?:"?\w+"?\.)?"?\w+"?)/gi)];
  for (const [, kindRaw, rawName] of created) {
    if (/\./.test(rawName) && !/^"?public"?\./i.test(rawName)) continue; // another schema
    const name = nameOf(rawName);
    const kind = kindRaw.toLowerCase().replace(/\s+/g, ' ');
    const granted = new RegExp(`grant\\s[^;]*\\son\\s+(?:table\\s+)?(?:"?public"?\\.)?"?${name}"?[\\s,;]`, 'i').test(text);
    if (!granted) problems.push(`${kind} ${name}: no GRANT to anon/authenticated/service_role`);
    if (kind === 'table' && !new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?(?:"?public"?\\.)?"?${name}"?\\s+enable\\s+row\\s+level\\s+security`, 'i').test(text)) {
      problems.push(`table ${name}: row level security not enabled`);
    }
    if (kind !== 'table' && !/security_invoker\s*=\s*(on|true)/i.test(text)) {
      problems.push(`${kind} ${name}: create it WITH (security_invoker = on) so it respects RLS`);
    }
  }
  return problems;
}

describe('new tables are granted explicitly (Supabase, 30 October 2026)', () => {
  it('flags a table with no grant or RLS, and passes one written properly', () => {
    expect(missingGrants('create table public.things (id uuid primary key);')).toEqual([
      'table things: no GRANT to anon/authenticated/service_role',
      'table things: row level security not enabled',
    ]);
    expect(missingGrants(`
      CREATE TABLE IF NOT EXISTS public.things (id uuid primary key);
      ALTER TABLE public.things ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON public.things TO anon, authenticated;
      GRANT ALL ON public.things TO service_role;
    `)).toEqual([]);
    expect(missingGrants('create table auth_extra.x (id int);')).toEqual([]);
  });

  it('every migration from 066 on grants what it creates', () => {
    const files = readdirSync(MIGRATIONS).filter((file) => /^\d+_.*\.sql$/.test(file) && Number(file.split('_')[0]) >= FIRST_CHECKED);
    const problems = files.flatMap((file) => missingGrants(readFileSync(join(MIGRATIONS, file), 'utf8')).map((problem) => `${file}: ${problem}`));
    expect(problems).toEqual([]);
  });
});
