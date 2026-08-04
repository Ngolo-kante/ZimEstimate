import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Clicking a saved quick estimate used to throw the user back to a blank form.
 *
 * The card pointed at /projects/quick?id=<id>; that page read no search params
 * at all, and its own cards pushed to /quick-projects/<type>. So the estimate
 * you had saved was unreachable, and getQuickBOQ — the function that would have
 * opened it — had no callers anywhere in the app.
 *
 * These cover the mapping the card is built from.
 */

const getProjects = vi.fn();
const listQuickBOQs = vi.fn();

vi.mock('./projects', () => ({ getProjects: () => getProjects() }));
vi.mock('./quickBoq', () => ({ listQuickBOQs: () => listQuickBOQs() }));

const { listSavedWork, buildFilters } = await import('./savedWork');

const project = (over = {}) => ({
  id: 'p1', name: 'Cottage — Harare', total_usd: 42000, status: 'planning',
  location: 'Harare', updated_at: '2026-08-01T00:00:00Z', created_at: '2026-07-01T00:00:00Z',
  ...over,
});

const quick = (over = {}) => ({
  id: 'q1', projectType: 'solar', answers: {}, boqItems: [], labor: {},
  markupPct: 0, currency: 'USD',
  updatedAt: '2026-08-02T00:00:00Z', createdAt: '2026-08-02T00:00:00Z',
  ...over,
});

beforeEach(() => {
  getProjects.mockResolvedValue({ projects: [], error: null });
  listQuickBOQs.mockResolvedValue({ boqs: [], error: null });
});

describe('a saved quick estimate is reachable', () => {
  it('links to its own BOQ, not to the wizard that made it', async () => {
    listQuickBOQs.mockResolvedValue({ boqs: [quick({ id: 'abc123' })], error: null });
    const { items } = await listSavedWork();
    expect(items[0].href).toBe('/projects/quick/abc123');
  });

  it('never links back into /quick-projects, which is the blank form', async () => {
    listQuickBOQs.mockResolvedValue({ boqs: [quick(), quick({ id: 'q2', projectType: 'septic' })], error: null });
    const { items } = await listSavedWork();
    items.forEach((i) => expect(i.href).not.toContain('/quick-projects/'));
  });
});

describe('the card is named the way the user named it', () => {
  it('prefers the project name over the generic type label', async () => {
    listQuickBOQs.mockResolvedValue({
      boqs: [quick({ answers: { project_name: 'Rooftop solar — Borrowdale' } })],
      error: null,
    });
    const { items } = await listSavedWork();
    // A card reading "Solar estimate" beside a page reading "Rooftop solar"
    // looks like two different records.
    expect(items[0].name).toBe('Rooftop solar — Borrowdale');
  });

  it('falls back to the type label when the estimate was never named', async () => {
    listQuickBOQs.mockResolvedValue({ boqs: [quick({ answers: {} })], error: null });
    const { items } = await listSavedWork();
    expect(items[0].name).toBe('Solar estimate');
  });

  it('ignores a name that is only whitespace', async () => {
    listQuickBOQs.mockResolvedValue({ boqs: [quick({ answers: { project_name: '   ' } })], error: null });
    const { items } = await listSavedWork();
    expect(items[0].name).toBe('Solar estimate');
  });
});

describe('both kinds share one list', () => {
  it('sorts by most recently touched, regardless of table', async () => {
    getProjects.mockResolvedValue({ projects: [project({ updated_at: '2026-08-03T00:00:00Z' })], error: null });
    listQuickBOQs.mockResolvedValue({ boqs: [quick({ updatedAt: '2026-08-05T00:00:00Z' })], error: null });
    const { items } = await listSavedWork();
    expect(items.map((i) => i.kind)).toEqual(['quick', 'project']);
  });

  it('reports partial rather than failing outright when one source is down', async () => {
    // Showing the half we could read beats showing nothing, because the
    // alternative is a user concluding their work is gone.
    listQuickBOQs.mockResolvedValue({ boqs: [], error: new Error('offline') });
    getProjects.mockResolvedValue({ projects: [project()], error: null });
    const { items, partial } = await listSavedWork();
    expect(partial).toBe(true);
    expect(items).toHaveLength(1);
  });
});

describe('filter pills are built from what the user has', () => {
  it('offers no Solar pill to someone with no solar estimate', async () => {
    getProjects.mockResolvedValue({ projects: [project()], error: null });
    const { items } = await listSavedWork();
    const keys = buildFilters(items).map((f) => f.key);
    expect(keys).toEqual(['all', 'project']);
    expect(keys).not.toContain('solar');
  });

  it('counts every kind it does have', async () => {
    getProjects.mockResolvedValue({ projects: [project()], error: null });
    listQuickBOQs.mockResolvedValue({
      boqs: [quick(), quick({ id: 'q2' }), quick({ id: 'q3', projectType: 'septic' })],
      error: null,
    });
    const { items } = await listSavedWork();
    const filters = buildFilters(items);
    expect(filters.find((f) => f.key === 'all')?.count).toBe(4);
    expect(filters.find((f) => f.key === 'solar')?.count).toBe(2);
    expect(filters.find((f) => f.key === 'septic')?.count).toBe(1);
  });
});

describe('the total excludes what the user is not paying for', () => {
  it('drops excluded and already-owned items', async () => {
    listQuickBOQs.mockResolvedValue({
      boqs: [quick({ boqItems: [
        { totalCostUsd: 100, included: true, owned: false },
        { totalCostUsd: 50, included: false, owned: false },
        { totalCostUsd: 25, included: true, owned: true },
      ] })],
      error: null,
    });
    const { items } = await listSavedWork();
    expect(items[0].totalUsd).toBe(100);
  });
});
