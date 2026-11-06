#!/usr/bin/env node
// TEMPORARY: collects files uploaded through /admin/transfer into
// ~/Documents/TM Data, then removes them from the private tm-transfer bucket.
// Run: node scripts/tm-transfer-download.mjs   (Ctrl+C to stop)

import { readFileSync, mkdirSync, existsSync, createWriteStream, renameSync, statSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, extname, basename } from 'node:path';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((line) => /^[A-Z0-9_]+=/.test(line))
  .map((line) => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^["']|["']$/g, '')]; }));
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'tm-transfer';
const TARGET = join(homedir(), 'Documents', 'TM Data');
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function list(prefix) {
  const response = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!response.ok) throw new Error(`list ${prefix}: ${response.status} ${await response.text()}`);
  return (await response.json()).filter((entry) => entry.id);
}

async function download(path) {
  const response = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${path}`, { headers });
  if (!response.ok) throw new Error(`download ${path}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function remove(paths) {
  for (let i = 0; i < paths.length; i += 100) {
    const response = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: paths.slice(i, i + 100) }),
    });
    if (!response.ok) throw new Error(`delete: ${response.status} ${await response.text()}`);
  }
}

/** Never overwrite: "report.pdf" becomes "report (2).pdf". */
function freePath(path) {
  if (!existsSync(path)) return path;
  const ext = extname(path), stem = basename(path, ext), dir = dirname(path);
  for (let n = 2; ; n++) { const next = join(dir, `${stem} (${n})${ext}`); if (!existsSync(next)) return next; }
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function collect(manifestName) {
  const manifest = JSON.parse((await download(`manifests/${manifestName}`)).toString('utf8'));
  const { id, name, size, parts } = manifest;
  const pieces = await list(`parts/${id}/`);
  if (pieces.length < parts) return false; // still arriving
  const finalPath = freePath(join(TARGET, ...name.split('/')));
  mkdirSync(dirname(finalPath), { recursive: true });
  const partial = `${finalPath}.partial`;
  const out = createWriteStream(partial);
  for (let part = 0; part < parts; part++) {
    const piece = await download(`parts/${id}/${String(part).padStart(5, '0')}`);
    if (!out.write(piece)) await new Promise((resolve) => out.once('drain', resolve));
  }
  await new Promise((resolve, reject) => { out.end(resolve); out.on('error', reject); });
  const got = statSync(partial).size;
  if (got !== size) { unlinkSync(partial); throw new Error(`${name}: expected ${size} bytes, got ${got}; will retry`); }
  renameSync(partial, finalPath);
  await remove([...pieces.map((piece) => `parts/${id}/${piece.name}`), `manifests/${manifestName}`]);
  console.log(`${new Date().toLocaleTimeString()}  saved  ${finalPath.replace(TARGET + '/', '')}  (${mb(size)})`);
  return true;
}

mkdirSync(TARGET, { recursive: true });
console.log(`Watching for uploads; saving to ${TARGET}`);
let saved = 0;
for (;;) {
  try {
    const manifests = (await list('manifests/')).filter((entry) => entry.name.endsWith('.json'));
    for (const manifest of manifests) {
      try { if (await collect(manifest.name)) saved++; }
      catch (error) { console.error(`${new Date().toLocaleTimeString()}  retry  ${error.message}`); }
    }
  } catch (error) {
    console.error(`${new Date().toLocaleTimeString()}  ${error.message}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}
