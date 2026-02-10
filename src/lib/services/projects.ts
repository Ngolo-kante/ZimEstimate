import { supabase } from '@/lib/supabase';
import {
    Project,
    ProjectInsert,
    ProjectUpdate,
    BOQItem,
    BOQItemInsert,
    BOQItemUpdate,
    ProjectScope,
    LaborPreference,
    ProjectStatus,
    ProjectDocument,
    ProjectDocumentInsert,
    MaterialUsage,
    MaterialUsageInsert,
    ProjectRecurringReminder,
    ProjectRecurringReminderInsert,
    ProjectRecurringReminderUpdate,
    ProjectNotification,
    ProjectNotificationInsert,
    ProcurementRequest,
    ProcurementRequestInsert,
    ProcurementRequestUpdate,
    PurchaseRecord,
    PurchaseRecordInsert,
    PurchaseRecordUpdate,
    Supplier,
    SupplierInsert,
    SupplierUpdate,
    PriceWeekly,
    ProjectShare,
    DocumentCategory,
    SavingsFrequency,
    AccessLevel,
} from '@/lib/database.types';

// Type-safe wrapper to bypass strict Supabase types until regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// PROJECT CRUD OPERATIONS
// ============================================

/** Create a new project for the authenticated user. */
export async function createProject(data: {
    name: string;
    location?: string;
    description?: string;
    scope?: ProjectScope;
    labor_preference?: LaborPreference;
    selected_stages?: string[] | null;
    usage_tracking_enabled?: boolean;
}): Promise<{ project: Project | null; error: Error | null }> {
    const { data: { user } } = await db.auth.getUser();

    if (!user) {
        return { project: null, error: new Error('Not authenticated') };
    }

    const projectData: ProjectInsert = {
        owner_id: user.id,
        name: data.name,
        location: data.location || null,
        description: data.description || null,
        scope: data.scope || 'entire_house',
        labor_preference: data.labor_preference || 'materials_only',
        status: 'draft',
        selected_stages: data.selected_stages ?? null,
        usage_tracking_enabled: data.usage_tracking_enabled ?? false,
        total_usd: 0,
        total_zwg: 0,
    };

    const { data: project, error } = await db
        .from('projects')
        .insert(projectData)
        .select()
        .single();

    if (error) {
        return { project: null, error: new Error(error.message) };
    }

    return { project, error: null };
}

/** Fetch a single project by id. */
export async function getProject(projectId: string): Promise<{ project: Project | null; error: Error | null }> {
    const { data: project, error } = await db
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

    if (error) {
        return { project: null, error: new Error(error.message) };
    }

    return { project, error: null };
}

/** Fetch projects for the current user with optional filters. */
export async function getProjects(options?: {
    status?: ProjectStatus;
    limit?: number;
    offset?: number;
}): Promise<{ projects: Project[]; error: Error | null }> {
    let query = db
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

    if (options?.status) {
        query = query.eq('status', options.status);
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data: projects, error } = await query;

    if (error) {
        return { projects: [], error: new Error(error.message) };
    }

    return { projects: projects || [], error: null };
}

/** Update a project by id. */
export async function updateProject(
    projectId: string,
    updates: ProjectUpdate
): Promise<{ project: Project | null; error: Error | null }> {
    const { data: project, error } = await db
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();

    if (error) {
        return { project: null, error: new Error(error.message) };
    }

    return { project, error: null };
}

/** Permanently delete a project by id. */
export async function deleteProject(projectId: string): Promise<{ error: Error | null }> {
    // First delete all BOQ items associated with this project
    const { error: itemsError } = await deleteBOQItems(projectId);
    if (itemsError) {
        return { error: itemsError };
    }

    // Then delete the project itself
    const { error } = await db
        .from('projects')
        .delete()
        .eq('id', projectId);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

/** Archive a project by id. */
export async function archiveProject(projectId: string): Promise<{ project: Project | null; error: Error | null }> {
    return updateProject(projectId, { status: 'archived' });
}

/** Restore an archived project by id. */
export async function unarchiveProject(projectId: string): Promise<{ project: Project | null; error: Error | null }> {
    return updateProject(projectId, { status: 'draft' });
}

// ============================================
// BOQ ITEMS CRUD OPERATIONS
// ============================================

/** Fetch BOQ items for a project. */
export async function getBOQItems(projectId: string): Promise<{ items: BOQItem[]; error: Error | null }> {
    const { data: items, error } = await db
        .from('boq_items')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

    if (error) {
        return { items: [], error: new Error(error.message) };
    }

    return { items: items || [], error: null };
}

/** Add a single BOQ item to a project. */
export async function addBOQItem(data: BOQItemInsert): Promise<{ item: BOQItem | null; error: Error | null }> {
    const { data: item, error } = await db
        .from('boq_items')
        .insert(data)
        .select()
        .single();

    if (error) {
        return { item: null, error: new Error(error.message) };
    }

    return { item, error: null };
}

/** Add multiple BOQ items in bulk. */
export async function addBOQItems(items: BOQItemInsert[]): Promise<{ items: BOQItem[]; error: Error | null }> {
    if (items.length === 0) {
        return { items: [], error: null };
    }

    const { data: addedItems, error } = await db
        .from('boq_items')
        .insert(items)
        .select();

    if (error) {
        return { items: [], error: new Error(error.message) };
    }

    return { items: addedItems || [], error: null };
}

/** Update a BOQ item by id. */
export async function updateBOQItem(
    itemId: string,
    updates: BOQItemUpdate
): Promise<{ item: BOQItem | null; error: Error | null }> {
    const dbUpdates = { ...updates } as BOQItemUpdate;
    delete dbUpdates.total_usd;
    delete dbUpdates.total_zwg;
    const { data: item, error } = await db
        .from('boq_items')
        .update(dbUpdates)
        .eq('id', itemId)
        .select()
        .single();

    if (error) {
        return { item: null, error: new Error(error.message) };
    }

    return { item, error: null };
}

/** Delete a BOQ item by id. */
export async function deleteBOQItem(itemId: string): Promise<{ error: Error | null }> {
    const { error } = await db
        .from('boq_items')
        .delete()
        .eq('id', itemId);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

/** Delete all BOQ items for a project. */
export async function deleteBOQItems(projectId: string): Promise<{ error: Error | null }> {
    const { error } = await db
        .from('boq_items')
        .delete()
        .eq('project_id', projectId);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

// ============================================
// COMBINED OPERATIONS
// ============================================

/** Fetch a project and its BOQ items. */
export async function getProjectWithItems(projectId: string): Promise<{
    project: Project | null;
    items: BOQItem[];
    error: Error | null;
}> {
    const [projectResult, itemsResult] = await Promise.all([
        getProject(projectId),
        getBOQItems(projectId),
    ]);

    if (projectResult.error) {
        return { project: null, items: [], error: projectResult.error };
    }

    if (itemsResult.error) {
        return { project: projectResult.project, items: [], error: itemsResult.error };
    }

    return {
        project: projectResult.project,
        items: itemsResult.items,
        error: null,
    };
}

/** Save a project and replace its BOQ items. */
export async function saveProjectWithItems(
    projectId: string,
    projectUpdates: ProjectUpdate,
    items: Array<{
        id?: string;
        material_id: string;
        material_name: string;
        category: string;
        quantity: number;
        unit: string;
        unit_price_usd: number;
        unit_price_zwg: number;
        notes?: string;
        sort_order: number;
    }>
): Promise<{ project: Project | null; items: BOQItem[]; error: Error | null }> {
    // Update project
    const { project, error: projectError } = await updateProject(projectId, projectUpdates);

    if (projectError) {
        return { project: null, items: [], error: projectError };
    }

    // Delete existing items and insert new ones (simpler than diffing)
    const { error: deleteError } = await deleteBOQItems(projectId);

    if (deleteError) {
        return { project, items: [], error: deleteError };
    }

    // Insert new items
    const itemsToInsert: BOQItemInsert[] = items.map((item, index) => ({
        project_id: projectId,
        material_id: item.material_id,
        material_name: item.material_name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        unit_price_usd: item.unit_price_usd,
        unit_price_zwg: item.unit_price_zwg,
        notes: item.notes || null,
        sort_order: item.sort_order ?? index,
    }));

    const { items: savedItems, error: itemsError } = await addBOQItems(itemsToInsert);

    if (itemsError) {
        return { project, items: [], error: itemsError };
    }

    return { project, items: savedItems, error: null };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/** Determine if the current user can create another project based on tier limits. */
export async function canUserCreateProject(): Promise<boolean> {
    const { data: { user } } = await db.auth.getUser();

    if (!user) return false;

    // Get user's tier
    const { data: profile } = await db
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();

    if (!profile) return false;

    // Pro and admin can create unlimited projects
    if (profile.tier === 'pro' || profile.tier === 'admin') {
        return true;
    }

    // Free users limited to 3 projects
    const { count } = await db
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .neq('status', 'archived');

    return (count || 0) < 3;
}

/** Duplicate an existing project with its BOQ items. */
export async function duplicateProject(projectId: string, newName?: string): Promise<{
    project: Project | null;
    error: Error | null;
}> {
    // Get original project and items
    const { project: original, items, error: fetchError } = await getProjectWithItems(projectId);

    if (fetchError || !original) {
        return { project: null, error: fetchError || new Error('Project not found') };
    }

    // Create new project
    const { project: newProject, error: createError } = await createProject({
        name: newName || `${original.name} (Copy)`,
        location: original.location || undefined,
        description: original.description || undefined,
        scope: original.scope,
        labor_preference: original.labor_preference,
        selected_stages: original.selected_stages ?? null,
        usage_tracking_enabled: original.usage_tracking_enabled ?? false,
    });

    if (createError || !newProject) {
        return { project: null, error: createError };
    }

    // Copy BOQ items
    if (items.length > 0) {
        const itemsToInsert: BOQItemInsert[] = items.map((item) => ({
            project_id: newProject.id,
            material_id: item.material_id,
            material_name: item.material_name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            unit_price_usd: item.unit_price_usd,
            unit_price_zwg: item.unit_price_zwg,
            notes: item.notes,
            sort_order: item.sort_order,
        }));

        await addBOQItems(itemsToInsert);
    }

    return { project: newProject, error: null };
}

// ============================================
// PURCHASE TRACKING OPERATIONS
// ============================================

/** Update purchase metadata for a BOQ item. */
export async function updateItemPurchase(
    itemId: string,
    purchaseData: {
        actual_quantity?: number | null;
        actual_price_usd?: number | null;
        is_purchased?: boolean;
        purchased_date?: string | null;
    }
): Promise<{ item: BOQItem | null; error: Error | null }> {
    return updateBOQItem(itemId, purchaseData);
}

/** Mark BOQ items as purchased and update totals. */
export async function markItemsPurchased(
    itemIds: string[],
    purchaseData?: {
        actual_quantity?: number;
        actual_price_usd?: number;
    }
): Promise<{ error: Error | null }> {
    const updates = {
        is_purchased: true,
        purchased_date: new Date().toISOString(),
        ...(purchaseData || {}),
    };

    const { error } = await db
        .from('boq_items')
        .update(updates)
        .in('id', itemIds);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

/** Fetch purchase stats for a project. */
export async function getProjectPurchaseStats(projectId: string): Promise<{
    totalItems: number;
    purchasedItems: number;
    estimatedTotal: number;
    actualSpent: number;
    remainingBudget: number;
    error: Error | null;
}> {
    const { items, error } = await getBOQItems(projectId);

    if (error) {
        return {
            totalItems: 0,
            purchasedItems: 0,
            estimatedTotal: 0,
            actualSpent: 0,
            remainingBudget: 0,
            error,
        };
    }

    const totalItems = items.length;
    const purchasedItems = items.filter(item => item.is_purchased).length;

    const estimatedTotal = items.reduce((sum, item) =>
        sum + (Number(item.quantity) * Number(item.unit_price_usd)), 0);

    const actualSpent = items
        .filter(item => item.is_purchased)
        .reduce((sum, item) => {
            const qty = item.actual_quantity ?? item.quantity;
            const price = item.actual_price_usd ?? item.unit_price_usd;
            return sum + (Number(qty) * Number(price));
        }, 0);

    return {
        totalItems,
        purchasedItems,
        estimatedTotal,
        actualSpent,
        remainingBudget: estimatedTotal - actualSpent,
        error: null,
    };
}

// ============================================
// REMINDER OPERATIONS
// ============================================

/** Create a one-off reminder for a project. */
export async function createReminder(data: {
    project_id: string;
    item_id?: string;
    reminder_type: 'material' | 'savings' | 'deadline' | 'usage';
    message: string;
    scheduled_date: string;
    phone_number: string;
}): Promise<{ reminder: { id: string } | null; error: Error | null }> {
    const { data: { user } } = await db.auth.getUser();

    if (!user) {
        return { reminder: null, error: new Error('Not authenticated') };
    }

    const { data: reminder, error } = await db
        .from('reminders')
        .insert({
            user_id: user.id,
            project_id: data.project_id,
            item_id: data.item_id || null,
            reminder_type: data.reminder_type,
            message: data.message,
            scheduled_date: data.scheduled_date,
            is_sent: false,
            phone_number: data.phone_number,
        })
        .select('id')
        .single();

    if (error) {
        return { reminder: null, error: new Error(error.message) };
    }

    return { reminder, error: null };
}

// ============================================
// RECURRING REMINDERS
// ============================================

/** Fetch the recurring reminder settings for a project. */
export async function getProjectRecurringReminder(
    projectId: string,
    userId: string,
    reminderType: 'savings' | 'usage' | 'material' | 'deadline'
): Promise<{ reminder: ProjectRecurringReminder | null; error: Error | null }> {
    const { data: reminder, error } = await db
        .from('project_recurring_reminders')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('reminder_type', reminderType)
        .maybeSingle();

    if (error) {
        return { reminder: null, error: new Error(error.message) };
    }

    return { reminder: reminder || null, error: null };
}

/** Create or replace recurring reminder settings. */
export async function upsertProjectRecurringReminder(
    data: ProjectRecurringReminderInsert
): Promise<{ reminder: ProjectRecurringReminder | null; error: Error | null }> {
    const { data: reminder, error } = await db
        .from('project_recurring_reminders')
        .upsert(data, { onConflict: 'project_id,user_id,reminder_type' })
        .select()
        .single();

    if (error) {
        return { reminder: null, error: new Error(error.message) };
    }

    return { reminder, error: null };
}

/** Update recurring reminder settings by id. */
export async function updateProjectRecurringReminder(
    reminderId: string,
    updates: ProjectRecurringReminderUpdate
): Promise<{ reminder: ProjectRecurringReminder | null; error: Error | null }> {
    const { data: reminder, error } = await db
        .from('project_recurring_reminders')
        .update(updates)
        .eq('id', reminderId)
        .select()
        .single();

    if (error) {
        return { reminder: null, error: new Error(error.message) };
    }

    return { reminder, error: null };
}

// ============================================
// PROJECT NOTIFICATIONS
// ============================================

/** Create a project notification for a user. */
export async function createProjectNotification(
    data: ProjectNotificationInsert
): Promise<{ notification: ProjectNotification | null; error: Error | null }> {
    const { data: notification, error } = await db
        .from('project_notifications')
        .insert(data)
        .select()
        .single();

    if (error) {
        return { notification: null, error: new Error(error.message) };
    }

    return { notification, error: null };
}

/** Fetch notifications for a user within a project. */
export async function getProjectNotifications(
    userId: string
): Promise<{ notifications: ProjectNotification[]; error: Error | null }> {
    const { data: notifications, error } = await db
        .from('project_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        return { notifications: [], error: new Error(error.message) };
    }

    return { notifications: notifications || [], error: null };
}

/** Mark a notification as read. */
export async function markNotificationRead(
    notificationId: string
): Promise<{ error: Error | null }> {
    const { error } = await db
        .from('project_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

/** Mark all notifications as read for a user and project. */
export async function markAllNotificationsRead(
    userId: string
): Promise<{ error: Error | null }> {
    const { error } = await db
        .from('project_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

/** Fetch the latest notification for a user and project. */
export async function getLatestProjectNotification(
    projectId: string,
    userId: string,
    type: string
): Promise<{ notification: ProjectNotification | null; error: Error | null }> {
    const { data: notification, error } = await db
        .from('project_notifications')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('type', type)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        return { notification: null, error: new Error(error.message) };
    }

    return { notification: notification || null, error: null };
}

/** Delete a project notification by id. */
export async function deleteProjectNotification(
    notificationId: string
): Promise<{ error: Error | null }> {
    const { error } = await db
        .from('project_notifications')
        .delete()
        .eq('id', notificationId);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

// ============================================
// PRICE LOOKUPS
// ============================================

/** Fetch latest weekly prices for a list of materials. */
export async function getLatestWeeklyPrices(materialCodes: string[]): Promise<{
    prices: Record<string, { priceUsd: number; lastUpdated: string; sourceUrl?: string | null }>;
    error: Error | null;
}> {
    if (materialCodes.length === 0) {
        return { prices: {}, error: null };
    }

    const { data, error } = await db
        .from('price_weekly')
        .select('material_key, avg_price_usd, week_start, last_scraped_at, updated_at')
        .in('material_key', materialCodes)
        .order('week_start', { ascending: false });

    if (error) {
        return { prices: {}, error: new Error(error.message) };
    }

    const prices: Record<string, { priceUsd: number; lastUpdated: string; sourceUrl?: string | null }> = {};

    (data as PriceWeekly[] | null)?.forEach((row) => {
        if (!row.material_key || row.avg_price_usd === null) return;
        if (!prices[row.material_key]) {
            prices[row.material_key] = {
                priceUsd: Number(row.avg_price_usd),
                lastUpdated: row.last_scraped_at || row.updated_at,
            };
        }
    });

    return { prices, error: null };
}

// ============================================
// PROCUREMENT REQUESTS
// ============================================

/** Create a procurement request. */
export async function createProcurementRequest(
    data: ProcurementRequestInsert
): Promise<{ request: ProcurementRequest | null; error: Error | null }> {
    const { data: request, error } = await db
        .from('procurement_requests')
        .insert(data)
        .select()
        .single();

    if (error) {
        return { request: null, error: new Error(error.message) };
    }

    return { request, error: null };
}

/** Fetch procurement requests for a project. */
export async function getProcurementRequests(
    projectId: string
): Promise<{ requests: ProcurementRequest[]; error: Error | null }> {
    const { data: requests, error } = await db
        .from('procurement_requests')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (error) {
        return { requests: [], error: new Error(error.message) };
    }

    return { requests: requests || [], error: null };
}

/** Update a procurement request by id. */
export async function updateProcurementRequest(
    requestId: string,
    updates: ProcurementRequestUpdate
): Promise<{ request: ProcurementRequest | null; error: Error | null }> {
    const { data: request, error } = await db
        .from('procurement_requests')
        .update(updates)
        .eq('id', requestId)
        .select()
        .single();

    if (error) {
        return { request: null, error: new Error(error.message) };
    }

    return { request, error: null };
}

// ============================================
// PURCHASE RECORDS
// ============================================

/** Fetch purchase records for a project. */
export async function getPurchaseRecords(projectId: string): Promise<{
    records: PurchaseRecord[];
    error: Error | null;
}> {
    const { data: records, error } = await db
        .from('purchase_records')
        .select('*')
        .eq('project_id', projectId)
        .order('purchased_at', { ascending: false });

    if (error) {
        return { records: [], error: new Error(error.message) };
    }

    return { records: records || [], error: null };
}

/** Create a new purchase record. */
export async function createPurchaseRecord(
    data: Omit<PurchaseRecordInsert, 'created_by'>
): Promise<{ record: PurchaseRecord | null; error: Error | null }> {
    const { data: { user } } = await db.auth.getUser();
    if (!user) {
        return { record: null, error: new Error('Not authenticated') };
    }

    const payload: PurchaseRecordInsert = {
        ...data,
        created_by: user.id,
    };

    const { data: record, error } = await db
        .from('purchase_records')
        .insert(payload)
        .select()
        .single();

    if (error) {
        return { record: null, error: new Error(error.message) };
    }

    return { record, error: null };
}

/** Update a purchase record by id. */
export async function updatePurchaseRecord(
    recordId: string,
    updates: PurchaseRecordUpdate
): Promise<{ record: PurchaseRecord | null; error: Error | null }> {
    const { data: record, error } = await db
        .from('purchase_records')
        .update(updates)
        .eq('id', recordId)
        .select()
        .single();

    if (error) {
        return { record: null, error: new Error(error.message) };
    }

    return { record, error: null };
}

/** Delete a purchase record by id. */
export async function deletePurchaseRecord(recordId: string): Promise<{ error: Error | null }> {
    const { error } = await db
        .from('purchase_records')
        .delete()
        .eq('id', recordId);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

// ============================================
// SUPPLIERS
// ============================================

/** Fetch active suppliers for procurement workflows. */
export async function getSuppliers(): Promise<{ suppliers: Supplier[]; error: Error | null }> {
    const { data: suppliers, error } = await db
        .from('suppliers')
        .select('*')
        .is('deleted_at', null)
        .order('name', { ascending: true });

    if (error) {
        return { suppliers: [], error: new Error(error.message) };
    }

    return { suppliers: suppliers || [], error: null };
}

/** Create a supplier record. */
export async function createSupplier(
    data: SupplierInsert
): Promise<{ supplier: Supplier | null; error: Error | null }> {
    const { data: supplier, error } = await db
        .from('suppliers')
        .insert(data)
        .select()
        .single();

    if (error) {
        return { supplier: null, error: new Error(error.message) };
    }

    return { supplier, error: null };
}

/** Update a supplier record. */
export async function updateSupplier(
    supplierId: string,
    updates: SupplierUpdate
): Promise<{ supplier: Supplier | null; error: Error | null }> {
    const { data: supplier, error } = await db
        .from('suppliers')
        .update(updates)
        .eq('id', supplierId)
        .is('deleted_at', null)
        .select()
        .single();

    if (error) {
        return { supplier: null, error: new Error(error.message) };
    }

    return { supplier, error: null };
}

/** Soft-delete a supplier by id. */
export async function deleteSupplier(supplierId: string): Promise<{ error: Error | null }> {
    const { error } = await db
        .from('suppliers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', supplierId)
        .is('deleted_at', null);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

/** Fetch reminders for a project. */
export async function getReminders(projectId: string): Promise<{
    reminders: Array<{
        id: string;
        reminder_type: string;
        message: string;
        scheduled_date: string;
        is_sent: boolean;
    }>;
    error: Error | null;
}> {
    const { data: reminders, error } = await db
        .from('reminders')
        .select('id, reminder_type, message, scheduled_date, is_sent')
        .eq('project_id', projectId)
        .order('scheduled_date', { ascending: true });

    if (error) {
        return { reminders: [], error: new Error(error.message) };
    }

    return { reminders: reminders || [], error: null };
}

/** Delete a reminder by id. */
export async function deleteReminder(reminderId: string): Promise<{ error: Error | null }> {
    const { error } = await db
        .from('reminders')
        .delete()
        .eq('id', reminderId);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

// Generate WhatsApp message link for reminders
/** Build a WhatsApp deeplink for a reminder message. */
export function generateWhatsAppReminderLink(
    phoneNumber: string,
    message: string
): string {
    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phoneNumber.replace(/[\s-()]/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

// ============================================
// DASHBOARD AGGREGATION OPERATIONS
// ============================================

/** Fetch all reminders across projects. */
export async function getAllReminders(): Promise<{
    reminders: Array<{
        id: string;
        project_id: string;
        project_name?: string;
        reminder_type: string;
        message: string;
        scheduled_date: string;
        is_sent: boolean;
    }>;
    error: Error | null;
}> {
    const { data: { user } } = await db.auth.getUser();

    if (!user) {
        return { reminders: [], error: new Error('Not authenticated') };
    }

    const { data: reminders, error } = await db
        .from('reminders')
        .select(`
            id,
            project_id,
            reminder_type,
            message,
            scheduled_date,
            is_sent,
            projects!inner(name)
        `)
        .eq('user_id', user.id)
        .eq('is_sent', false)
        .order('scheduled_date', { ascending: true })
        .limit(10);

    if (error) {
        return { reminders: [], error: new Error(error.message) };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedReminders = (reminders || []).map((r: any) => ({
        id: r.id,
        project_id: r.project_id,
        project_name: r.projects?.name,
        reminder_type: r.reminder_type,
        message: r.message,
        scheduled_date: r.scheduled_date,
        is_sent: r.is_sent,
    }));

    return { reminders: formattedReminders, error: null };
}

/** Aggregate budget stats across projects. */
export async function getAggregatedBudgetStats(): Promise<{
    totalBudget: number;
    totalSpent: number;
    variance: number;
    projectCount: number;
    error: Error | null;
}> {
    const { projects, error: projectsError } = await getProjects();

    if (projectsError) {
        return { totalBudget: 0, totalSpent: 0, variance: 0, projectCount: 0, error: projectsError };
    }

    const activeProjects = projects.filter(p => p.status !== 'archived');
    let totalBudget = 0;
    let totalSpent = 0;

    for (const project of activeProjects) {
        const stats = await getProjectPurchaseStats(project.id);
        totalBudget += stats.estimatedTotal;
        totalSpent += stats.actualSpent;
    }

    return {
        totalBudget,
        totalSpent,
        variance: totalBudget - totalSpent,
        projectCount: activeProjects.length,
        error: null,
    };
}

/** Fetch project counts grouped by status. */
export async function getProjectsGroupedByStatus(): Promise<{
    active: Project[];
    draft: Project[];
    completed: Project[];
    error: Error | null;
}> {
    const { projects, error } = await getProjects();

    if (error) {
        return { active: [], draft: [], completed: [], error };
    }

    return {
        active: projects.filter(p => p.status === 'active'),
        draft: projects.filter(p => p.status === 'draft'),
        completed: projects.filter(p => p.status === 'completed'),
        error: null,
    };
}

// ============================================
// DOCUMENT OPERATIONS
// ============================================

/** Upload a document to project storage. */
export async function uploadDocument(
    projectId: string,
    file: File,
    category: DocumentCategory = 'general',
    description?: string
): Promise<{ document: ProjectDocument | null; error: Error | null }> {
    const { data: { user } } = await db.auth.getUser();

    if (!user) {
        return { document: null, error: new Error('Not authenticated') };
    }

    // Generate unique storage path
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storagePath = `${projectId}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await db.storage
        .from('project-documents')
        .upload(storagePath, file);

    if (uploadError) {
        return { document: null, error: new Error(uploadError.message) };
    }

    // Create database record
    const documentData: ProjectDocumentInsert = {
        project_id: projectId,
        uploaded_by: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        category,
        description: description || null,
    };

    const { data: document, error: dbError } = await db
        .from('project_documents')
        .insert(documentData)
        .select()
        .single();

    if (dbError) {
        // Clean up storage if DB insert fails
        await db.storage.from('project-documents').remove([storagePath]);
        return { document: null, error: new Error(dbError.message) };
    }

    return { document, error: null };
}

/** Fetch documents for a project. */
export async function getProjectDocuments(
    projectId: string,
    category?: DocumentCategory
): Promise<{ documents: ProjectDocument[]; error: Error | null }> {
    let query = db
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (category) {
        query = query.eq('category', category);
    }

    const { data: documents, error } = await query;

    if (error) {
        return { documents: [], error: new Error(error.message) };
    }

    return { documents: documents || [], error: null };
}

/** Delete a project document and storage blob. */
export async function deleteDocument(documentId: string): Promise<{ error: Error | null }> {
    // Get document to find storage path
    const { data: document, error: fetchError } = await db
        .from('project_documents')
        .select('storage_path')
        .eq('id', documentId)
        .single();

    if (fetchError) {
        return { error: new Error(fetchError.message) };
    }

    // Delete from storage
    if (document?.storage_path) {
        await db.storage.from('project-documents').remove([document.storage_path]);
    }

    // Delete from database
    const { error } = await db
        .from('project_documents')
        .delete()
        .eq('id', documentId);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

/** Create a signed URL for a stored document. */
export async function getDocumentUrl(storagePath: string): Promise<string | null> {
    const { data } = await db.storage
        .from('project-documents')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

    return data?.signedUrl || null;
}

// ============================================
// USAGE TRACKING OPERATIONS
// ============================================

/** Record material usage against a BOQ item. */
export async function recordUsage(
    projectId: string,
    boqItemId: string,
    quantity: number,
    date: string,
    notes?: string
): Promise<{ usage: MaterialUsage | null; error: Error | null }> {
    const { data: { user } } = await db.auth.getUser();

    if (!user) {
        return { usage: null, error: new Error('Not authenticated') };
    }

    const usageData: MaterialUsageInsert = {
        project_id: projectId,
        boq_item_id: boqItemId,
        recorded_by: user.id,
        quantity_used: quantity,
        usage_date: date,
        notes: notes || null,
    };

    const { data: usage, error } = await db
        .from('material_usage')
        .insert(usageData)
        .select()
        .single();

    if (error) {
        return { usage: null, error: new Error(error.message) };
    }

    return { usage, error: null };
}

/** Fetch usage history for a project. */
export async function getUsageHistory(projectId: string): Promise<{
    usage: MaterialUsage[];
    error: Error | null;
}> {
    const { data: usage, error } = await db
        .from('material_usage')
        .select('*')
        .eq('project_id', projectId)
        .order('usage_date', { ascending: false });

    if (error) {
        return { usage: [], error: new Error(error.message) };
    }

    return { usage: usage || [], error: null };
}

/** Summarize usage for a BOQ item. */
export async function getItemUsageSummary(boqItemId: string): Promise<{
    totalUsed: number;
    records: MaterialUsage[];
    error: Error | null;
}> {
    const { data: records, error } = await db
        .from('material_usage')
        .select('*')
        .eq('boq_item_id', boqItemId)
        .order('usage_date', { ascending: false });

    if (error) {
        return { totalUsed: 0, records: [], error: new Error(error.message) };
    }

    const totalUsed = (records || []).reduce((sum: number, r: { quantity_used: number }) => sum + Number(r.quantity_used), 0);

    return { totalUsed, records: records || [], error: null };
}

/** Aggregate usage totals by BOQ item for a project. */
export async function getTotalUsageByItem(projectId: string): Promise<{
    usageByItem: Record<string, number>;
    error: Error | null;
}> {
    const { data: usage, error } = await db
        .from('material_usage')
        .select('boq_item_id, quantity_used')
        .eq('project_id', projectId);

    if (error) {
        return { usageByItem: {}, error: new Error(error.message) };
    }

    const usageByItem: Record<string, number> = {};
    (usage || []).forEach((u: { boq_item_id: string; quantity_used: number }) => {
        usageByItem[u.boq_item_id] = (usageByItem[u.boq_item_id] || 0) + Number(u.quantity_used);
    });

    return { usageByItem, error: null };
}

/** Delete a usage record by id. */
export async function deleteUsageRecord(usageId: string): Promise<{ error: Error | null }> {
    const { error } = await db
        .from('material_usage')
        .delete()
        .eq('id', usageId);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

// ============================================
// SHARING OPERATIONS
// ============================================

/** Share a project with another user. */
export async function shareProject(
    projectId: string,
    email: string,
    accessLevel: AccessLevel = 'view'
): Promise<{ share: ProjectShare | null; error: Error | null }> {
    // Check if share already exists
    const { data: existing } = await db
        .from('project_shares')
        .select('*')
        .eq('project_id', projectId)
        .eq('shared_with_email', email)
        .single();

    if (existing) {
        return { share: null, error: new Error('Project already shared with this email') };
    }

    // Check if user exists with this email
    const { data: profile } = await db
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

    const shareData = {
        project_id: projectId,
        shared_with_email: email,
        shared_with_user_id: profile?.id || null,
        access_level: accessLevel,
    };

    const { data: share, error } = await db
        .from('project_shares')
        .insert(shareData)
        .select()
        .single();

    if (error) {
        return { share: null, error: new Error(error.message) };
    }

    return { share, error: null };
}

/** Fetch sharing records for a project. */
export async function getProjectShares(projectId: string): Promise<{
    shares: ProjectShare[];
    error: Error | null;
}> {
    const { data: shares, error } = await db
        .from('project_shares')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (error) {
        return { shares: [], error: new Error(error.message) };
    }

    return { shares: shares || [], error: null };
}

/** Update access level for a project share. */
export async function updateShareAccess(
    shareId: string,
    accessLevel: AccessLevel
): Promise<{ share: ProjectShare | null; error: Error | null }> {
    const { data: share, error } = await db
        .from('project_shares')
        .update({ access_level: accessLevel })
        .eq('id', shareId)
        .select()
        .single();

    if (error) {
        return { share: null, error: new Error(error.message) };
    }

    return { share, error: null };
}

/** Remove a project share by id. */
export async function removeShare(shareId: string): Promise<{ error: Error | null }> {
    const { error } = await db
        .from('project_shares')
        .delete()
        .eq('id', shareId);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

/** Fetch projects shared with the current user. */
export async function getSharedProjects(): Promise<{
    projects: Project[];
    error: Error | null;
}> {
    const { data: { user } } = await db.auth.getUser();

    if (!user) {
        return { projects: [], error: new Error('Not authenticated') };
    }

    // Get projects shared with current user
    const { data: shares, error: sharesError } = await db
        .from('project_shares')
        .select('project_id')
        .eq('shared_with_user_id', user.id);

    if (sharesError) {
        return { projects: [], error: new Error(sharesError.message) };
    }

    if (!shares || shares.length === 0) {
        return { projects: [], error: null };
    }

    const projectIds = shares.map((s: { project_id: string }) => s.project_id);

    const { data: projects, error } = await db
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .order('updated_at', { ascending: false });

    if (error) {
        return { projects: [], error: new Error(error.message) };
    }

    return { projects: projects || [], error: null };
}

// ============================================
// SAVINGS CALCULATOR
// ============================================

export interface SavingsPlan {
    targetDate: string;
    frequency: SavingsFrequency;
    totalRemaining: number;
    periodsRemaining: number;
    amountPerPeriod: number;
    periodLabel: string;
}

/** Calculate a savings plan based on project budget and schedule. */
export async function calculateSavingsPlan(
    projectId: string,
    targetDate: string,
    frequency: SavingsFrequency = 'monthly'
): Promise<{ plan: SavingsPlan | null; error: Error | null }> {
    // Get project budget stats
    const stats = await getProjectPurchaseStats(projectId);

    if (stats.error) {
        return { plan: null, error: stats.error };
    }

    const totalRemaining = stats.remainingBudget;
    const now = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        return { plan: null, error: new Error('Target date must be in the future') };
    }

    let periodsRemaining: number;
    let periodLabel: string;

    switch (frequency) {
        case 'weekly':
            periodsRemaining = Math.ceil(diffDays / 7);
            periodLabel = 'week';
            break;
        case 'quarterly':
            periodsRemaining = Math.ceil(diffDays / 90);
            periodLabel = 'quarter';
            break;
        case 'monthly':
        default:
            periodsRemaining = Math.ceil(diffDays / 30);
            periodLabel = 'month';
            break;
    }

    const amountPerPeriod = periodsRemaining > 0 ? totalRemaining / periodsRemaining : totalRemaining;

    // Update project with savings settings
    await updateProject(projectId, {
        target_completion_date: targetDate,
        savings_frequency: frequency,
    });

    return {
        plan: {
            targetDate,
            frequency,
            totalRemaining,
            periodsRemaining,
            amountPerPeriod,
            periodLabel,
        },
        error: null,
    };
}
