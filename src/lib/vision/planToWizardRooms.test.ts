import { describe, expect, it } from 'vitest';
import { planToWizardRooms, roomTypeFromName } from './planToWizardRooms';
import type { VisionAnalysisResult, DetectedRoom } from './types';

/**
 * The BOQ wizard costs from one number — projectDetails.floorPlanSize — and
 * draws from detailedRooms. An uploaded plan is only genuinely wired in if it
 * produces both correctly, so these tests guard the mapping rather than the UI
 * around it.
 */

const room = (over: Partial<DetectedRoom> & { name: string }): DetectedRoom => ({
  id: over.id ?? over.name.toLowerCase().replace(/\s+/g, '-'),
  name: over.name,
  dimensions: over.dimensions ?? { width: 4, length: 3 },
  area: over.area ?? 12,
  position: over.position ?? { x: 0, y: 0, width: 25, height: 25 },
  wallType: over.wallType ?? 'internal',
  isEdited: false,
});

const analysis = (rooms: DetectedRoom[], over: Partial<VisionAnalysisResult> = {}): VisionAnalysisResult => ({
  rooms,
  walls: [],
  totalArea: over.totalArea ?? 0,
  doors: over.doors ?? 6,
  windows: over.windows ?? 9,
  confidence: over.confidence ?? 92,
  imageWidth: 1000,
  imageHeight: 1400,
  ...over,
});

describe('reading a plan into the wizard', () => {
  it('maps drawing names onto the wizard\'s own room types', () => {
    expect(roomTypeFromName('Master Bedroom')).toBe('bedrooms');
    expect(roomTypeFromName('BED 2')).toBe('bedrooms');
    expect(roomTypeFromName('En-suite')).toBe('bathrooms');
    expect(roomTypeFromName('WC')).toBe('bathrooms');
    expect(roomTypeFromName('Kitchen')).toBe('kitchen');
    expect(roomTypeFromName('Scullery')).toBe('pantry');
    expect(roomTypeFromName('Lounge')).toBe('livingRoom');
    expect(roomTypeFromName('Dinning Room')).toBe('diningRoom'); // misspelling seen on real plans
    expect(roomTypeFromName('Double Garage')).toBe('garage2');
    expect(roomTypeFromName('Carport')).toBe('garage1');
    expect(roomTypeFromName('Stoep')).toBe('veranda');
  });

  it('keeps the drawing\'s own label rather than the generic type name', () => {
    const { rooms } = planToWizardRooms(analysis([room({ name: 'Master Bedroom' })]));
    expect(rooms[0].label).toBe('Master Bedroom');
    expect(rooms[0].type).toBe('bedrooms');
  });

  it('falls back to a usable room for a name it does not recognise', () => {
    const { rooms } = planToWizardRooms(analysis([room({ name: 'Gym' })]));
    expect(rooms[0].label).toBe('Gym');
    expect(rooms[0].type).toBe('livingRoom');
    expect(rooms[0].length).toBeGreaterThan(0);
  });

  it('derives the area from the rooms it lists, not the model\'s own total', () => {
    // A model that contradicts itself: says 500m² while its rooms sum to 24.
    const result = planToWizardRooms(
      analysis(
        [
          room({ name: 'Lounge', dimensions: { width: 4, length: 3 } }),
          room({ name: 'Kitchen', dimensions: { width: 4, length: 3 } }),
        ],
        { totalArea: 500 },
      ),
    );
    expect(result.totalArea).toBe(24);
  });

  it('carries the plan-wide door and window totals through untouched', () => {
    const result = planToWizardRooms(analysis([room({ name: 'Lounge' })], { doors: 7, windows: 11 }));
    expect(result.doors).toBe(7);
    expect(result.windows).toBe(11);
    // Per-room counts are not invented from those totals.
    expect(result.rooms[0].doors).toBe(1);
    expect(result.rooms[0].windows).toBe(1);
  });

  it('places rooms using the plan extent implied by their own dimensions', () => {
    // A 4m room covering a quarter of the image implies a 16m-wide plan, so a
    // room starting at 50% should land at 8m across.
    const { rooms } = planToWizardRooms(
      analysis([
        room({
          name: 'Lounge',
          dimensions: { width: 4, length: 4 },
          position: { x: 50, y: 0, width: 25, height: 25 },
        }),
      ]),
    );
    expect(rooms[0].x).toBe(8 * 40); // 8 metres at PIXELS_PER_METER
  });

  it('keeps the drawing aspect ratio and imported room positions in the same canvas space', () => {
    const mapped = planToWizardRooms(analysis([
      room({ name: 'Lounge', dimensions: { width: 4, length: 4 }, position: { x: 50, y: 25, width: 25, height: 25 } }),
    ]));
    expect(mapped.planCanvasSize.height / mapped.planCanvasSize.width).toBeCloseTo(1.4, 2);
    expect(mapped.rooms[0].x).toBe(mapped.planCanvasSize.width * 0.5);
    expect(mapped.rooms[0].y).toBe(mapped.planCanvasSize.height * 0.25);
  });

  it('survives a plan whose rooms carry no usable positions', () => {
    const { rooms, totalArea } = planToWizardRooms(
      analysis([room({ name: 'Lounge', position: { x: 0, y: 0, width: 0, height: 0 } })]),
    );
    expect(Number.isFinite(rooms[0].x)).toBe(true);
    expect(Number.isFinite(rooms[0].y)).toBe(true);
    expect(totalArea).toBeGreaterThan(0);
  });

  it('returns nothing to cost when the plan yielded no rooms', () => {
    const result = planToWizardRooms(analysis([]));
    expect(result.rooms).toEqual([]);
    expect(result.totalArea).toBe(0);
  });
});
