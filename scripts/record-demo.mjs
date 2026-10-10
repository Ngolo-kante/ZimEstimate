/**
 * Records the ZimEstimate demo clips in phone view.
 *
 * Runs against production rather than a local dev server, for three reasons:
 * the video then shows the product people actually visit; the CSRF origin
 * check passes without touching .env.local; and there is no dependency on
 * whichever dev server happens to be running.
 *
 * Everything is recorded signed out. That is deliberate — a signed-in
 * recording would put real builders' projects and real suppliers' details into
 * a video meant for sharing.
 *
 * Each scene gets its own browser context so Playwright writes one .webm per
 * scene, which lets each be trimmed independently before assembly.
 *
 *   node scripts/record-demo.mjs [--base https://zimestimate.com] [--only 2]
 */

import { chromium } from 'playwright';
import { mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf('base', 'https://zimestimate.com');
const ONLY = argOf('only', null);
const OUT = path.resolve('output/demo-raw');
const PLAN = path.resolve('output/demo-assets/demo-floor-plan.png');

/* Playwright does not scale the page up to recordVideo.size — asking for a
   1080x1920 video from a 414px viewport just parks the page in the corner of a
   grey 1080x1920 frame. So the video is recorded at the viewport size and
   upscaled during assembly instead.
 *
 * 540x960 is chosen for two reasons: it is exactly 9:16, so it matches WhatsApp
 * status and Reels with no letterboxing; and it is exactly half of 1080x1920,
 * so the upscale is a clean 2x rather than a blurry fractional one. It still
 * sits under the app's 640px mobile breakpoint, so what gets recorded is the
 * real phone layout, bottom tab bar and all. */
const VIEWPORT = { width: 540, height: 960 };
const VIDEO = { width: 540, height: 960 };

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Types like a person rather than pasting, so the demo reads as live. */
async function typeSlowly(locator, text, delay = 110) {
  await locator.click();
  await locator.fill('');
  await locator.pressSequentially(text, { delay });
}

const scenes = [
  {
    id: '01-budget',
    title: 'Budget reality check',
    async run(page) {
      await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
      await pause(2200);

      const budget = page.getByRole('textbox', { name: /Your budget in US dollars/ });
      await budget.scrollIntoViewIfNeeded();
      await pause(900);

      // Down to a partial build, then up to a full one — the house and the
      // stage bars move with each keystroke, which is the whole point.
      await typeSlowly(budget, '6000');
      await pause(2200);
      await typeSlowly(budget, '18000');
      await pause(2600);
    },
  },
  {
    id: '02-plan-to-boq',
    title: 'Plan to BOQ',
    async run(page) {
      await page.goto(`${BASE}/ai/vision-takeoff`, { waitUntil: 'networkidle' });
      await pause(1800);

      await page.setInputFiles('input[type=file]', PLAN);

      /* The analysis is a real Gemini call against production. Below a
         confidence threshold the wizard stops on a "Low Detection Confidence"
         screen rather than going straight to the editor, so the recording has
         to be able to take either path — waiting only for the canvas meant
         sitting through the full timeout on a plan that scored 85%. */
      const canvas = page.locator('canvas');
      const continueAnyway = page.getByRole('button', { name: /Continue Anyway/i });

      await Promise.race([
        canvas.waitFor({ timeout: 150_000 }),
        continueAnyway.waitFor({ timeout: 150_000 }),
      ]);

      if (await continueAnyway.isVisible().catch(() => false)) {
        await pause(1200);
        await continueAnyway.click();
        await canvas.waitFor({ timeout: 30_000 });
      }

      await pause(1500);
      await canvas.scrollIntoViewIfNeeded();
      await pause(4500);
    },
  },
  {
    id: '03-directory',
    title: 'Contractors and marketplace',
    async run(page) {
      await page.goto(`${BASE}/contractors`, { waitUntil: 'networkidle' });
      await pause(2400);
      await page.mouse.wheel(0, 500);
      await pause(2000);

      await page.goto(`${BASE}/marketplace`, { waitUntil: 'networkidle' });
      await pause(2400);
      await page.mouse.wheel(0, 600);
      await pause(2200);
    },
  },
  {
    id: '04-quick-projects',
    title: 'Quick projects',
    async run(page) {
      await page.goto(`${BASE}/quick-projects`, { waitUntil: 'networkidle' });
      await pause(2400);
      await page.mouse.wheel(0, 450);
      await pause(2400);
    },
  },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const selected = ONLY
  ? scenes.filter((scene, index) => String(index + 1) === ONLY || scene.id.startsWith(ONLY))
  : scenes;

if (selected.length === 0) {
  await browser.close();
  throw new Error(`Unknown scene: ${ONLY}. Choose a scene number from 1 to ${scenes.length}.`);
}

for (const scene of selected) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: OUT, size: VIDEO },
  });
  const page = await context.newPage();

  process.stdout.write(`  recording ${scene.id} — ${scene.title} … `);
  try {
    await scene.run(page);
    process.stdout.write('ok\n');
  } catch (error) {
    process.stdout.write(`FAILED: ${error.message}\n`);
  }

  const video = page.video();
  await context.close(); // video is only flushed on close
  if (video) {
    const src = await video.path();
    await rename(src, path.join(OUT, `${scene.id}.webm`));
  }
}

await browser.close();

const files = (await readdir(OUT)).filter((f) => f.endsWith('.webm')).sort();
console.log(`\n  ${files.length} clip(s) in ${OUT}`);
files.forEach((f) => console.log(`    ${f}`));
