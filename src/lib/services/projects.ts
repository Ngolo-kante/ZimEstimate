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
} from '@/lib/database.types';

// Type-safe wrapper to bypass strict Supabase types until regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// PROJECT CRUD OPERATIONS
// ============================================

export async function createProject(data: {
    name: string;
    location?: string;
    description?: string;
    scope?: ProjectScope;
    labor_preference?: LaborPreference;
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

export async function archiveProject(projectId: string): Promise<{ project: Project | null; error: Error | null }> {
    return updateProject(projectId, { status: 'archived' });
}

export async function unarchiveProject(projectId: string): Promise<{ project: Project | null; error: Error | null }> {
    return updateProject(projectId, { status: 'draft' });
}

// ============================================
// BOQ ITEMS CRUD OPERATIONS
// ============================================

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

export async function updateBOQItem(
    itemId: string,
    updates: BOQItemUpdate
): Promise<{ item: BOQItem | null; error: Error | null }> {
    const { data: item, error } = await db
        .from('boq_items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();

    if (error) {
        return { item: null, error: new Error(error.message) };
    }

    return { item, error: null };
}

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

export async function createReminder(data: {
    project_id: string;
    item_id?: string;
    reminder_type: 'material' | 'savings' | 'deadline';
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
export function generateWhatsAppReminderLink(
    phoneNumber: string,
    message: string
): string {
    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phoneNumber.replace(/[\s-()]/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
