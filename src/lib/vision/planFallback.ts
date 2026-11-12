// ─── Carrying on in the manual builder after a plan could not be read ────────
// The builder prices from one floor area and already keeps its own draft in
// the browser. What the person gave the plan reader (the project's name and
// place) and the floor area they have just typed go into that draft; whatever
// the draft already holds for a field this does not set is left alone.

export interface ManualBuilderHandoff {
  /** Typed by the person on the recovery screen. */
  floorAreaM2?: number;
  name?: string;
  location?: string;
}

export interface ManualBuilderPatch {
  floorPlanSize?: string;
  name?: string;
  specificLocation?: string;
}

/** Smallest and largest house floor areas the builder is given. */
export const MIN_FLOOR_AREA_M2 = 10;
export const MAX_FLOOR_AREA_M2 = 2000;

export function isUsableFloorArea(value: number | undefined | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_FLOOR_AREA_M2 && value <= MAX_FLOOR_AREA_M2;
}

export function manualBuilderPatch(
  handoff: ManualBuilderHandoff,
  draft: { name: string; specificLocation: string },
): ManualBuilderPatch {
  const patch: ManualBuilderPatch = {};
  // The area was typed for this estimate, so it replaces the draft's.
  if (isUsableFloorArea(handoff.floorAreaM2)) patch.floorPlanSize = String(Math.round(handoff.floorAreaM2 * 10) / 10);
  // A name or place already in the draft is the person's own; keep it.
  if (handoff.name?.trim() && !draft.name.trim()) patch.name = handoff.name.trim();
  if (handoff.location?.trim() && !draft.specificLocation.trim()) patch.specificLocation = handoff.location.trim();
  return patch;
}
