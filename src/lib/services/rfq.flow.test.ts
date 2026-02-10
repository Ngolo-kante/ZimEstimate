import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryHandler = (state: { table: string; action: string }) => { data: any; error: any };

const createSupabaseMock = (handlers: Record<string, QueryHandler>) => {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: { rfq_id: 'rfq-1', item_ids: ['item-1'], recipient_ids: ['rec-1'] },
      error: null,
    }),
    from: (table: string) => {
      const state = { table, action: 'select' };
      const exec = () => (handlers[table] ? handlers[table](state) : { data: null, error: null });
      const builder: any = {
        select: () => {
          state.action = 'select';
          return builder;
        },
        insert: () => {
          state.action = 'insert';
          return builder;
        },
        update: () => {
          state.action = 'update';
          return builder;
        },
        upsert: () => {
          state.action = 'upsert';
          return builder;
        },
        delete: () => {
          state.action = 'delete';
          return builder;
        },
        eq: () => builder,
        neq: () => builder,
        in: () => builder,
        is: () => builder,
        order: () => builder,
        limit: () => builder,
        single: () => builder,
        maybeSingle: () => builder,
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

describe('rfq flow integration', () => {
  it('creates an RFQ, submits a quote, and accepts it', async () => {
    vi.doMock('@/lib/materials', () => ({
      materials: [{ id: 'cement', category: 'cement', name: 'Cement' }],
    }));

    vi.doMock('@/lib/services/notifications', () => ({
      renderNotificationTemplate: () => ({ title: 'Notice', body: 'Body' }),
    }));

    vi.doMock('@/lib/supabase', () => ({
      supabase: createSupabaseMock({
        projects: () => ({
          data: { location: 'Harare', name: 'Project Alpha' },
          error: null,
        }),
        suppliers: () => ({
          data: [
            {
              id: 'supplier-1',
              user_id: 'supplier-user',
              contact_phone: '+263',
              contact_email: 'supplier@example.com',
              material_categories: ['Cement & Concrete'],
              verification_status: 'verified',
              rating: 4.2,
              location: 'Harare',
            },
          ],
          error: null,
        }),
        supplier_products: () => ({
          data: [{ supplier_id: 'supplier-1', material_key: 'cement', is_active: true }],
          error: null,
        }),
        profiles: () => ({
          data: [
            {
              id: 'supplier-user',
              notify_email: true,
              notify_whatsapp: false,
              notify_rfq: true,
              notify_quote_updates: true,
              phone_number: null,
            },
          ],
          error: null,
        }),
        rfq_requests: (state) => ({
          data: state.action === 'select'
            ? { id: 'rfq-1', user_id: 'user-1', project_id: 'project-1', project: { name: 'Project Alpha' } }
            : null,
          error: null,
        }),
        rfq_recipients: () => ({
          data: [{ id: 'rec-1', supplier_id: 'supplier-1', rfq_id: 'rfq-1', status: 'notified' }],
          error: null,
        }),
        rfq_quotes: () => ({
          data: { id: 'quote-1', rfq_id: 'rfq-1', supplier_id: 'supplier-1', status: 'submitted' },
          error: null,
        }),
        rfq_quote_items: () => ({ data: null, error: null }),
        notification_deliveries: () => ({ data: null, error: null }),
      }),
    }));

    const { createRfqRequest, submitSupplierQuote, acceptRfqQuote } = await import('./rfq');

    const createResult = await createRfqRequest({
      projectId: 'project-1',
      items: [{ material_id: 'cement', material_name: 'Cement', quantity: 10, unit: 'bag' }],
    });

    expect(createResult.error).toBeNull();
    expect(createResult.rfq?.id).toBe('rfq-1');

    const quoteResult = await submitSupplierQuote({
      rfqId: 'rfq-1',
      supplierId: 'supplier-1',
      items: [
        { rfq_item_id: 'item-1', unit_price_usd: 10, unit_price_zwg: 300, available_quantity: 10 },
      ],
    });

    expect(quoteResult.error).toBeNull();
    expect(quoteResult.quote?.id).toBe('quote-1');

    const acceptResult = await acceptRfqQuote({ rfqId: 'rfq-1', quoteId: 'quote-1' });
    expect(acceptResult.error).toBeNull();
  });
});
