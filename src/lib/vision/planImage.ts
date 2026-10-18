// ─── Making an uploaded plan easier to read ──────────────────────────────────
// What people upload, from the plan samples (week to 2026-10-17): phone
// screenshots of a plan with black bars and the phone's own buttons around
// it, images as small as 251 px wide, and — tested, not yet seen — photos of
// printed plans, slightly turned and in uneven light. Each gets one fix:
//
//   • cropped to the plan when a third or more of the picture is not paper;
//   • turned straight when the drawing's lines lean (photos);
//   • for photos only, evened-out light and contrast. On the benchmark photo
//     this fixed a misread veranda; black-and-white thresholding did not help.
//   • small images enlarged, so the label reader has letters to work with.
//
// The room boxes the readers return are positions on the prepared image;
// toSourceBox / toSourcePoint put them back on the uploaded one, which is
// what the person sees in the editor.

import sharp from 'sharp';

export interface PlanTransform {
  /** The uploaded image, after its camera orientation is applied. */
  source: { width: number; height: number };
  /** The part of the source kept, in source pixels. */
  crop: { left: number; top: number; width: number; height: number };
  /** Degrees turned clockwise, as passed to sharp. */
  angle: number;
  /** The prepared image. */
  out: { width: number; height: number };
}

export interface PreparedPlan {
  buffer: Buffer;
  width: number;
  height: number;
  /** What was done, for the logs; empty when the image needed nothing. */
  steps: string[];
  transform: PlanTransform;
}

const MEASURE_SIDE = 800;
const MAX_SIDE = 2_000;
const MIN_SIDE = 1_200;

type Gray = { data: Uint8Array | Buffer; width: number; height: number };

/**
 * The longest stretch of rows (or columns) that are mostly light — the
 * paper — bridging the short dark stretches that a thick wall makes.
 */
function paperSpan(fractions: number[], minLight: number, bridge: number): [number, number] {
  let best: [number, number] = [0, fractions.length];
  let bestLength = -1;
  let start = -1;
  let gap = 0;
  for (let i = 0; i <= fractions.length; i++) {
    const light = i < fractions.length && fractions[i] >= minLight;
    if (light) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap > bridge || i === fractions.length) {
        const end = i - gap + 1;
        if (end - start > bestLength) { bestLength = end - start; best = [start, end]; }
        start = -1;
        gap = 0;
      }
    }
  }
  return best;
}

/** The paper's box in the measuring image, or null when it is (nearly) all paper. */
export function findPaper({ data, width, height }: Gray): { left: number; top: number; width: number; height: number } | null {
  // "Light" relative to the brightest paper in the picture: a photo's paper
  // is grey and darker towards the edges, and must not be cut off as border.
  const sorted = Uint8Array.from(data).sort();
  const LIGHT = Math.min(160, sorted[Math.floor(sorted.length * 0.9)] * 0.7);
  const rowLight = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (data[y * width + x] > LIGHT) n++;
    rowLight[y] = n / width;
  }
  const [top, bottom] = paperSpan(rowLight, 0.35, Math.max(3, Math.round(height * 0.03)));
  const colLight = new Array<number>(width).fill(0);
  for (let x = 0; x < width; x++) {
    let n = 0;
    for (let y = top; y < bottom; y++) if (data[y * width + x] > LIGHT) n++;
    colLight[x] = n / Math.max(1, bottom - top);
  }
  const [left, right] = paperSpan(colLight, 0.35, Math.max(3, Math.round(width * 0.03)));
  const area = (right - left) * (bottom - top);
  // Too small to be the plan, or too little cut to be worth it.
  if (area < width * height * 0.15 || area > width * height * 0.9) return null;
  const marginX = Math.round(width * 0.01);
  const marginY = Math.round(height * 0.01);
  const x0 = Math.max(0, left - marginX);
  const y0 = Math.max(0, top - marginY);
  return { left: x0, top: y0, width: Math.min(width, right + marginX) - x0, height: Math.min(height, bottom + marginY) - y0 };
}

/**
 * How far the drawing leans, in degrees (clockwise to straighten). The rows
 * of a plan's walls and text line up sharpest when it is straight, so the
 * angle that gives the spikiest row profile of the dark pixels wins.
 * Returns 0 unless the lean is clear.
 */
export function findSkew({ data, width, height }: Gray): number {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[y * width + x] < 110) { xs.push(x - width / 2); ys.push(y - height / 2); }
    }
  }
  if (xs.length < 500) return 0;
  const diagonal = Math.ceil(Math.hypot(width, height));
  const bins = new Float64Array(diagonal + 2);
  const score = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    const sin = Math.sin(radians);
    const cos = Math.cos(radians);
    bins.fill(0);
    for (let i = 0; i < xs.length; i++) bins[Math.round(xs[i] * sin + ys[i] * cos + diagonal / 2)]++;
    let sum = 0;
    for (let i = 0; i < bins.length; i++) sum += bins[i] * bins[i];
    return sum;
  };
  let best = 0;
  let bestScore = score(0);
  const straight = bestScore;
  for (let a = -10; a <= 10; a += 0.25) {
    if (a === 0) continue;
    const s = score(a);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  // A drawn plan scores best at 0. Small or doubtful leans are left alone.
  if (Math.abs(best) < 0.75 || bestScore < straight * 1.15) return 0;
  // The profile above turns the points clockwise by a (y runs down), the
  // same way sharp's rotate(a) turns the image.
  return best;
}

/** A photo of paper has no true white: the brightest pixels are the lit paper. */
export function looksLikePhoto({ data }: Gray): boolean {
  const histogram = new Array<number>(256).fill(0);
  for (const v of data) histogram[v]++;
  let count = 0;
  for (let v = 0; v < 256; v++) {
    count += histogram[v];
    if (count >= data.length * 0.99) return v < 240;
  }
  return false;
}

async function measure(image: Buffer): Promise<Gray & { scale: number }> {
  const meta = await sharp(image).metadata();
  const scale = Math.min(1, MEASURE_SIDE / Math.max(meta.width ?? 1, meta.height ?? 1));
  const { data, info } = await sharp(image)
    .resize({ width: Math.max(1, Math.round((meta.width ?? 1) * scale)) })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, scale };
}

export async function preparePlanImage(input: ArrayBuffer | Buffer): Promise<PreparedPlan> {
  const steps: string[] = [];
  // Camera orientation applied and transparency on white: the "source" the
  // person sees, and every later position is relative to it.
  const { data: base, info } = await sharp(Buffer.from(input as ArrayBuffer))
    .rotate()
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 1 })
    .toBuffer({ resolveWithObject: true });
  const source = { width: info.width, height: info.height };

  let image = base;
  let crop = { left: 0, top: 0, width: source.width, height: source.height };
  const first = await measure(image);
  const paper = findPaper(first);
  if (paper) {
    crop = {
      left: Math.floor(paper.left / first.scale),
      top: Math.floor(paper.top / first.scale),
      width: Math.min(source.width, Math.ceil(paper.width / first.scale)),
      height: Math.min(source.height, Math.ceil(paper.height / first.scale)),
    };
    crop.width = Math.min(crop.width, source.width - crop.left);
    crop.height = Math.min(crop.height, source.height - crop.top);
    image = await sharp(image).extract(crop).png({ compressionLevel: 1 }).toBuffer();
    steps.push('cropped');
  }

  const cropped = paper ? await measure(image) : first;
  const photo = looksLikePhoto(cropped);
  // Only photos lean; a drawn plan is straight by construction, and a page
  // of slanted text or a diagonal wall must not be "corrected".
  const angle = photo ? findSkew(cropped) : 0;
  let rotated = { width: crop.width, height: crop.height };
  if (angle !== 0) {
    const turned = await sharp(image).rotate(angle, { background: '#ffffff' }).png({ compressionLevel: 1 }).toBuffer({ resolveWithObject: true });
    image = turned.data;
    rotated = { width: turned.info.width, height: turned.info.height };
    steps.push(`straightened ${angle.toFixed(2)}°`);
  }

  let pipeline = sharp(image);
  if (photo) {
    pipeline = pipeline.grayscale().normalise().clahe({ width: 64, height: 64, maxSlope: 3 }).sharpen({ sigma: 1 });
    steps.push('evened light');
  }
  const longest = Math.max(rotated.width, rotated.height);
  const scale = longest > MAX_SIDE ? MAX_SIDE / longest : longest < MIN_SIDE ? MIN_SIDE / longest : 1;
  if (scale !== 1) {
    pipeline = pipeline.resize({ width: Math.round(rotated.width * scale), kernel: 'lanczos3' });
    if (scale > 1) steps.push('enlarged');
  }
  const { data, info: outInfo } = await pipeline.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    width: outInfo.width,
    height: outInfo.height,
    steps,
    transform: { source, crop, angle, out: { width: outInfo.width, height: outInfo.height } },
  };
}

/** A point on the prepared image (percent) as a point on the uploaded one (percent). */
export function toSourcePoint(point: { x: number; y: number }, t: PlanTransform): { x: number; y: number } {
  const radians = (t.angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // The turned canvas grows to fit the turned crop.
  const turnedWidth = Math.abs(t.crop.width * cos) + Math.abs(t.crop.height * sin);
  const turnedHeight = Math.abs(t.crop.width * sin) + Math.abs(t.crop.height * cos);
  const px = (point.x / 100) * turnedWidth - turnedWidth / 2;
  const py = (point.y / 100) * turnedHeight - turnedHeight / 2;
  // Undo a clockwise turn (y down) by turning anticlockwise.
  const x = px * cos + py * sin + t.crop.width / 2 + t.crop.left;
  const y = -px * sin + py * cos + t.crop.height / 2 + t.crop.top;
  return { x: (x / t.source.width) * 100, y: (y / t.source.height) * 100 };
}

/** A room box on the prepared image (percent) as a box on the uploaded one (percent). */
export function toSourceBox(box: { x: number; y: number; width: number; height: number }, t: PlanTransform) {
  if (box.width <= 0 || box.height <= 0) return box;
  const centre = toSourcePoint({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, t);
  const radians = (t.angle * Math.PI) / 180;
  const turnedWidth = Math.abs(t.crop.width * Math.cos(radians)) + Math.abs(t.crop.height * Math.sin(radians));
  const turnedHeight = Math.abs(t.crop.width * Math.sin(radians)) + Math.abs(t.crop.height * Math.cos(radians));
  const width = (box.width / 100) * turnedWidth / t.source.width * 100;
  const height = (box.height / 100) * turnedHeight / t.source.height * 100;
  return { x: centre.x - width / 2, y: centre.y - height / 2, width, height };
}

export function isIdentity(t: PlanTransform): boolean {
  return t.angle === 0 && t.crop.left === 0 && t.crop.top === 0 && t.crop.width === t.source.width && t.crop.height === t.source.height;
}
