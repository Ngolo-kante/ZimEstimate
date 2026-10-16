export interface PlanReviewRoom {
  name: string;
  length: number;
  width: number;
}

export interface PlanReviewInput {
  area: number;
  rooms: PlanReviewRoom[];
  doors: number;
  windows: number;
  externalWallLength: number;
  internalWallLength: number;
  /** True when the reader could not identify any external wall segments. */
  noExternalWallsDetected?: boolean;
  confidence?: number | null;
  /** The AI readers were busy and only the plan's printed labels were read. */
  readFromLabels?: boolean;
  stages: string[];
  includeLabor: boolean;
}

export interface PlanReviewFinding {
  id: string;
  text: string;
  severity: 'required' | 'check';
}

/** Deliberately conservative checks: unusual counts invite review, not a made-up price uplift. */
export function assessPlanReview(input: PlanReviewInput): PlanReviewFinding[] {
  const findings: PlanReviewFinding[] = [];
  const add = (id: string, text: string, severity: PlanReviewFinding['severity'] = 'check') =>
    findings.push({ id, text, severity });

  if (!Number.isFinite(input.area) || input.area <= 0) add('area', 'No usable floor area was found. Edit the room dimensions before continuing.', 'required');
  if (input.rooms.length === 0) add('rooms', 'No rooms were found. Edit the plan before continuing.', 'required');
  if (input.stages.length === 0) add('stages', 'Choose at least one construction stage before continuing.', 'required');

  if (input.rooms.some((room) => !Number.isFinite(room.length * room.width) || room.length <= 0 || room.width <= 0)) {
    add('dimensions', 'At least one room has missing dimensions. Check the room list.', 'required');
  }
  if (input.area >= 80 && input.rooms.length < 2) add('room-count', 'Only one room was found for a large floor area. Check whether the scan missed rooms.');
  if (input.doors === 0) add('doors', 'No doors were detected. Enter the plan count, or review the assumed doors in the BOQ.');
  else if (input.rooms.length >= 4 && input.doors < Math.ceil(input.rooms.length / 2)) add('doors', 'Door count looks low compared with the number of rooms. Check the plan count.');
  if (input.windows === 0) add('windows', 'No windows were detected. Enter the plan count, or review the area-based allowance in the BOQ.');
  else if (input.area >= 80 && input.windows < Math.ceil(input.area / 45)) add('windows', 'Window count looks low for this floor area. Check the plan count.');
  if (input.noExternalWallsDetected) add('walls', 'No external wall segments were identified. External wall length is estimated from floor area.');
  if (input.readFromLabels) {
    add('labels', `Our AI plan readers were busy, so only the room names and sizes printed on the plan were read: ${input.rooms.length} ${input.rooms.length === 1 ? 'room' : 'rooms'}. Add any that are missing, or upload the plan again in a minute for a full reading.`);
  } else if (input.confidence != null && input.confidence < 70) {
    add('confidence', 'The plan reader had low confidence. Confirm the room dimensions against the drawing.');
  }

  return findings;
}

export function isPlanReviewBlocked(input: PlanReviewInput): boolean {
  return assessPlanReview(input).some((finding) => finding.severity === 'required');
}

/**
 * The plan itself: floor area and rooms. A confirmation stays valid while
 * the user corrects doors, windows, stages, roof or labour — those are edits
 * made on the same screen, not a different plan.
 */
export function planIdentityKey(input: PlanReviewInput): string {
  return JSON.stringify({ area: input.area, rooms: input.rooms });
}
