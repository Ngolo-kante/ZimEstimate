import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { isIdentity, preparePlanImage, toSourceBox, toSourcePoint, type PlanTransform } from './planImage';

/** A simple plan: walls and room lines on a background of the given grey. */
function planSvg(width: number, height: number, paper: string) {
  const lines = Array.from({ length: 6 }, (_, i) => `<rect x="80" y="${120 + i * 90}" width="${width - 160}" height="8" fill="#111"/>`).join('');
  const walls = `<rect x="80" y="120" width="8" height="458" fill="#111"/><rect x="${width - 88}" y="120" width="8" height="458" fill="#111"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${paper}"/>${lines}${walls}</svg>`);
}

describe('preparing an uploaded plan', () => {
  it('leaves a clean drawn plan as it is, apart from size', async () => {
    const png = await sharp(planSvg(1400, 800, '#ffffff')).png().toBuffer();
    const prepared = await preparePlanImage(png);
    expect(prepared.steps).toEqual([]);
    expect(isIdentity(prepared.transform)).toBe(true);
  });

  it('crops a phone screenshot to the plan', async () => {
    const plan = await sharp(planSvg(1000, 700, '#ffffff')).png().toBuffer();
    const screenshot = await sharp({ create: { width: 1000, height: 2100, channels: 3, background: '#000000' } })
      .composite([{ input: plan, top: 700, left: 0 }]).png().toBuffer();
    const prepared = await preparePlanImage(screenshot);
    expect(prepared.steps).toContain('cropped');
    const { crop } = prepared.transform;
    expect(crop.top).toBeGreaterThan(600);
    expect(crop.top + crop.height).toBeLessThan(1500);
  });

  it('straightens and evens out a photo of a printed plan', async () => {
    const photo = await sharp(planSvg(1000, 700, '#c8c8c8')).rotate(4, { background: '#c0c0c0' }).jpeg().toBuffer();
    const prepared = await preparePlanImage(photo);
    expect(prepared.steps).toContain('evened light');
    expect(prepared.transform.angle).toBeGreaterThan(-4.5);
    expect(prepared.transform.angle).toBeLessThan(-3.5);
  });

  it('enlarges a tiny image for the label reader', async () => {
    const png = await sharp(planSvg(1000, 700, '#ffffff')).resize({ width: 300 }).png().toBuffer();
    const prepared = await preparePlanImage(png);
    expect(prepared.steps).toEqual(['enlarged']);
    expect(prepared.width).toBe(1200);
  });
});

describe('putting positions back on the uploaded image', () => {
  const t: PlanTransform = { source: { width: 1000, height: 800 }, crop: { left: 100, top: 50, width: 800, height: 600 }, angle: 5, out: { width: 1200, height: 900 } };

  /** Where a source point lands on the prepared image, the way sharp turns it. */
  function forward(x: number, y: number) {
    const r = (t.angle * Math.PI) / 180;
    const w = Math.abs(t.crop.width * Math.cos(r)) + Math.abs(t.crop.height * Math.sin(r));
    const h = Math.abs(t.crop.width * Math.sin(r)) + Math.abs(t.crop.height * Math.cos(r));
    const px = x - t.crop.left - t.crop.width / 2;
    const py = y - t.crop.top - t.crop.height / 2;
    return { x: ((px * Math.cos(r) - py * Math.sin(r) + w / 2) / w) * 100, y: ((px * Math.sin(r) + py * Math.cos(r) + h / 2) / h) * 100 };
  }

  it('undoes the crop and the turn', () => {
    for (const [x, y] of [[100, 50], [500, 400], [880, 610]]) {
      const back = toSourcePoint(forward(x, y), t);
      expect(back.x).toBeCloseTo((x / 1000) * 100, 6);
      expect(back.y).toBeCloseTo((y / 800) * 100, 6);
    }
  });

  it('keeps a box centred on the same spot, and an unplaced box unplaced', () => {
    const centre = forward(500, 400);
    const box = toSourceBox({ x: centre.x - 5, y: centre.y - 5, width: 10, height: 10 }, t);
    expect(box.x + box.width / 2).toBeCloseTo(50, 6);
    expect(box.y + box.height / 2).toBeCloseTo(50, 6);
    expect(toSourceBox({ x: 0, y: 0, width: 0, height: 0 }, t)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
