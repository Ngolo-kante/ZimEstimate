// ─── Why a plan could not be read, and what the person can do next ───────────
// A failed read used to be one sentence under an empty upload box. The server
// chose its HTTP status by searching its own message ("took too long",
// "busy"), and the browser turned the status back into words; nothing knew
// what had actually gone wrong, so nothing could offer the right way forward.
//
// A failure now carries a code. The wording is still the server's or the
// browser's own; the code decides which buttons the person sees
// (PlanRecovery.tsx), and is what analytics records.

export type PlanFailureCode =
  /** Every AI reader was busy or rate-limited. Usually passes within a minute. */
  | 'busy'
  /** The readers, or the upload, ran out of time. */
  | 'timeout'
  /** Another sheet of the drawing set: septic tank, columns, elevations. */
  | 'not_floor_plan'
  /** Too big to upload. */
  | 'too_large'
  /** Read, but no rooms could be made out. */
  | 'unreadable'
  /** The reader cannot be used at all right now; trying again will not help. */
  | 'unavailable'
  /** The upload never reached us. */
  | 'network'
  /** The person stopped it. */
  | 'cancelled';

export type WrongSheet = 'septic' | 'structural' | 'elevations';

/** What was read off the plan before the read failed; each figure is as printed. */
export interface PlanPartial {
  /** Rooms whose name and size are printed on the plan. */
  rooms?: Array<{ name: string; width: number; length: number }>;
  /** The whole floor area the plan states. */
  statedTotalAreaM2?: number;
}

export class PlanReadFailure extends Error {
  readonly code: PlanFailureCode;
  readonly sheet?: WrongSheet;
  readonly partial?: PlanPartial;

  constructor(message: string, code: PlanFailureCode, details: { sheet?: WrongSheet; partial?: PlanPartial } = {}) {
    super(message);
    this.name = 'PlanReadFailure';
    this.code = code;
    this.sheet = details.sheet;
    this.partial = details.partial;
  }
}

const CODES: PlanFailureCode[] = ['busy', 'timeout', 'not_floor_plan', 'too_large', 'unreadable', 'unavailable', 'network', 'cancelled'];
const SHEETS: WrongSheet[] = ['septic', 'structural', 'elevations'];

export const isPlanFailureCode = (value: unknown): value is PlanFailureCode =>
  typeof value === 'string' && (CODES as string[]).includes(value);

export const isWrongSheet = (value: unknown): value is WrongSheet =>
  typeof value === 'string' && (SHEETS as string[]).includes(value);

/** The HTTP status a failure is answered with. 503 is the one the browser retries. */
export function failureStatus(code: PlanFailureCode): number {
  switch (code) {
    case 'busy': return 503;
    case 'timeout': return 504;
    case 'too_large': return 413;
    case 'not_floor_plan': return 422;
    default: return 500;
  }
}

/** The code for a reply, from the one the server sent or, failing that, its status. */
export function failureCodeFor(status: number, sent?: unknown): PlanFailureCode {
  if (isPlanFailureCode(sent)) return sent;
  if (status === 413) return 'too_large';
  if (status === 504 || status === 408) return 'timeout';
  if (status === 503 || status === 429) return 'busy';
  if (status === 422) return 'not_floor_plan';
  return 'unreadable';
}

/** Only figures that could be a real room or house are carried forward. */
export function cleanPartial(raw: unknown): PlanPartial | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as { rooms?: unknown; statedTotalAreaM2?: unknown };
  const partial: PlanPartial = {};
  if (Array.isArray(value.rooms)) {
    const rooms = value.rooms.flatMap((room) => {
      const { name, width, length } = (room ?? {}) as { name?: unknown; width?: unknown; length?: unknown };
      return typeof name === 'string' && name.trim() && typeof width === 'number' && typeof length === 'number'
        && Number.isFinite(width) && Number.isFinite(length) && width >= 0.8 && width <= 40 && length >= 0.8 && length <= 40
        ? [{ name: name.trim().slice(0, 60), width, length }] : [];
    }).slice(0, 60);
    if (rooms.length > 0) partial.rooms = rooms;
  }
  const area = value.statedTotalAreaM2;
  if (typeof area === 'number' && Number.isFinite(area) && area >= 20 && area <= 2000) partial.statedTotalAreaM2 = area;
  return partial.rooms || partial.statedTotalAreaM2 ? partial : undefined;
}

export type RecoveryAction =
  /** Read the same file again. */
  | 'retry'
  /** Pick another file or page. */
  | 'choose_file'
  /** Open the plan with no rooms and mark them by hand. */
  | 'mark_rooms'
  /** Type the floor area and carry on in the manual builder. */
  | 'enter_area'
  /** The septic tank quick estimate, for a septic drawing. */
  | 'septic_estimate';

/**
 * What to offer after a failure, most useful first. Every failure has at
 * least one action that ends in a priced estimate.
 *
 * `canShowPlan` is false when there is no picture of the plan to mark rooms
 * on (a PDF whose page could not be drawn in the browser).
 */
export function recoveryActions(
  code: PlanFailureCode,
  context: { sheet?: WrongSheet; canShowPlan: boolean },
): { primary: RecoveryAction; others: RecoveryAction[] } {
  const mark: RecoveryAction[] = context.canShowPlan ? ['mark_rooms'] : [];
  switch (code) {
    case 'busy':
    case 'timeout':
    case 'network':
    case 'cancelled':
      return { primary: 'retry', others: [...mark, 'enter_area', 'choose_file'] };
    case 'not_floor_plan':
      // A sheet named in the drawing's own words is certain. Without one it
      // is the reader's opinion of the picture, which can be wrong about a
      // faint plan: the person may still mark its rooms.
      return {
        primary: 'choose_file',
        others: context.sheet === 'septic' ? ['septic_estimate', 'enter_area'] : context.sheet ? ['enter_area'] : [...mark, 'enter_area'],
      };
    case 'too_large':
      return { primary: 'choose_file', others: ['enter_area'] };
    case 'unreadable':
    case 'unavailable':
    default:
      return context.canShowPlan
        ? { primary: 'mark_rooms', others: ['enter_area', 'choose_file'] }
        : { primary: 'enter_area', others: ['choose_file'] };
  }
}
