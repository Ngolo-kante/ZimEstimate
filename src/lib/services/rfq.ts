import { supabase } from '@/lib/supabase';
import { materials } from '@/lib/materials';
import type {
  BOQItem,
  RfqRequest,
  RfqRequestInsert,
  RfqItem,
  RfqItemInsert,
  RfqRecipient,
  RfqRecipientInsert,
  RfqQuote,
  RfqQuoteInsert,
  RfqQuoteItem,
  RfqQuoteItemInsert,
  RfqNotificationInsert,
  Supplier,
  Project,
} from '@/lib/database.types';
import { renderNotificationTemplate } from '@/lib/services/notifications';
import { logger } from '@/lib/logger';

// TYPE-001 FIX: Removed `as any` cast - use supabase directly with proper types
// Use `as never` only for specific insert/update operations where Supabase
// type inference has issues (documented pattern in this codebase)

// ERR-001 FIX: Helper for logging async operation errors without blocking the flow
function logAsyncError(operation: string, error: unknown): void {
  logger.error(`RFQ: ${operation} failed`, { error: error instanceof Error ? error.message : error });
}

const MATERIAL_CATEGORY_MAP: Record<string, string> = {
  bricks: 'Bricks & Blocks',
  cement: 'Cement & Concrete',
  sand: 'Aggregates & Sand',
  aggregates: 'Aggregates & Sand',
  steel: 'Steel & Metal',
  roofing: 'Roofing Materials',
  timber: 'Timber & Wood',
  electrical: 'Electrical Supplies',
  plumbing: 'Plumbing Supplies',
  finishes: 'Paint & Finishes',
  hardware: 'Hardware & Fasteners',
};

const VERIFICATION_SCORE: Record<string, number> = {
  premium: 2.0,
  trusted: 1.5,
  verified: 1.0,
  pending: 0.5,
  unverified: 0,
};

const normalize = (value?: string | null) => (value || '').toLowerCase().trim();

const hasLocationMatch = (projectLocation?: string | null, supplier?: Supplier | null) => {
  const project = normalize(projectLocation);
  if (!project || !supplier) return false;
  const locationParts = [supplier.location, supplier.physical_address].filter(Boolean).join(' ').toLowerCase();
  if (!locationParts) return false;
  return locationParts.includes(project) || project.includes(locationParts);
};

const getRequestedCategories = (items: Pick<BOQItem, 'material_id' | 'material_name'>[]) => {
  const categories = new Set<string>();
  items.forEach((item) => {
    const material = materials.find((m) => m.id === item.material_id);
    if (!material) return;
    const mapped = MATERIAL_CATEGORY_MAP[material.category];
    if (mapped) categories.add(mapped);
  });
  return Array.from(categories);
};

const getMaterialKeys = (items: Pick<BOQItem, 'material_id'>[]) => {
  return Array.from(new Set(items.map((item) => item.material_id)));
};

export type SupplierMatch = {
  supplier: Supplier;
  score: number;
  reasons: string[];
};

export type RfqWithDetails = RfqRequest & {
  rfq_items: RfqItem[];
  rfq_quotes: (RfqQuote & { rfq_quote_items: RfqQuoteItem[]; supplier?: Supplier | null })[];
  rfq_recipients?: RfqRecipient[];
};

export type SupplierInboxRfq = RfqRequest & {
  rfq_items: RfqItem[];
  recipient: RfqRecipient;
  supplier_quote?: RfqQuote & { rfq_quote_items: RfqQuoteItem[] };
  project?: Pick<Project, 'name' | 'location'> | null;
};

/** Match suppliers for a set of BOQ items using category, location, and quality signals. */
export async function matchSuppliersForItems(options: {
  items: Pick<BOQItem, 'material_id' | 'material_name'>[];
  projectLocation?: string | null;
  maxSuppliers?: number;
}): Promise<{ matches: SupplierMatch[]; error: Error | null }> {
  const { items, projectLocation, maxSuppliers = 10 } = options;
  const categories = getRequestedCategories(items);
  const materialKeys = getMaterialKeys(items);

  const { data: supplierRows, error } = await supabase
    .from('suppliers')
    .select('*')
    .is('deleted_at', null)
    .order('rating', { ascending: false });

  if (error) {
    return { matches: [], error: new Error(error.message) };
  }

  const suppliers = (supplierRows || []) as Supplier[];
  const supplierIds = suppliers.map((s) => s.id);

  const { data: productRows } = await supabase
    .from('supplier_products')
    .select('supplier_id, material_key')
    .in('supplier_id', supplierIds)
    .in('material_key', materialKeys)
    .eq('is_active', true);

  const productMatches = new Map<string, Set<string>>();
  (productRows || []).forEach((row: { supplier_id: string; material_key: string }) => {
    if (!productMatches.has(row.supplier_id)) productMatches.set(row.supplier_id, new Set());
    productMatches.get(row.supplier_id)?.add(row.material_key);
  });

  const matches: SupplierMatch[] = suppliers.map((supplier) => {
    const reasons: string[] = [];
    let score = 0;

    const supplierCategories = supplier.material_categories || [];
    const categoryHits = categories.filter((cat) => supplierCategories.includes(cat));
    if (categoryHits.length > 0) {
      score += categoryHits.length * 2;
      reasons.push(`Categories: ${categoryHits.join(', ')}`);
    }

    const productHits = productMatches.get(supplier.id);
    if (productHits && productHits.size > 0) {
      score += Math.min(productHits.size, 4) * 1.5;
      reasons.push(`${productHits.size} matching products`);
    }

    if (hasLocationMatch(projectLocation, supplier)) {
      score += 1;
      reasons.push('Location match');
    }

    const verification = VERIFICATION_SCORE[supplier.verification_status || 'unverified'] ?? 0;
    if (verification > 0) {
      score += verification;
      reasons.push(`Verified: ${supplier.verification_status}`);
    }

    if (supplier.rating) {
      score += Math.min(supplier.rating / 5, 1);
      reasons.push(`Rating ${supplier.rating.toFixed(1)}`);
    }

    return { supplier, score, reasons };
  });

  const filtered = matches
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuppliers);

  if (filtered.length > 0) {
    return { matches: filtered, error: null };
  }

  const fallback = matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuppliers);

  return { matches: fallback, error: null };
}

/** Create a new RFQ request with items and recipients using a transaction. */
export async function createRfqRequest(options: {
  projectId: string;
  deliveryAddress?: string | null;
  requiredBy?: string | null;
  notes?: string | null;
  items: Pick<BOQItem, 'material_id' | 'material_name' | 'quantity' | 'unit'>[];
  maxSuppliers?: number;
}): Promise<{ rfq: RfqRequest | null; recipients: RfqRecipient[]; matches: SupplierMatch[]; error: Error | null }> {
  const { projectId, deliveryAddress, requiredBy, notes, items, maxSuppliers } = options;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { rfq: null, recipients: [], matches: [], error: new Error('Not authenticated') };
  }

  const { data: projectRow } = await supabase
    .from('projects')
    .select('location, name')
    .eq('id', projectId)
    .single();

  // First, match suppliers before creating RFQ (to prepare data for transaction)
  const { matches, error: matchError } = await matchSuppliersForItems({
    items,
    projectLocation: deliveryAddress || (projectRow as { location?: string | null } | null)?.location,
    maxSuppliers,
  });

  if (matchError) {
    return { rfq: null, recipients: [], matches: [], error: matchError };
  }

  // Get supplier notification preferences
  const supplierUserIds = matches
    .map((match) => match.supplier.user_id)
    .filter(Boolean) as string[];

  const { data: preferenceRows } = supplierUserIds.length
    ? await supabase
      .from('profiles')
      .select('id, notify_email, notify_whatsapp, notify_rfq, phone_number')
      .in('id', supplierUserIds)
    : { data: [] };

  const preferencesByUser = new Map<string, {
    notify_email: boolean;
    notify_whatsapp: boolean;
    notify_rfq: boolean;
    phone_number: string | null;
  }>();

  (preferenceRows || []).forEach((row: {
    id: string;
    notify_email: boolean;
    notify_whatsapp: boolean;
    notify_rfq: boolean;
    phone_number: string | null;
  }) => {
    preferencesByUser.set(row.id, row);
  });

  const channelsBySupplier = new Map<string, Array<'email' | 'whatsapp'>>();

  // Prepare items payload for transaction
  const itemsForTransaction = items.map((item) => ({
    material_key: item.material_id,
    material_name: item.material_name,
    quantity: Number(item.quantity),
    unit: item.unit || null,
  }));

  // Prepare recipients payload for transaction
  const recipientsForTransaction = matches.map((match) => {
    const userId = match.supplier.user_id || '';
    const preferences = userId ? preferencesByUser.get(userId) : null;
    const allowRfq = preferences?.notify_rfq ?? true;
    const allowEmail = preferences?.notify_email ?? true;
    const allowWhatsapp = preferences?.notify_whatsapp ?? false;
    const phoneNumber = preferences?.phone_number || match.supplier.contact_phone;

    const channels: Array<'email' | 'whatsapp'> = [];
    if (allowRfq && allowEmail) channels.push('email');
    if (allowRfq && allowWhatsapp && phoneNumber) channels.push('whatsapp');

    channelsBySupplier.set(match.supplier.id, channels);

    return {
      supplier_id: match.supplier.id,
      status: 'notified',
      notification_channels: channels,
    };
  });

  // DB-001 FIX: Use database function to create RFQ atomically in a transaction
  const { data: transactionResult, error: transactionError } = await supabase
    .rpc('create_rfq_with_items_and_recipients', {
      p_project_id: projectId,
      p_user_id: user.id,
      p_delivery_address: deliveryAddress || null,
      p_required_by: requiredBy || null,
      p_notes: notes || null,
      p_items: itemsForTransaction,
      p_recipients: recipientsForTransaction,
    });

  if (transactionError) {
    logAsyncError('Create RFQ transaction', transactionError);
    return { rfq: null, recipients: [], matches: [], error: new Error(transactionError.message) };
  }

  const result = transactionResult as { rfq_id: string; item_ids: string[]; recipient_ids: string[] };
  const rfqId = result.rfq_id;

  // Fetch the created RFQ to return
  const { data: rfq, error: rfqFetchError } = await supabase
    .from('rfq_requests')
    .select('*')
    .eq('id', rfqId)
    .single();

  if (rfqFetchError) {
    return { rfq: null, recipients: [], matches, error: new Error(rfqFetchError.message) };
  }

  // Fetch the created recipients
  const { data: recipientRows } = await supabase
    .from('rfq_recipients')
    .select('*')
    .eq('rfq_id', rfqId);

  const recipients = (recipientRows || []) as RfqRecipient[];

  // Prepare item payload for notifications (re-create with rfq_id)
  const itemPayload = items.map((item) => ({
    rfq_id: rfqId,
    material_key: item.material_id,
    material_name: item.material_name,
    quantity: Number(item.quantity),
    unit: item.unit || null,
  }));

  const notifications: RfqNotificationInsert[] = matches.flatMap((match) => {
    const payloadBase = {
      rfq_id: rfqId,
      supplier_id: match.supplier.id,
      payload: {
        supplierName: match.supplier.name,
        contactEmail: match.supplier.contact_email,
        contactPhone: match.supplier.contact_phone,
        rfqId,
        projectId,
        items: itemPayload.map((item) => ({
          material_key: item.material_key,
          material_name: item.material_name,
          quantity: item.quantity,
          unit: item.unit,
        })),
      },
    };

    const channels = channelsBySupplier.get(match.supplier.id) || [];
    return channels.map((channel) => ({
      ...payloadBase,
      channel,
    }));
  });

  // ERR-001 FIX: Add error handling for notification queue insert
  if (notifications.length > 0) {
    const { error: notifError } = await supabase.from('rfq_notification_queue').insert(notifications as never);
    if (notifError) {
      logAsyncError('Queue RFQ notifications', notifError);
    }
  }

  const deliveryLogs = matches.flatMap((match) => {
    const userId = match.supplier.user_id;
    if (!userId) return [];
    const channels = channelsBySupplier.get(match.supplier.id) || [];
    const requiredByLabel = requiredBy || 'N/A';
    const projectName = (projectRow as { name?: string | null } | null)?.name || 'Project';
    const templateData = {
      rfqId,
      projectName,
      itemCount: itemPayload.length,
      requiredBy: requiredByLabel,
    };

    return channels.map((channel) => {
      const message = renderNotificationTemplate('rfq_received', channel, templateData);
      return {
        user_id: userId,
        channel,
        template_key: 'rfq_received',
        payload: {
          rfq_id: rfqId,
          project_id: projectId,
          supplier_id: match.supplier.id,
          title: message.title,
          body: message.body,
          contact_email: match.supplier.contact_email,
          contact_phone: match.supplier.contact_phone,
        },
      };
    });
  });

  // ERR-001 FIX: Add error handling for delivery logs insert
  if (deliveryLogs.length > 0) {
    const { error: deliveryError } = await supabase.from('notification_deliveries').insert(deliveryLogs as never);
    if (deliveryError) {
      logAsyncError('Insert RFQ delivery logs', deliveryError);
    }
  }

  return { rfq: rfq as RfqRequest, recipients, matches, error: null };
}

/** Fetch RFQs for a project with related items, recipients, and quotes. */
export async function getProjectRfqs(projectId: string): Promise<{ rfqs: RfqWithDetails[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('rfq_requests')
    .select(`
      *,
      rfq_items(*),
      rfq_recipients(*),
      rfq_quotes(
        *,
        rfq_quote_items(*),
        supplier:suppliers(id, name, verification_status, rating)
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    return { rfqs: [], error: new Error(error.message) };
  }

  return { rfqs: (data || []) as RfqWithDetails[], error: null };
}

/** Fetch RFQs visible to a supplier, including quote status. */
export async function getSupplierRfqInbox(supplierId: string): Promise<{ rfqs: SupplierInboxRfq[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('rfq_requests')
    .select(`
      *,
      rfq_items(*),
      rfq_recipients!inner(id, supplier_id, status, notified_at, last_viewed_at, rfq_id),
      rfq_quotes(*, rfq_quote_items(*)),
      project:projects(name, location)
    `)
    .eq('rfq_recipients.supplier_id', supplierId)
    .order('created_at', { ascending: false });

  if (error) {
    return { rfqs: [], error: new Error(error.message) };
  }

  const raw = (data || []) as (RfqRequest & {
    rfq_items: RfqItem[];
    rfq_recipients: RfqRecipient[];
    rfq_quotes: RfqQuote[];
    project: Pick<Project, 'name' | 'location'> | null;
  })[];

  const rfqs = raw.map((rfq) => {
    const recipient = rfq.rfq_recipients[0];
    const supplierQuote = rfq.rfq_quotes.find((quote) => quote.supplier_id === supplierId);
    return {
      ...rfq,
      rfq_items: rfq.rfq_items,
      recipient,
      supplier_quote: supplierQuote ? { ...supplierQuote, rfq_quote_items: (supplierQuote as RfqQuote & { rfq_quote_items?: RfqQuoteItem[] }).rfq_quote_items || [] } : undefined,
      project: rfq.project,
    } as SupplierInboxRfq;
  });

  return { rfqs, error: null };
}

/** Mark an RFQ recipient as viewed. */
export async function markRfqRecipientViewed(recipientId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('rfq_recipients')
    .update({ status: 'viewed', last_viewed_at: new Date().toISOString() } as never)
    .eq('id', recipientId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/** Submit or update a supplier quote for an RFQ. */
export async function submitSupplierQuote(options: {
  rfqId: string;
  supplierId: string;
  deliveryDays?: number | null;
  validUntil?: string | null;
  notes?: string | null;
  items: Array<{
    rfq_item_id: string;
    unit_price_usd: number;
    unit_price_zwg: number;
    available_quantity: number;
    notes?: string | null;
  }>;
}): Promise<{ quote: RfqQuote | null; error: Error | null }> {
  const { rfqId, supplierId, deliveryDays, validUntil, notes, items } = options;

  const totalUsd = items.reduce((sum, item) => sum + Number(item.unit_price_usd) * Number(item.available_quantity), 0);
  const totalZwg = items.reduce((sum, item) => sum + Number(item.unit_price_zwg) * Number(item.available_quantity), 0);

  const quotePayload: RfqQuoteInsert = {
    rfq_id: rfqId,
    supplier_id: supplierId,
    total_usd: Number(totalUsd.toFixed(2)),
    total_zwg: Number(totalZwg.toFixed(2)),
    delivery_days: deliveryDays || null,
    valid_until: validUntil || null,
    notes: notes || null,
    status: 'submitted',
  };

  const { data: quote, error: quoteError } = await supabase
    .from('rfq_quotes')
    .upsert(quotePayload as never, { onConflict: 'rfq_id,supplier_id' })
    .select('*')
    .single();

  if (quoteError) {
    return { quote: null, error: new Error(quoteError.message) };
  }

  const quoteId = (quote as RfqQuote).id;

  // ERR-001 FIX: Add error handling for quote items delete (when updating quote)
  const { error: deleteError } = await supabase.from('rfq_quote_items').delete().eq('quote_id', quoteId);
  if (deleteError) {
    logAsyncError('Delete existing quote items', deleteError);
    // Continue - this is non-critical if items didn't exist previously
  }

  const quoteItemsPayload: RfqQuoteItemInsert[] = items.map((item) => ({
    quote_id: quoteId,
    rfq_item_id: item.rfq_item_id,
    unit_price_usd: item.unit_price_usd,
    unit_price_zwg: item.unit_price_zwg,
    available_quantity: item.available_quantity,
    notes: item.notes || null,
  }));

  if (quoteItemsPayload.length > 0) {
    const { error: itemError } = await supabase
      .from('rfq_quote_items')
      .insert(quoteItemsPayload as never);

    if (itemError) {
      return { quote: quote as RfqQuote, error: new Error(itemError.message) };
    }
  }

  // ERR-001 FIX: Add error handling for status updates
  const { error: recipientUpdateError } = await supabase.from('rfq_recipients')
    .update({ status: 'quoted' } as never)
    .eq('rfq_id', rfqId)
    .eq('supplier_id', supplierId);

  if (recipientUpdateError) {
    logAsyncError('Update recipient status to quoted', recipientUpdateError);
  }

  const { error: rfqUpdateError } = await supabase.from('rfq_requests')
    .update({ status: 'quoted' } as never)
    .eq('id', rfqId)
    .neq('status', 'accepted');

  if (rfqUpdateError) {
    logAsyncError('Update RFQ status to quoted', rfqUpdateError);
  }

  try {
    const { data: rfqRow } = await supabase
      .from('rfq_requests')
      .select('user_id, project_id, project:projects(name)')
      .eq('id', rfqId)
      .single();

    const { data: supplierRow } = await supabase
      .from('suppliers')
      .select('name, contact_phone, contact_email')
      .eq('id', supplierId)
      .is('deleted_at', null)
      .single();

    const builderUserId = (rfqRow as { user_id?: string | null } | null)?.user_id;
    if (builderUserId) {
      const { data: builderPrefs } = await supabase
        .from('profiles')
        .select('notify_email, notify_whatsapp, notify_quote_updates, phone_number')
        .eq('id', builderUserId)
        .single();

      const allowUpdates = builderPrefs?.notify_quote_updates ?? true;
      const channels: Array<'email' | 'whatsapp'> = [];
      if (allowUpdates && (builderPrefs?.notify_email ?? true)) channels.push('email');
      if (allowUpdates && (builderPrefs?.notify_whatsapp ?? false) && builderPrefs?.phone_number) channels.push('whatsapp');

      const projectName = (rfqRow as { project?: { name?: string | null } } | null)?.project?.name || 'Project';
      const templateData = {
        rfqId,
        projectName,
        supplierName: (supplierRow as { name?: string | null } | null)?.name || 'Supplier',
      };

      const deliveryLogs = channels.map((channel) => {
        const message = renderNotificationTemplate('quote_submitted', channel, templateData);
        return {
          user_id: builderUserId,
          channel,
          template_key: 'quote_submitted',
          payload: {
            rfq_id: rfqId,
            project_id: (rfqRow as { project_id?: string | null } | null)?.project_id,
            title: message.title,
            body: message.body,
            supplier_name: templateData.supplierName,
            supplier_email: (supplierRow as { contact_email?: string | null } | null)?.contact_email,
            supplier_phone: (supplierRow as { contact_phone?: string | null } | null)?.contact_phone,
          },
        };
      });

      // ERR-001 FIX: Add error handling for delivery logs insert
      if (deliveryLogs.length > 0) {
        const { error: deliveryInsertError } = await supabase.from('notification_deliveries').insert(deliveryLogs as never);
        if (deliveryInsertError) {
          logAsyncError('Insert quote notification delivery log', deliveryInsertError);
        }
      }
    }
  } catch (error) {
    logAsyncError('Log quote notification', error);
  }

  return { quote: quote as RfqQuote, error: null };
}

/** Accept a supplier quote and update RFQ status. */
export async function acceptRfqQuote(options: {
  rfqId: string;
  quoteId: string;
}): Promise<{ error: Error | null }> {
  const { rfqId, quoteId } = options;

  const { error: acceptError } = await supabase
    .from('rfq_quotes')
    .update({ status: 'accepted' } as never)
    .eq('id', quoteId);

  if (acceptError) {
    return { error: new Error(acceptError.message) };
  }

  // ERR-001 FIX: Add error handling for rejecting other quotes
  const { error: rejectOthersError } = await supabase
    .from('rfq_quotes')
    .update({ status: 'rejected' } as never)
    .eq('rfq_id', rfqId)
    .neq('id', quoteId);

  if (rejectOthersError) {
    logAsyncError('Reject non-accepted quotes', rejectOthersError);
  }

  const { error: rfqError } = await supabase
    .from('rfq_requests')
    .update({ status: 'accepted', accepted_quote_id: quoteId } as never)
    .eq('id', rfqId);

  if (rfqError) {
    return { error: new Error(rfqError.message) };
  }

  try {
    const { data: quoteRow } = await supabase
      .from('rfq_quotes')
      .select('supplier_id')
      .eq('id', quoteId)
      .single();

    const supplierId = (quoteRow as { supplier_id?: string | null } | null)?.supplier_id;
    if (supplierId) {
      const { data: supplierRow } = await supabase
        .from('suppliers')
        .select('name, user_id, contact_phone, contact_email')
        .eq('id', supplierId)
        .is('deleted_at', null)
        .single();

      const supplierUserId = (supplierRow as { user_id?: string | null } | null)?.user_id;
      if (supplierUserId) {
        const { data: supplierPrefs } = await supabase
          .from('profiles')
          .select('notify_email, notify_whatsapp, notify_quote_updates, phone_number')
          .eq('id', supplierUserId)
          .single();

        const allowUpdates = supplierPrefs?.notify_quote_updates ?? true;
        const channels: Array<'email' | 'whatsapp'> = [];
        if (allowUpdates && (supplierPrefs?.notify_email ?? true)) channels.push('email');
        if (allowUpdates && (supplierPrefs?.notify_whatsapp ?? false) && supplierPrefs?.phone_number) channels.push('whatsapp');

        const { data: projectRow } = await supabase
          .from('rfq_requests')
          .select('project:projects(name)')
          .eq('id', rfqId)
          .single();

        const projectName = (projectRow as { project?: { name?: string | null } } | null)?.project?.name || 'Project';
        const templateData = {
          rfqId,
          projectName,
        };

        const deliveryLogs = channels.map((channel) => {
          const message = renderNotificationTemplate('quote_accepted', channel, templateData);
          return {
            user_id: supplierUserId,
            channel,
            template_key: 'quote_accepted',
            payload: {
              rfq_id: rfqId,
              title: message.title,
              body: message.body,
              supplier_name: (supplierRow as { name?: string | null } | null)?.name || 'Supplier',
              supplier_email: (supplierRow as { contact_email?: string | null } | null)?.contact_email,
              supplier_phone: (supplierRow as { contact_phone?: string | null } | null)?.contact_phone,
            },
          };
        });

        // ERR-001 FIX: Add error handling for delivery logs insert
        if (deliveryLogs.length > 0) {
          const { error: deliveryInsertError } = await supabase.from('notification_deliveries').insert(deliveryLogs as never);
          if (deliveryInsertError) {
            logAsyncError('Insert acceptance notification delivery log', deliveryInsertError);
          }
        }
      }
    }
  } catch (error) {
    logAsyncError('Log acceptance notification', error);
  }

  return { error: null };
}
