import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = process.env.SCRAPE_OUTPUT_DIR
  ? path.resolve(process.env.SCRAPE_OUTPUT_DIR)
  : path.join(ROOT_DIR, 'output', 'prices');
const SOURCES_FILE = process.env.PRICE_SOURCES_FILE
  ? path.resolve(process.env.PRICE_SOURCES_FILE)
  : path.join(__dirname, 'sources.json');
const ALIASES_FILE = path.join(__dirname, 'material-aliases.json');
const DRY_RUN = process.env.DRY_RUN === '1';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value) =>
  value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 .-]/g, '')
    .trim();

const parsePrice = (value) => {
  if (!value) return { price: null, currency: null };
  const raw = value.replace(/,/g, '');
  const match = raw.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return { price: null, currency: null };
  const price = Number(match[1]);
  const upper = raw.toUpperCase();
  let currency = null;
  if (upper.includes('USD') || upper.includes('$')) currency = 'USD';
  if (upper.includes('ZWG') || upper.includes('ZWL') || upper.includes('ZIG')) currency = 'ZWG';
  return { price, currency };
};

const isPriceLine = (line) => /\b(?:US\\$|\\$|USD|ZWG|ZWL|ZIG)\\s*[0-9]/i.test(line);

const normalizeLine = (line) => line.replace(/\\s+/g, ' ').trim();

const DEFAULT_NOISE_PATTERNS = [
  /login|register|post|submit an advert|menu|search|sort|filter|categories|select state|select city|all cities/i,
  /home|classified|category list|clear all filters|grid view|list view|add to favorites|email alert/i,
  /previous|next|first|last|back to top|save [0-9]+%/i,
  /^by$/i,
  /^for sale$/i,
  /^negotiable$/i,
  /^location\\s*:?$/i,
  /^phone\\s*:?/i,
];

const isTitleCandidate = (line) => {
  if (!line) return false;
  if (isPriceLine(line)) return false;
  if (line.length < 3 || line.length > 120) return false;
  if (/^(by|location|phone|email|price|usd|zwg|zig)/i.test(line)) return false;
  if (/^\\d+$/.test(line)) return false;
  return true;
};

const extractLocation = (line) => {
  const cleaned = normalizeLine(line);
  const match = cleaned.match(/location\\s*:\\s*(.+)$/i);
  if (match) return match[1].trim();
  if (/(harare|bulawayo|gweru|mutare|masvingo|kwekwe|bindura|kadoma|chinhoyi|ruwa|norton|chegutu)/i.test(cleaned)) {
    return cleaned;
  }
  return null;
};

const extractSupplier = (line) => {
  const cleaned = normalizeLine(line);
  const match = cleaned.match(/^by\\s+(.+)$/i);
  if (match) return match[1].trim();
  return null;
};

const parseTextListings = (html, source) => {
  const $ = cheerio.load(html);
  const text = $('body').text();
  const rawLines = text.split(/\\r?\\n/).map((line) => normalizeLine(line)).filter(Boolean);
  const ignorePatterns = [
    ...DEFAULT_NOISE_PATTERNS,
    ...(source.ignorePatterns || []).map((pattern) => new RegExp(pattern, 'i')),
  ];

  const items = [];
  const seen = new Set();

  for (let i = 0; i < rawLines.length; i += 1) {
    const line = rawLines[i];
    if (ignorePatterns.some((pattern) => pattern.test(line))) continue;

    if (!isPriceLine(line)) continue;

    const { price } = parsePrice(line);
    if (!price) continue;

    let title = null;
    for (let j = i - 1; j >= 0 && j >= i - 8; j -= 1) {
      const candidate = rawLines[j];
      if (ignorePatterns.some((pattern) => pattern.test(candidate))) continue;
      if (isTitleCandidate(candidate)) {
        title = candidate;
        break;
      }
    }

    if (!title) continue;

    let location = null;
    let supplier = null;
    for (let j = i + 1; j < rawLines.length && j <= i + 8; j += 1) {
      if (!location) location = extractLocation(rawLines[j]);
      if (!supplier) supplier = extractSupplier(rawLines[j]);
      if (location && supplier) break;
    }

    const key = `${title}|${line}|${location || ''}|${supplier || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      name: title,
      price: line,
      unit: null,
      location,
      supplier,
      url: null,
    });
  }

  return items;
};

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

const matchMaterialKey = (name, aliases) => {
  if (!name) return null;
  const normalized = normalizeText(name);
  if (aliases[normalized]) return aliases[normalized];
  const entries = Object.entries(aliases)
    .map(([alias, key]) => ({ alias, key }))
    .sort((a, b) => b.alias.length - a.alias.length);
  const match = entries.find((entry) => normalized.includes(entry.alias));
  return match ? match.key : null;
};

const chunk = (items, size) => {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const weekStartISO = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
  }
  return Number(sorted[mid].toFixed(2));
};

const avg = (values) => {
  if (!values.length) return null;
  const total = values.reduce((sum, v) => sum + v, 0);
  return Number((total / values.length).toFixed(2));
};

const min = (values) => (values.length ? Math.min(...values) : null);
const max = (values) => (values.length ? Math.max(...values) : null);

const ensureOutputDir = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
};

const loadAliases = async () => {
  const raw = await fs.readFile(ALIASES_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const normalized = {};
  Object.entries(parsed).forEach(([alias, key]) => {
    normalized[normalizeText(alias)] = key;
  });
  return normalized;
};

const loadSources = async () => {
  if (fsSync.existsSync(SOURCES_FILE)) {
    const raw = await fs.readFile(SOURCES_FILE, 'utf8');
    return JSON.parse(raw);
  }

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const sources = await supabaseFetch('price_sources?select=*\&is_active=eq.true');
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      sourceType: source.source_type,
      url: source.base_url,
      parser: source.parser || 'listing-card',
      selectors: source.selectors || {},
      headers: source.headers || {},
      isActive: source.is_active,
      trustLevel: source.trust_level,
    }));
  }

  return [];
};

const supabaseFetch = async (endpoint, options = {}) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
};

const fetchLatestExchangeRate = async () => {
  try {
    const rows = await supabaseFetch('exchange_rates?select=usd_to_zwg\&order=date.desc\&limit=1');
    if (!rows || rows.length === 0) return null;
    return Number(rows[0].usd_to_zwg);
  } catch (error) {
    console.warn('Exchange rate fetch failed. Continuing without conversion.', error);
    return null;
  }
};

const parseSourceHtml = (source, html) => {
  const $ = cheerio.load(html);
  if (source.parser === 'text-list') {
    return parseTextListings(html, source);
  }
  if (source.parser === 'table') {
    const rows = [];
    $(source.selectors?.row || 'table tr').each((_, row) => {
      const name = $(row).find(source.selectors?.name || 'td:nth-child(1)').text().trim();
      const unit = $(row).find(source.selectors?.unit || 'td:nth-child(2)').text().trim();
      const price = $(row).find(source.selectors?.price || 'td:nth-child(3)').text().trim();
      if (!name || !price) return;
      rows.push({ name, unit, price });
    });
    return rows;
  }

  const items = [];
  const itemSelector = source.selectors?.item || '.listing';
  $(itemSelector).each((_, el) => {
    const name = $(el).find(source.selectors?.name || '.title').text().trim();
    const price = $(el).find(source.selectors?.price || '.price').text().trim();
    const unit = $(el).find(source.selectors?.unit || '.unit').text().trim();
    const location = $(el).find(source.selectors?.location || '.location').text().trim();
    const supplier = $(el).find(source.selectors?.supplier || '.seller').text().trim();
    const url = $(el).find(source.selectors?.url || 'a').attr('href');
    if (!name || !price) return;
    items.push({ name, unit, price, location, supplier, url });
  });
  return items;
};

const scrapeSource = async (source) => {
  if (!source?.url) return [];
  const primaryHeaders = { ...DEFAULT_HEADERS, ...(source.headers || {}) };
  const response = await fetch(source.url, {
    headers: primaryHeaders,
    redirect: 'follow',
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) {
      const redirectUrl = location.startsWith('http') ? location : new URL(location, source.url).toString();
      const redirected = await fetch(redirectUrl, { headers: primaryHeaders, redirect: 'follow' });
      if (!redirected.ok) {
        console.warn(`Failed to fetch ${redirectUrl}: ${redirected.status}`);
        return [];
      }
      const html = await redirected.text();
      return parseSourceHtml({ ...source, url: redirectUrl }, html);
    }
  }

  if (response.status === 403) {
    const retryHeaders = {
      ...primaryHeaders,
      Referer: source.url,
      'Upgrade-Insecure-Requests': '1',
    };
    const retry = await fetch(source.url, { headers: retryHeaders, redirect: 'follow' });
    if (!retry.ok) {
      console.warn(`Failed to fetch ${source.url}: ${retry.status}`);
      return [];
    }
    const html = await retry.text();
    return parseSourceHtml(source, html);
  }

  if (!response.ok) {
    console.warn(`Failed to fetch ${source.url}: ${response.status}`);
    return [];
  }

  const html = await response.text();
  return parseSourceHtml(source, html);
};

const buildObservation = ({ source, item, aliases, exchangeRate, scrapedAt }) => {
  const materialKey = matchMaterialKey(item.name, aliases);
  if (!materialKey) return null;

  const { price, currency } = parsePrice(item.price);
  if (!price) return null;

  let priceUsd = null;
  let priceZwg = null;
  if (currency === 'USD') {
    priceUsd = price;
    if (exchangeRate) priceZwg = Number((price * exchangeRate).toFixed(2));
  } else if (currency === 'ZWG') {
    priceZwg = price;
    if (exchangeRate) priceUsd = Number((price / exchangeRate).toFixed(2));
  }

  const safeUrl = item.url && item.url.startsWith('http') ? item.url : null;
  const cleanLocation = item.location
    ? normalizeLine(item.location.replace(/^Location\\s*:\\s*/i, ''))
    : null;
  const cleanSupplier = item.supplier
    ? normalizeLine(item.supplier.replace(/^By\\s*/i, ''))
    : null;
  const sourceId = isUuid(source.id) ? source.id : null;

  return {
    source_id: sourceId,
    source_name: source.name || source.id || null,
    material_key: materialKey,
    material_name: item.name || null,
    unit: item.unit || null,
    price_original: price,
    currency: currency || null,
    price_usd: priceUsd,
    price_zwg: priceZwg,
    location: cleanLocation,
    supplier_name: cleanSupplier,
    supplier_contact: null,
    url: safeUrl,
    confidence: source.trustLevel || 2,
    scraped_at: scrapedAt,
    observed_at: null,
  };
};

const computeWeekly = (observations) => {
  const groups = new Map();

  observations.forEach((obs) => {
    const weekStart = weekStartISO(obs.scraped_at);
    const key = `${obs.material_key}::${weekStart}`;
    if (!groups.has(key)) {
      groups.set(key, {
        material_key: obs.material_key,
        week_start: weekStart,
        price_usd: [],
        price_zwg: [],
        last_scraped_at: obs.scraped_at,
      });
    }
    const entry = groups.get(key);
    if (obs.price_usd != null) entry.price_usd.push(obs.price_usd);
    if (obs.price_zwg != null) entry.price_zwg.push(obs.price_zwg);
    if (new Date(obs.scraped_at) > new Date(entry.last_scraped_at)) {
      entry.last_scraped_at = obs.scraped_at;
    }
  });

  return Array.from(groups.values()).map((entry) => ({
    material_key: entry.material_key,
    week_start: entry.week_start,
    avg_price_usd: avg(entry.price_usd),
    avg_price_zwg: avg(entry.price_zwg),
    median_price_usd: median(entry.price_usd),
    median_price_zwg: median(entry.price_zwg),
    min_price_usd: min(entry.price_usd),
    max_price_usd: max(entry.price_usd),
    min_price_zwg: min(entry.price_zwg),
    max_price_zwg: max(entry.price_zwg),
    sample_count: Math.max(entry.price_usd.length, entry.price_zwg.length),
    last_scraped_at: entry.last_scraped_at,
  }));
};

const writeOutput = async (filename, payload) => {
  await ensureOutputDir();
  const filePath = path.join(OUTPUT_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
  return filePath;
};

const insertObservations = async (observations) => {
  const chunks = chunk(observations, 500);
  for (const batch of chunks) {
    await supabaseFetch('price_observations', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(batch),
    });
    await sleep(250);
  }
};

const upsertWeekly = async (weekly) => {
  const chunks = chunk(weekly, 500);
  for (const batch of chunks) {
    await supabaseFetch('price_weekly?on_conflict=material_key,week_start', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    });
    await sleep(250);
  }
};

const run = async () => {
  const aliases = await loadAliases();
  const sources = await loadSources();

  if (!sources.length) {
    console.warn('No sources configured. Add scripts/pricing/sources.json or seed price_sources.');
    return;
  }

  const exchangeRate = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? await fetchLatestExchangeRate()
    : null;
  const scrapedAt = new Date().toISOString();

  const observations = [];
  const unmatched = [];

  for (const source of sources) {
    if (source.isActive === false) continue;
    console.log(`Scraping ${source.name} (${source.url})`);
    const items = await scrapeSource(source);
    items.forEach((item) => {
      const materialKey = matchMaterialKey(item.name, aliases);
      if (!materialKey) {
        unmatched.push({ source: source.name, name: item.name, price: item.price });
        return;
      }
      const observation = buildObservation({ source, item, aliases, exchangeRate, scrapedAt });
      if (observation) observations.push(observation);
    });
    await sleep(500);
  }

  await writeOutput('observations.json', observations);
  await writeOutput('unmatched.json', unmatched);

  const weekly = computeWeekly(observations);
  await writeOutput('weekly.json', weekly);

  console.log(`Scraped ${observations.length} observations (${unmatched.length} unmatched).`);

  if (!DRY_RUN) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for Supabase writes.');
    }
    await insertObservations(observations);
    await upsertWeekly(weekly);
    console.log('Supabase updated successfully.');
  } else {
    console.log('DRY_RUN enabled. Skipping Supabase writes.');
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
