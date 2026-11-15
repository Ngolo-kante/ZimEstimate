#!/usr/bin/env node
// Run after every `npx shadcn@latest add …`:  node scripts/shadcn-scope.mjs
//
// shadcn components are written for shadcn's own colour names (bg-muted,
// bg-accent, text-secondary-foreground…). This app already uses several of
// those names with other meanings: `muted` and `secondary` are grey TEXT
// colours and `accent` is the brand blue. Left as is, a shadcn menu item would
// hover in bright blue and a muted panel would be grey text colour.
//
// So every shadcn colour class is moved to an `sc-` name (bg-sc-muted…), and
// src/styles/shadcn.css maps those names onto the app's palette. It also:
// - drops `dark:` classes (the app has no dark mode; Tailwind's default `dark:`
//   follows the phone's setting and would restyle only these components);
// - imports `cn` from the app's own helper (the CLI wrote `from "cn"`, an
//   unrelated npm package).
// Safe to run more than once.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../src/components/shadcn/', import.meta.url).pathname;
const TOKENS = [
  'background', 'foreground', 'card-foreground', 'card', 'popover-foreground', 'popover',
  'primary-foreground', 'primary', 'secondary-foreground', 'secondary', 'muted-foreground', 'muted',
  'accent-foreground', 'accent', 'destructive-foreground', 'destructive', 'border', 'input', 'ring',
].join('|');
const UTIL = 'bg|text|border|ring|outline|fill|stroke|from|to|via|divide|caret|decoration|shadow|ring-offset';
const colour = new RegExp(`(?<=^|[\\s"'\`:])(${UTIL})-(${TOKENS})(?=$|[\\s"'\`/])`, 'g');
const dark = /(^|[\s"'`])dark:[^\s"'`]+/g;

for (const f of readdirSync(DIR).filter((n) => n.endsWith('.tsx'))) {
  const p = join(DIR, f);
  const before = readFileSync(p, 'utf8');
  const after = before
    .replace(/from ["']cn["']/g, 'from "@/lib/utils"')
    .replace(dark, '$1')
    .replace(colour, '$1-sc-$2')
    // Tidy the gaps left inside class strings where `dark:` classes were.
    .replace(/(["'`])([^"'`\n]*)\1/g, (m, q, body) => (/ {2,}/.test(body) ? q + body.replace(/ {2,}/g, ' ').trim() + q : m));
  if (after !== before) { writeFileSync(p, after); console.log('scoped', f); }
}
