/**
 * Assembles the recorded clips into one 9:16 social cut.
 *
 * Playwright records .webm at the viewport size (540x960). This upscales each
 * clip 2x to 1080x1920 with lanczos, trims the dead time — chiefly the real
 * Gemini wait in the Plan-to-BOQ scene, which is honest to leave in the
 * recording but pointless to leave in the video — and concatenates the result
 * to an h264 .mp4 that WhatsApp, Instagram and YouTube all accept.
 *
 * Audio is muxed only if a voiceover file is present, so this can be run now to
 * preview the visuals and re-run later once the Shona VO is recorded.
 *
 *   node scripts/build-demo.mjs [--vo output/demo-assets/vo.m4a]
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const args = process.argv.slice(2);
const argOf = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : d;
};

const RAW = path.resolve('output/demo-raw');
const WORK = path.resolve('output/demo-work');
const OUT = path.resolve('output/demo-videos');
const VO = argOf('vo', null);

const exists = async (p) => access(p).then(() => true).catch(() => false);

async function duration(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ]);
  return parseFloat(stdout.trim());
}

/**
 * Per-scene trim. `head` drops the blank first moments while the page paints;
 * `tailKeep` caps how much of the end is used. The Plan-to-BOQ scene keeps only
 * its last stretch, because everything before it is the analysis spinner.
 */
const PLAN = [
  { id: '01-budget', head: 0.8, tailKeep: 11 },
  { id: '02-plan-to-boq', head: 0.5, tailKeep: 9, fromEnd: true },
  { id: '03-directory', head: 0.8, tailKeep: 9 },
  { id: '04-quick-projects', head: 0.8, tailKeep: 6 },
];

await mkdir(WORK, { recursive: true });
await mkdir(OUT, { recursive: true });

const available = (await readdir(RAW)).filter((f) => f.endsWith('.webm'));
const parts = [];

for (const scene of PLAN) {
  const src = path.join(RAW, `${scene.id}.webm`);
  if (!(await exists(src))) {
    console.log(`  skip ${scene.id} (not recorded)`);
    continue;
  }

  const total = await duration(src);
  // Take the tail for scenes whose payoff is at the end, the head otherwise.
  const start = scene.fromEnd
    ? Math.max(scene.head, total - scene.tailKeep)
    : scene.head;
  const len = Math.min(scene.tailKeep, Math.max(0.5, total - start));

  const dst = path.join(WORK, `${scene.id}.mp4`);
  await run('ffmpeg', [
    '-y', '-v', 'error',
    '-ss', String(start), '-t', String(len), '-i', src,
    '-vf', 'scale=1080:1920:flags=lanczos,fps=30,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-an', dst,
  ]);
  parts.push(dst);
  console.log(`  ${scene.id}: ${total.toFixed(1)}s -> ${len.toFixed(1)}s`);
}

if (parts.length === 0) {
  console.error('No clips found in output/demo-raw. Run scripts/record-demo.mjs first.');
  process.exit(1);
}

const listFile = path.join(WORK, 'concat.txt');
await writeFile(listFile, parts.map((p) => `file '${p}'`).join('\n'));

const silent = path.join(WORK, 'demo-silent.mp4');
await run('ffmpeg', [
  '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
  '-c', 'copy', silent,
]);

const finalPath = path.join(OUT, 'zimestimate-demo-shona.mp4');

if (VO && (await exists(VO))) {
  // -shortest so a slightly long VO take cannot leave a black tail on the end.
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', silent, '-i', VO,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', finalPath,
  ]);
  console.log(`\n  voiceover muxed from ${VO}`);
} else {
  await run('ffmpeg', ['-y', '-v', 'error', '-i', silent, '-c', 'copy', finalPath]);
  console.log('\n  no voiceover supplied — silent cut written');
  console.log('  re-run with --vo output/demo-assets/<your-file>.m4a to add it');
}

const finalDur = await duration(finalPath);
console.log(`  ${finalPath}`);
console.log(`  ${finalDur.toFixed(1)}s, 1080x1920, from ${parts.length} scene(s)`);
console.log(`  (raw clips available: ${available.length})`);
