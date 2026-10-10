import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Three byte-identical compliance reminders were once written 19 milliseconds
 * apart, and the dispatcher duly sent the same reminder three times. Migration
 * 050 added a partial unique index so the database refuses the second one, and
 * createReminder has to turn that refusal into something a person can read.
 *
 * The failing case matters as much as the passing one: a 23505 here is not a
 * fault, it means the thing the user asked for is already true. Reporting it as
 * "Failed to schedule reminder: duplicate key value violates unique constraint
 * reminders_no_duplicate_pending" sends someone hunting for a problem that does
 * not exist.
 */

const USER = { id: 'user-1' };

/** Minimal stand-in for insert().select().single(). */
function mockSupabase(insertResult: { data: unknown; error: unknown }) {
  return {
    auth: { getUser: async () => ({ data: { user: USER } }) },
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => insertResult,
        }),
      }),
    }),
  };
}

async function loadCreateReminder(insertResult: { data: unknown; error: unknown }) {
  vi.resetModules();
  vi.doMock('@/lib/supabase', () => ({ supabase: mockSupabase(insertResult) }));
  const mod = await import('./projects');
  return mod.createReminder;
}

const INPUT = {
  project_id: 'project-1',
  reminder_type: 'deadline' as const,
  message: '[EMAIL] Compliance reminder for Cottage house Harare: Approved Site Plan',
  scheduled_date: '2026-11-01T09:00:00.000Z',
  phone_number: '0000000000',
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('scheduling the same reminder twice', () => {
  it('reports an already-queued reminder as already scheduled, not as a failure', async () => {
    const createReminder = await loadCreateReminder({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "reminders_no_duplicate_pending"',
      },
    });

    const result = await createReminder(INPUT);

    expect(result.alreadyScheduled).toBe(true);
    expect(result.reminder).toBeNull();
    expect(result.error?.message).toMatch(/already scheduled/i);
    // The constraint name must never reach a toast.
    expect(result.error?.message).not.toMatch(/duplicate key|unique constraint|23505/i);
  });

  it('leaves a genuine failure looking like a failure', async () => {
    const createReminder = await loadCreateReminder({
      data: null,
      error: { code: '42501', message: 'new row violates row-level security policy' },
    });

    const result = await createReminder(INPUT);

    expect(result.alreadyScheduled).toBeFalsy();
    expect(result.error?.message).toMatch(/row-level security/i);
  });

  it('returns the new reminder when there is no clash', async () => {
    const createReminder = await loadCreateReminder({
      data: { id: 'reminder-1' },
      error: null,
    });

    const result = await createReminder(INPUT);

    expect(result.error).toBeNull();
    expect(result.alreadyScheduled).toBeFalsy();
    expect(result.reminder).toEqual({ id: 'reminder-1' });
  });
});
