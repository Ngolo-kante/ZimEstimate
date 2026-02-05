'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    createProject,
    updateProject,
    getProjectWithItems,
    saveProjectWithItems,
} from '@/lib/services/projects';
import { setProjectStagesApplicability } from '@/lib/services/stages';
import { Project, BOQItem, ProjectScope, LaborPreference } from '@/lib/database.types';

interface BOQItemLocal {
    id: string;
    materialId: string;
    materialName: string;
    quantity: number | null;
    unit: string;
    averagePriceUsd: number;
    averagePriceZwg: number;
    actualPriceUsd: number;
    actualPriceZwg: number;
    description?: string;
    category?: string;
}

interface MilestoneData {
    id: string;
    items: BOQItemLocal[];
    expanded: boolean;
}

interface ProjectDetails {
    name: string;
    location: string;
}

interface UseProjectAutoSaveOptions {
    projectId?: string | null;
    autoSaveInterval?: number; // ms
    onSaveStart?: () => void;
    onSaveComplete?: (project: Project) => void;
    onSaveError?: (error: Error) => void;
    onLoadComplete?: (project: Project, items: BOQItem[]) => void;
    onLoadError?: (error: Error) => void;
}

interface UseProjectAutoSaveReturn {
    // State
    project: Project | null;
    isSaving: boolean;
    isLoading: boolean;
    lastSaved: Date | null;
    hasUnsavedChanges: boolean;
    error: string | null;

    // Actions
    saveNow: () => Promise<void>;
    createNewProject: (details: ProjectDetails) => Promise<string | null>;
    markChanged: () => void;
}

export function useProjectAutoSave(
    projectDetails: ProjectDetails,
    projectScope: 'entire' | 'stage',
    selectedStages: string[],
    laborType: 'materials_only' | 'materials_labor',
    milestonesState: MilestoneData[],
    options: UseProjectAutoSaveOptions = {}
): UseProjectAutoSaveReturn {
    const {
        projectId,
        autoSaveInterval = 30000, // 30 seconds default
        onSaveStart,
        onSaveComplete,
        onSaveError,
        onLoadComplete,
        onLoadError,
    } = options;

    const router = useRouter();

    const [project, setProject] = useState<Project | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isInitializedRef = useRef(false);
    const projectRef = useRef<Project | null>(null);

    // Convert local BOQ items to database format
    const convertItemsForSave = useCallback((milestones: MilestoneData[]) => {
        const items: Array<{
            material_id: string;
            material_name: string;
            category: string;
            quantity: number;
            unit: string;
            unit_price_usd: number;
            unit_price_zwg: number;
            notes?: string;
            sort_order: number;
        }> = [];

        let sortOrder = 0;
        milestones.forEach((milestone) => {
            milestone.items.forEach((item) => {
                items.push({
                    material_id: item.materialId,
                    material_name: item.materialName,
                    category: item.category || milestone.id,
                    quantity: item.quantity || 0,
                    unit: item.unit,
                    unit_price_usd: item.actualPriceUsd,
                    unit_price_zwg: item.actualPriceZwg,
                    notes: item.description,
                    sort_order: sortOrder++,
                });
            });
        });

        return items;
    }, []);

    // Save project to database
    const saveProject = useCallback(async () => {
        const currentProject = projectRef.current;
        if (!currentProject) return;

        setIsSaving(true);
        setError(null);
        onSaveStart?.();

        try {
            // Determine scope enum value
            let scope: ProjectScope = 'entire_house';
            if (projectScope === 'stage' && selectedStages.length === 1) {
                scope = selectedStages[0] as ProjectScope;
            }
            const selectedStagesForSave = projectScope === 'stage' ? selectedStages : [];

            // Determine labor preference
            const labor_preference: LaborPreference =
                laborType === 'materials_labor' ? 'with_labor' : 'materials_only';

            const items = convertItemsForSave(milestonesState);

            const { project: savedProject, error: saveError } = await saveProjectWithItems(
                currentProject.id,
                {
                    name: projectDetails.name,
                    location: projectDetails.location,
                    scope,
                    labor_preference,
                    selected_stages: selectedStagesForSave.length > 0 ? selectedStagesForSave : null,
                    status: 'draft',
                },
                items
            );

            if (saveError) {
                throw saveError;
            }

            if (savedProject) {
                if (selectedStagesForSave.length > 0) {
                    await setProjectStagesApplicability(currentProject.id, selectedStagesForSave);
                }
                setProject(savedProject);
                projectRef.current = savedProject;
                setLastSaved(new Date());
                setHasUnsavedChanges(false);
                onSaveComplete?.(savedProject);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to save');
            setError(error.message);
            onSaveError?.(error);
        } finally {
            setIsSaving(false);
        }
    }, [
        project,
        projectDetails,
        projectScope,
        selectedStages,
        laborType,
        milestonesState,
        convertItemsForSave,
        onSaveStart,
        onSaveComplete,
        onSaveError,
    ]);

    // Create new project
    const createNewProject = useCallback(async (details: ProjectDetails): Promise<string | null> => {
        setIsSaving(true);
        setError(null);

        try {
            let scope: ProjectScope = 'entire_house';
            if (projectScope === 'stage' && selectedStages.length === 1) {
                scope = selectedStages[0] as ProjectScope;
            }
            const selectedStagesForSave = projectScope === 'stage' ? selectedStages : [];

            const { project: newProject, error: createError } = await createProject({
                name: details.name,
                location: details.location,
                scope,
                labor_preference: laborType === 'materials_labor' ? 'with_labor' : 'materials_only',
                selected_stages: selectedStagesForSave.length > 0 ? selectedStagesForSave : null,
            });

            if (createError) {
                throw createError;
            }

            if (newProject) {
                setProject(newProject);
                projectRef.current = newProject;
                setLastSaved(new Date());
                setHasUnsavedChanges(false);

                // Update URL with project ID without full navigation
                window.history.replaceState(null, '', `/boq/new?id=${newProject.id}`);

                return newProject.id;
            }

            return null;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to create project');
            setError(error.message);
            return null;
        } finally {
            setIsSaving(false);
        }
    }, [projectScope, selectedStages, laborType]);

    // Load existing project
    useEffect(() => {
        if (!projectId || isInitializedRef.current) return;

        const loadProject = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const { project: loadedProject, items, error: loadError } = await getProjectWithItems(projectId);

                if (loadError) {
                    throw loadError;
                }

                if (loadedProject) {
                    setProject(loadedProject);
                    projectRef.current = loadedProject;
                    setLastSaved(new Date(loadedProject.updated_at));
                    isInitializedRef.current = true;
                    onLoadComplete?.(loadedProject, items);
                }
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Failed to load project');
                setError(error.message);
                onLoadError?.(error);
            } finally {
                setIsLoading(false);
            }
        };

        loadProject();
    }, [projectId, onLoadComplete, onLoadError]);

    // Auto-save effect
    useEffect(() => {
        if (!project || !hasUnsavedChanges) return;

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set new timeout for auto-save
        saveTimeoutRef.current = setTimeout(() => {
            saveProject();
        }, autoSaveInterval);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [project, hasUnsavedChanges, autoSaveInterval, saveProject]);

    // Mark as changed
    const markChanged = useCallback(() => {
        if (project) {
            setHasUnsavedChanges(true);
        }
    }, [project]);

    // Save immediately
    const saveNow = useCallback(async () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        await saveProject();
    }, [saveProject]);

    return {
        project,
        isSaving,
        isLoading,
        lastSaved,
        hasUnsavedChanges,
        error,
        saveNow,
        createNewProject,
        markChanged,
    };
}
