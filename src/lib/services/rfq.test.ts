import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryHandler = (state: { table: string }) => { data: any; error: any };

const createSupabaseMock = (handlers: Record<string, QueryHandler>) => {
  return {
    from: (table: string) => {
      const state = { table };
      const exec = () => (handlers[table] ? handlers[table](state) : { data: null, error: null });
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        in: () => builder,
        order: () => builder,
      };
      builder.then = (resolve: any, reject: any) => Promise.resolve(exec()).then(resolve, reject);
      builder.catch = (reject: any) => Promise.resolve(exec()).catch(reject);
      return builder;
    },
  };
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('rfq services', () => {
  it('ranks supplier matches by category, product, and verification', async () => {
    vi.doMock('@/lib/materials', () => ({
      materials: [
        { id: 'cement', category: 'cement', name: 'Cement' },
        { id: 'bricks', category: 'bricks', name: 'Bricks' },
      ],
    }));

    vi.doMock('@/lib/services/notifications', () => ({
      renderNotificationTemplate: () => ({ subject: '', body: '' }),
    }));

    vi.doMock('@/lib/supabase', () => ({
      supabase: createSupabaseMock({
        suppliers: () => ({
          data: [
            {
              id: 's1',
              name: 'Alpha Supplies',
              material_categories: ['Cement & Concrete'],
              verification_status: 'verified',
              rating: 4.5,
              location: 'Harare',
            },
            {
              id: 's2',
              name: 'Beta Stores',
              material_categories: ['Roofing Materials'],
              verification_status: 'unverified',
              rating: 3.0,
              location: 'Bulawayo',
            },
          ],
          error: null,
        }),
        supplier_products: () => ({
          data: [
            { supplier_id: 's1', material_key: 'cement', is_active: true },
          ],
          error: null,
        }),
      }),
    }));

    const { matchSuppliersForItems } = await import('./rfq');
    const result = await matchSuppliersForItems({
      items: [{ material_id: 'cement', material_name: 'Cement' }],
      projectLocation: 'Harare',
      maxSuppliers: 5,
    });

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].supplier.id).toBe('s1');
    expect(result.matches[0].reasons.join(' ')).toContain('Categories');
  });

  it('maps supplier inbox RFQs with recipient and quote', async () => {
    vi.doMock('@/lib/supabase', () => ({
      supabase: createSupabaseMock({
        rfq_requests: () => ({
          data: [
            {
              id: 'rfq-1',
              project_id: 'proj-1',
              rfq_items: [{ id: 'item-1', rfq_id: 'rfq-1', material_id: 'cement' }],
              rfq_recipients: [{ id: 'rec-1', supplier_id: 's1', rfq_id: 'rfq-1', status: 'notified' }],
              rfq_quotes: [
                {
                  id: 'quote-1',
                  rfq_id: 'rfq-1',
                  supplier_id: 's1',
                  status: 'submitted',
                  rfq_quote_items: [],
                },
              ],
              project: { name: 'Project One', location: 'Harare' },
            },
          ],
          error: null,
        }),
      }),
    }));

    vi.doMock('@/lib/services/notifications', () => ({
      renderNotificationTemplate: () => ({ subject: '', body: '' }),
    }));

    const { getSupplierRfqInbox } = await import('./rfq');
    const result = await getSupplierRfqInbox('s1');

    expect(result.error).toBeNull();
    expect(result.rfqs[0].recipient.id).toBe('rec-1');
    expect(result.rfqs[0].supplier_quote?.id).toBe('quote-1');
  });
});
