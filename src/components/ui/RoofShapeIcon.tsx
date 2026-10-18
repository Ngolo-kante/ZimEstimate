// ─── Roof shapes, drawn as a house seen from the front corner ───────────────
// Matches RoofProfileIcon's size, so the two choices sit side by side.

import type { RoofShape } from '@/lib/calculations/roofingOptions';

const SHAPES: Record<RoofShape, string> = {
  // Four slopes: the ridge stops short of both ends.
  hipped: 'M4 16 L16 6 H32 L44 16 Z M8 16 V26 H40 V16',
  // Two slopes with a triangular gable end.
  gable: 'M6 16 L18 4 L30 16 Z M18 4 H42 L44 16 H30 M8 16 V26 H42 V16',
  // One slope, high at the back.
  lean_to: 'M4 12 L44 4 V8 L4 16 Z M8 15 V26 H40 V9',
};

export default function RoofShapeIcon({ shape, className = 'h-6 w-12' }: { shape: RoofShape; className?: string }) {
  return (
    <svg viewBox="0 0 48 28" aria-hidden="true" className={className} fill="none">
      <path d={SHAPES[shape] ?? SHAPES.hipped} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
