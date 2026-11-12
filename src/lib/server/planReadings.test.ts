import { describe, expect, it } from 'vitest';
import { PLAN_READING_KEEP_DAYS, planFingerprint, usableReading, worthRemembering } from './planReadings';
import type { VisionAnalysisResult } from '@/lib/vision/types';

const reading = (extra: Partial<VisionAnalysisResult> = {}): VisionAnalysisResult => ({
  rooms: [{ id: 'a', name: 'Lounge', dimensions: { width: 5, length: 4 }, area: 20, position: { x: 0, y: 0, width: 10, height: 10 }, wallType: 'internal', isEdited: false }],
  walls: [], totalArea: 20, doors: 1, windows: 1, confidence: 80, imageWidth: 100, imageHeight: 100,
  source: 'ai', reader: { provider: 'gemini', model: 'main' },
  ...extra,
});

const now = new Date('2026-11-12T10:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('remembering a plan reading', () => {
  it('gives the same fingerprint for the same bytes, and another for other bytes', () => {
    const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
    expect(planFingerprint(bytes('plan'))).toBe(planFingerprint(bytes('plan')));
    expect(planFingerprint(bytes('plan'))).not.toBe(planFingerprint(bytes('plan2')));
    expect(planFingerprint(bytes('plan'))).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives a kept reading again while it is within its time', () => {
    const data = reading();
    expect(usableReading({ readAt: daysAgo(1), data }, now)).toBe(data);
    expect(usableReading({ readAt: daysAgo(PLAN_READING_KEEP_DAYS + 1), data }, now)).toBeNull();
  });

  it('ignores anything that is not a reading with rooms', () => {
    expect(usableReading(null, now)).toBeNull();
    expect(usableReading({ readAt: 'not a date', data: reading() }, now)).toBeNull();
    expect(usableReading({ readAt: daysAgo(-1), data: reading() }, now)).toBeNull();
    expect(usableReading({ readAt: daysAgo(1), data: reading({ rooms: [] }) }, now)).toBeNull();
    expect(usableReading({ readAt: daysAgo(1) }, now)).toBeNull();
  });

  it('remembers only a full reading by the main reader', () => {
    expect(worthRemembering(reading(), 'main')).toBe(true);
    expect(worthRemembering(reading({ reader: { provider: 'gemini', model: 'backup' } }), 'main')).toBe(false);
    expect(worthRemembering(reading({ reader: { provider: 'nvidia', model: 'main' } }), 'main')).toBe(false);
    expect(worthRemembering(reading({ source: 'labels', reader: undefined }), 'main')).toBe(false);
    expect(worthRemembering(reading({ rooms: [] }), 'main')).toBe(false);
  });
});
