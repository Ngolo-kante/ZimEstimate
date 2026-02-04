import { supabase } from '@/lib/supabase';
import {
    ProjectStage,
    ProjectStageUpdate,
    StageTask,
    StageTaskInsert,
    StageTaskUpdate,
    ProjectStageWithTasks,
    BOQCategory,
    StageStatus,
    BOQItem,
} from '@/lib/database.types';

// Type-safe wrapper to bypass strict Supabase types until regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// STAGE OPERATIONS
// ============================================

export async function getProjectStages(projectId: string): Promise<{
    stages: ProjectStageWithTasks[];
    error: Error | null;
}> {
    const { data: stages, error } = await db
        .from('project_stages')
        .select(`
            *,
            stage_tasks (*)
        `)
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

    if (error) {
        return { stages: [], error: new Error(error.message) };
    }

    // Sort tasks within each stage
    const sortedStages = (stages || []).map((s: ProjectStage & { stage_tasks: StageTask[] }) => ({
        ...s,
        tasks: (s.stage_tasks || []).sort((a: StageTask, b: StageTask) => a.sort_order - b.sort_order),
    }));

    return { stages: sortedStages, error: null };
}

export async function getStage(stageId: string): Promise<{
    stage: ProjectStageWithTasks | null;
    error: Error | null;
}> {
    const { data: stage, error } = await db
        .from('project_stages')
        .select(`
            *,
            stage_tasks (*)
        `)
        .eq('id', stageId)
        .single();

    if (error) {
        return { stage: null, error: new Error(error.message) };
    }

    // Sort tasks
    const sortedStage = {
        ...stage,
        tasks: (stage.stage_tasks || []).sort((a: StageTask, b: StageTask) => a.sort_order - b.sort_order),
    };

    return { stage: sortedStage, error: null };
}

export async function updateStage(
    stageId: string,
    updates: ProjectStageUpdate
): Promise<{ stage: ProjectStage | null; error: Error | null }> {
    const { data: stage, error } = await db
        .from('project_stages')
        .update(updates)
        .eq('id', stageId)
        .select()
        .single();

    if (error) {
        return { stage: null, error: new Error(error.message) };
    }

    return { stage, error: null };
}

export async function getActiveStage(projectId: string): Promise<{
    stage: ProjectStageWithTasks | null;
    error: Error | null;
}> {
    // Get the first stage that is in_progress, or the first applicable stage
    const { data: stages, error } = await db
        .from('project_stages')
        .select(`
            *,
            stage_tasks (*)
        `)
        .eq('project_id', projectId)
        .eq('is_applicable', true)
        .order('sort_order', { ascending: true });

    if (error) {
        return { stage: null, error: new Error(error.message) };
    }

    if (!stages || stages.length === 0) {
        return { stage: null, error: null };
    }

    // Find in_progress stage or return first applicable
    const inProgressStage = stages.find((s: ProjectStage) => s.status === 'in_progress');
    const activeStage = inProgressStage || stages[0];

    const sortedStage = {
        ...activeStage,
        tasks: (activeStage.stage_tasks || []).sort((a: StageTask, b: StageTask) => a.sort_order - b.sort_order),
    };

    return { stage: sortedStage, error: null };
}

export async function getStageByCategory(
    projectId: string,
    category: BOQCategory
): Promise<{ stage: ProjectStageWithTasks | null; error: Error | null }> {
    const { data: stage, error } = await db
        .from('project_stages')
        .select(`
            *,
            stage_tasks (*)
        `)
        .eq('project_id', projectId)
        .eq('boq_category', category)
        .single();

    if (error) {
        return { stage: null, error: new Error(error.message) };
    }

    const sortedStage = {
        ...stage,
        tasks: (stage.stage_tasks || []).sort((a: StageTask, b: StageTask) => a.sort_order - b.sort_order),
    };

    return { stage: sortedStage, error: null };
}

export async function createDefaultStages(
    projectId: string,
    scope: string
): Promise<{ error: Error | null }> {
    const { error } = await db.rpc('create_default_stages', {
        p_project_id: projectId,
        p_scope: scope,
    });

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

export async function setProjectStagesApplicability(
    projectId: string,
    selectedStages: string[]
): Promise<{ error: Error | null }> {
    if (!selectedStages || selectedStages.length === 0) {
        return { error: null };
    }

    const { error: resetError } = await db
        .from('project_stages')
        .update({ is_applicable: false })
        .eq('project_id', projectId);

    if (resetError) {
        return { error: new Error(resetError.message) };
    }

    const { error: enableError } = await db
        .from('project_stages')
        .update({ is_applicable: true })
        .eq('project_id', projectId)
        .in('boq_category', selectedStages);

    if (enableError) {
        return { error: new Error(enableError.message) };
    }

    return { error: null };
}

// ============================================
// STAGE TASK OPERATIONS
// ============================================

export async function createStageTask(
    stageId: string,
    data: { title: string; description?: string; assigned_to?: string }
): Promise<{ task: StageTask | null; error: Error | null }> {
    // Get current max sort_order
    const { data: existing } = await db
        .from('stage_tasks')
        .select('sort_order')
        .eq('stage_id', stageId)
        .order('sort_order', { ascending: false })
        .limit(1);

    const nextOrder = (existing?.[0]?.sort_order || 0) + 1;

    const taskData: StageTaskInsert = {
        stage_id: stageId,
        title: data.title,
        description: data.description || null,
        assigned_to: data.assigned_to || null,
        sort_order: nextOrder,
        is_default: false,
        is_completed: false,
    };

    const { data: task, error } = await db
        .from('stage_tasks')
        .insert(taskData)
        .select()
        .single();

    if (error) {
        return { task: null, error: new Error(error.message) };
    }

    return { task, error: null };
}

export async function updateStageTask(
    taskId: string,
    updates: StageTaskUpdate
): Promise<{ task: StageTask | null; error: Error | null }> {
    const { data: task, error } = await db
        .from('stage_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

    if (error) {
        return { task: null, error: new Error(error.message) };
    }

    return { task, error: null };
}

export async function toggleStageTask(
    taskId: string,
    completed: boolean
): Promise<{ task: StageTask | null; error: Error | null }> {
    const { data: task, error } = await db
        .from('stage_tasks')
        .update({
            is_completed: completed,
            completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', taskId)
        .select()
        .single();

    if (error) {
        return { task: null, error: new Error(error.message) };
    }

    return { task, error: null };
}

export async function deleteStageTask(taskId: string): Promise<{ error: Error | null }> {
    const { error } = await db
        .from('stage_tasks')
        .delete()
        .eq('id', taskId);

    if (error) {
        return { error: new Error(error.message) };
    }

    return { error: null };
}

// ============================================
// STAGE BUDGET OPERATIONS
// ============================================

export interface StageBudgetStats {
    totalBudget: number;
    totalSpent: number;
    remaining: number;
    itemCount: number;
    purchasedCount: number;
    usagePercent: number;
}

export async function getStageBudgetStats(
    projectId: string,
    boqCategory: BOQCategory
): Promise<{ stats: StageBudgetStats; error: Error | null }> {
    // Get BOQ items for this category
    const { data: items, error } = await db
        .from('boq_items')
        .select('*')
        .eq('project_id', projectId)
        .eq('category', boqCategory);

    if (error) {
        return {
            stats: { totalBudget: 0, totalSpent: 0, remaining: 0, itemCount: 0, purchasedCount: 0, usagePercent: 0 },
            error: new Error(error.message),
        };
    }

    const boqItems = items || [];
    const itemCount = boqItems.length;
    const purchasedCount = boqItems.filter((i: BOQItem) => i.is_purchased).length;

    const totalBudget = boqItems.reduce((sum: number, item: BOQItem) =>
        sum + (Number(item.quantity) * Number(item.unit_price_usd)), 0);

    const totalSpent = boqItems
        .filter((item: BOQItem) => item.is_purchased)
        .reduce((sum: number, item: BOQItem) => {
            const qty = item.actual_quantity ?? item.quantity;
            const price = item.actual_price_usd ?? item.unit_price_usd;
            return sum + (Number(qty) * Number(price));
        }, 0);

    return {
        stats: {
            totalBudget,
            totalSpent,
            remaining: totalBudget - totalSpent,
            itemCount,
            purchasedCount,
            usagePercent: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
        },
        error: null,
    };
}

export async function getBOQItemsByCategory(
    projectId: string,
    category: BOQCategory
): Promise<{ items: BOQItem[]; error: Error | null }> {
    const { data: items, error } = await db
        .from('boq_items')
        .select('*')
        .eq('project_id', projectId)
        .eq('category', category)
        .order('sort_order', { ascending: true });

    if (error) {
        return { items: [], error: new Error(error.message) };
    }

    return { items: items || [], error: null };
}

// ============================================
// STAGE PROGRESS HELPERS
// ============================================

export interface StageProgress {
    stageId: string;
    boqCategory: BOQCategory;
    name: string;
    status: StageStatus;
    taskProgress: { completed: number; total: number };
    budgetProgress: { spent: number; total: number };
    isApplicable: boolean;
}

export async function getAllStagesProgress(projectId: string): Promise<{
    progress: StageProgress[];
    error: Error | null;
}> {
    const { stages, error } = await getProjectStages(projectId);

    if (error) {
        return { progress: [], error };
    }

    const progressPromises = stages.map(async (stage) => {
        const { stats } = await getStageBudgetStats(projectId, stage.boq_category);
        const completedTasks = stage.tasks.filter(t => t.is_completed).length;

        return {
            stageId: stage.id,
            boqCategory: stage.boq_category,
            name: stage.name,
            status: stage.status,
            taskProgress: { completed: completedTasks, total: stage.tasks.length },
            budgetProgress: { spent: stats.totalSpent, total: stats.totalBudget },
            isApplicable: stage.is_applicable,
        };
    });

    const progress = await Promise.all(progressPromises);
    return { progress, error: null };
}

// ============================================
// STAGE USAGE HELPERS
// ============================================

export async function getStageUsageData(
    projectId: string,
    boqCategory: BOQCategory
): Promise<{
    usageByItem: Record<string, number>;
    items: BOQItem[];
    error: Error | null;
}> {
    // Get BOQ items for this category
    const { items, error: itemsError } = await getBOQItemsByCategory(projectId, boqCategory);
    if (itemsError) {
        return { usageByItem: {}, items: [], error: itemsError };
    }

    if (items.length === 0) {
        return { usageByItem: {}, items: [], error: null };
    }

    // Get usage records for these items
    const itemIds = items.map(i => i.id);
    const { data: usage, error: usageError } = await db
        .from('material_usage')
        .select('boq_item_id, quantity_used')
        .in('boq_item_id', itemIds);

    if (usageError) {
        return { usageByItem: {}, items, error: new Error(usageError.message) };
    }

    const usageByItem: Record<string, number> = {};
    (usage || []).forEach((u: { boq_item_id: string; quantity_used: number }) => {
        usageByItem[u.boq_item_id] = (usageByItem[u.boq_item_id] || 0) + Number(u.quantity_used);
    });

    return { usageByItem, items, error: null };
}

// ============================================
// SAVINGS CALCULATION
// ============================================

export interface StageSavingsPlan {
    targetDate: string | null;
    totalRemaining: number;
    weeksRemaining: number;
    weeklyTarget: number;
    monthlyTarget: number;
}

export async function calculateStageSavingsPlan(
    projectId: string,
    stageId: string
): Promise<{ plan: StageSavingsPlan | null; error: Error | null }> {
    // Get stage details
    const { stage, error: stageError } = await getStage(stageId);
    if (stageError || !stage) {
        return { plan: null, error: stageError || new Error('Stage not found') };
    }

    // Get budget stats for this stage
    const { stats, error: statsError } = await getStageBudgetStats(projectId, stage.boq_category);
    if (statsError) {
        return { plan: null, error: statsError };
    }

    const totalRemaining = stats.remaining;
    const targetDate = stage.end_date;

    if (!targetDate) {
        return {
            plan: {
                targetDate: null,
                totalRemaining,
                weeksRemaining: 0,
                weeklyTarget: 0,
                monthlyTarget: 0,
            },
            error: null,
        };
    }

    const now = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weeksRemaining = Math.max(1, Math.ceil(diffDays / 7));
    const monthsRemaining = Math.max(1, Math.ceil(diffDays / 30));

    return {
        plan: {
            targetDate,
            totalRemaining,
            weeksRemaining,
            weeklyTarget: totalRemaining / weeksRemaining,
            monthlyTarget: totalRemaining / monthsRemaining,
        },
        error: null,
    };
}
