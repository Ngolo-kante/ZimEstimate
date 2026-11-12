import { describe, expect, it } from 'vitest';
import {
  PlanReadFailure, cleanPartial, failureCodeFor, failureStatus, isPlanFailureCode, recoveryActions,
  type PlanFailureCode,
} from './planFailure';

const CODES: PlanFailureCode[] = ['busy', 'timeout', 'not_floor_plan', 'too_large', 'unreadable', 'unavailable', 'network', 'cancelled'];

describe('plan failure codes', () => {
  it('answers a busy reader with the one status the browser retries', () => {
    expect(failureStatus('busy')).toBe(503);
    expect(CODES.filter((code) => failureStatus(code) === 503)).toEqual(['busy']);
    expect(failureStatus('timeout')).toBe(504);
    expect(failureStatus('too_large')).toBe(413);
    expect(failureStatus('not_floor_plan')).toBe(422);
  });

  it('takes the code the server sent, and falls back on the status', () => {
    expect(failureCodeFor(500, 'unavailable')).toBe('unavailable');
    expect(failureCodeFor(500, 'made-up')).toBe('unreadable');
    expect(failureCodeFor(413)).toBe('too_large');
    expect(failureCodeFor(504)).toBe('timeout');
    expect(failureCodeFor(408)).toBe('timeout');
    expect(failureCodeFor(503)).toBe('busy');
    expect(failureCodeFor(422)).toBe('not_floor_plan');
    expect(failureCodeFor(500)).toBe('unreadable');
    expect(isPlanFailureCode('busy')).toBe(true);
    expect(isPlanFailureCode(503)).toBe(false);
  });

  it('carries its code, sheet and what was read', () => {
    const failure = new PlanReadFailure('Not a floor plan', 'not_floor_plan', { sheet: 'septic', partial: { statedTotalAreaM2: 90 } });
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe('Not a floor plan');
    expect(failure).toMatchObject({ code: 'not_floor_plan', sheet: 'septic', partial: { statedTotalAreaM2: 90 } });
  });
});

describe('what a failed read carries forward', () => {
  it('keeps printed rooms and a stated total that could be real', () => {
    expect(cleanPartial({ rooms: [{ name: ' Lounge ', width: 5, length: 4.5 }], statedTotalAreaM2: 120 }))
      .toEqual({ rooms: [{ name: 'Lounge', width: 5, length: 4.5 }], statedTotalAreaM2: 120 });
  });

  it('drops figures that cannot be a room or a house, and anything malformed', () => {
    expect(cleanPartial({ rooms: [{ name: 'Lounge', width: 50, length: 4 }, { name: '', width: 3, length: 3 }, null, 'x'], statedTotalAreaM2: 5 })).toBeUndefined();
    expect(cleanPartial({ rooms: 'no', statedTotalAreaM2: '120' })).toBeUndefined();
    expect(cleanPartial(null)).toBeUndefined();
    expect(cleanPartial('partial')).toBeUndefined();
  });
});

describe('what is offered after a failure', () => {
  it('always offers a way to a priced estimate', () => {
    for (const code of CODES) {
      for (const canShowPlan of [true, false]) {
        const { primary, others } = recoveryActions(code, { canShowPlan });
        const offered = [primary, ...others];
        expect(offered.some((action) => action === 'enter_area' || action === 'mark_rooms'), `${code} ${canShowPlan}`).toBe(true);
        expect(new Set(offered).size, `${code} repeats an action`).toBe(offered.length);
      }
    }
  });

  it('leads with reading the same file again when the fault was passing', () => {
    for (const code of ['busy', 'timeout', 'network', 'cancelled'] as const) {
      expect(recoveryActions(code, { canShowPlan: true }).primary).toBe('retry');
    }
  });

  it('never offers to read a wrong sheet or an oversized file again', () => {
    for (const code of ['not_floor_plan', 'too_large'] as const) {
      const { primary, others } = recoveryActions(code, { canShowPlan: true });
      expect(primary).toBe('choose_file');
      expect(others).not.toContain('retry');
    }
  });

  it('lets the person mark the rooms when only the reader judged it not a floor plan', () => {
    expect(recoveryActions('not_floor_plan', { canShowPlan: true }).others).toEqual(['mark_rooms', 'enter_area']);
    expect(recoveryActions('not_floor_plan', { sheet: 'elevations', canShowPlan: true }).others).toEqual(['enter_area']);
  });

  it('offers the septic estimate only for a septic drawing', () => {
    expect(recoveryActions('not_floor_plan', { sheet: 'septic', canShowPlan: true }).others).toContain('septic_estimate');
    expect(recoveryActions('not_floor_plan', { sheet: 'structural', canShowPlan: true }).others).not.toContain('septic_estimate');
  });

  it('offers marking rooms on the plan only when there is a picture of it', () => {
    expect(recoveryActions('unreadable', { canShowPlan: true }).primary).toBe('mark_rooms');
    expect(recoveryActions('unreadable', { canShowPlan: false })).toEqual({ primary: 'enter_area', others: ['choose_file'] });
    expect(recoveryActions('busy', { canShowPlan: false }).others).not.toContain('mark_rooms');
  });
});
