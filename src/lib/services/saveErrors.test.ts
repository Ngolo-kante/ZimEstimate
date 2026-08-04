import { describe, expect, it } from 'vitest';
import { humaniseSaveError } from './projects';

/**
 * A save that failed on a CHECK constraint put this in a toast:
 *
 *   new row for relation "projects" violates check constraint
 *   "projects_soil_type_check"
 *
 * at the end of a long form, with the finished BOQ lost. It does not say what
 * went wrong, which answer caused it, or what to do — and the one person who
 * could act on it is the one person it was not written for.
 */

const CONSTRAINT_ERROR =
  'new row for relation "projects" violates check constraint "projects_soil_type_check"';

describe('constraint failures name the step to go back to', () => {
  it('points at Site Conditions for a soil type failure', () => {
    const message = humaniseSaveError(CONSTRAINT_ERROR);
    expect(message).toMatch(/soil type/i);
    expect(message).toMatch(/Site Conditions/i);
    expect(message).not.toMatch(/check constraint|relation "projects"/i);
  });

  it('points at Site Conditions for a slope failure', () => {
    const message = humaniseSaveError(
      'violates check constraint "projects_site_slope_check"',
    );
    expect(message).toMatch(/site slope/i);
    expect(message).not.toMatch(/check constraint/i);
  });

  it('still says something useful for a constraint it has never seen', () => {
    const message = humaniseSaveError(
      'violates check constraint "projects_some_future_check"',
    );
    expect(message).toMatch(/not in a format we can save/i);
    expect(message).not.toMatch(/projects_some_future_check/);
  });
});

describe('other failures people actually hit', () => {
  it('explains an expired session without implying the work is gone', () => {
    // Losing a BOQ is the fear; the message should answer it directly.
    const message = humaniseSaveError('JWT expired');
    expect(message).toMatch(/sign in again/i);
    expect(message).toMatch(/still here/i);
  });

  it('distinguishes a network failure from a data problem', () => {
    expect(humaniseSaveError('Failed to fetch')).toMatch(/connection/i);
  });

  it('names a duplicate as a duplicate', () => {
    expect(humaniseSaveError('duplicate key value violates unique constraint')).toMatch(/already exists/i);
  });

  it('falls back to plain English for anything unrecognised', () => {
    const message = humaniseSaveError('some entirely unexpected postgres noise');
    expect(message).toBe('Could not save the estimate. Please try again.');
  });
});

describe('nothing leaks database vocabulary', () => {
  it.each([
    CONSTRAINT_ERROR,
    'duplicate key value violates unique constraint "projects_pkey"',
    'insert or update on table "projects" violates foreign key constraint',
    'JWT expired',
    'Failed to fetch',
    'unrecognised',
  ])('keeps %s free of internal terms', (raw) => {
    const message = humaniseSaveError(raw);
    expect(message).not.toMatch(/relation |constraint|pkey|JWT|postgres|null value/i);
  });
});
