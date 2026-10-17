// Vision Takeoff Wizard State Management Hook
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  VisionTakeoffState,
  INITIAL_STATE,
  WizardStep,
  VisionConfig,
  DetectedRoom,
  DetectedWall,
  ProjectInfo,
  VisionAnalysisResult,
  GeneratedBOQItem,
} from '@/lib/vision/types';
import { generateBOQ } from '@/lib/calculations';
import { materials, getBestPrice } from '@/lib/materials';
import { TEMPORARY_WORKS_SUGGESTIONS } from '@/lib/buildFlowRules';
import { supabase } from '@/lib/supabase';
import { captureProductEvent } from '@/lib/productAnalytics';
import { analyzePlanFile } from '@/lib/vision/analyzePlan';

const ENABLEMENT_ITEM_TAG = '[Enablement Cost]';
type PlanSnapshot = {
  rooms: DetectedRoom[];
  walls: DetectedWall[];
  doors: number;
  windows: number;
};

// API call to analyze floor plan
//
// Reading the plan does not require an account — only saving the project it
// produces does, gated separately in BOQResultsStep. The route's own defence
// against cost abuse is IP-based rate limiting (10/min), not auth, so nothing
// is given up by letting an anonymous visitor try the tool before signing up
// for it.
async function analyzeFloorPlanAPI(file: File, signal: AbortSignal, onPreviewImage: (image: Blob) => void): Promise<VisionAnalysisResult> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  return analyzePlanFile(file, { accessToken, signal, onPreviewImage });
}

function addTemporaryEnablementItems(items: GeneratedBOQItem[], config: VisionConfig): GeneratedBOQItem[] {
  const scopes = Array.isArray(config.scope) ? config.scope : [config.scope];
  const hasSubstructureScope = scopes.includes('full_house') || scopes.includes('substructure');
  if (!hasSubstructureScope) return items;

  const enablementItems = TEMPORARY_WORKS_SUGGESTIONS.flatMap((suggestion) => {
    if (items.some((item) => item.materialId === suggestion.id)) return [];
    const material = materials.find((entry) => entry.id === suggestion.id);
    const bestPrice = getBestPrice(suggestion.id);
    if (!material || !bestPrice) return [];

    const quantity = suggestion.defaultQty;
    const totalUsd = quantity * bestPrice.priceUsd;
    const totalZwg = quantity * bestPrice.priceZwg;

    return [{
      id: `vision-enablement-${suggestion.id}`,
      materialId: suggestion.id,
      materialName: material.name,
      category: 'substructure',
      quantity,
      unit: material.unit,
      unitPriceUsd: bestPrice.priceUsd,
      unitPriceZwg: bestPrice.priceZwg,
      totalUsd,
      totalZwg,
      calculationNote: `${ENABLEMENT_ITEM_TAG} ${suggestion.description}`,
      isEdited: false,
    }];
  });

  if (enablementItems.length === 0) return items;
  return [...items, ...enablementItems];
}

export function useVisionTakeoff() {
  const router = useRouter();
  const [state, setState] = useState<VisionTakeoffState>(INITIAL_STATE);
  const analysisControllerRef = useRef<AbortController | null>(null);
  const [planHistory, setPlanHistory] = useState<{ past: PlanSnapshot[]; future: PlanSnapshot[] }>({ past: [], future: [] });
  const [planRevision, setPlanRevision] = useState(0);

  const snapshot = useCallback((): PlanSnapshot => ({
    rooms: state.editedRooms,
    walls: state.editedWalls,
    doors: state.analysisResult?.doors ?? 0,
    windows: state.analysisResult?.windows ?? 0,
  }), [state.editedRooms, state.editedWalls, state.analysisResult]);

  const recordPlanEdit = useCallback(() => {
    const current = snapshot();
    setPlanHistory((previous) => ({ past: [...previous.past, current].slice(-30), future: [] }));
  }, [snapshot]);

  useEffect(() => () => analysisControllerRef.current?.abort(), []);
  useEffect(() => {
    const url = state.previewUrl;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [state.previewUrl]);

  // ============================================
  // STEP NAVIGATION
  // ============================================

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, step, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setPlanHistory({ past: [], future: [] });
    setPlanRevision(0);
  }, []);

  // ============================================
  // FILE UPLOAD & ANALYSIS
  // ============================================

  const handleFileUpload = useCallback(async (file: File) => {
    analysisControllerRef.current?.abort();
    const controller = new AbortController();
    analysisControllerRef.current = controller;

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);

    setState((prev) => ({
      ...prev,
      uploadedFile: file,
      previewUrl,
      step: 'analyzing',
      error: null,
      isProcessing: true,
    }));

    try {
      const result = await analyzeFloorPlanAPI(file, controller.signal, (image) => {
        const imageUrl = URL.createObjectURL(image);
        setState((prev) => ({ ...prev, previewUrl: imageUrl }));
      });

      // Determine next step based on confidence
      const nextStep: WizardStep = result.confidence < 90 ? 'warning' : 'editing';
      captureProductEvent('ai_scan_used', { tool: 'vision_takeoff', file_kind: file.type === 'application/pdf' ? 'pdf' : 'image', outcome: 'success', rooms: result.rooms.length });

      setState((prev) => ({
        ...prev,
        analysisResult: result,
        editedRooms: result.rooms,
        editedWalls: result.walls,
        step: nextStep,
        isProcessing: false,
      }));
      setPlanHistory({ past: [], future: [] });
      setPlanRevision(0);
    } catch (error) {
      captureProductEvent('ai_scan_used', { tool: 'vision_takeoff', file_kind: file.type === 'application/pdf' ? 'pdf' : 'image', outcome: 'failed' });
      setState((prev) => ({
        ...prev,
        step: 'upload',
        error: error instanceof Error ? error.message : 'Analysis failed. Please try again.',
        isProcessing: false,
      }));
    } finally {
      if (analysisControllerRef.current === controller) analysisControllerRef.current = null;
    }
  }, []);

  const cancelAnalysis = useCallback(() => {
    analysisControllerRef.current?.abort();
  }, []);

  const clearFile = useCallback(() => {
    setState((prev) => ({
      ...prev,
      uploadedFile: null,
      previewUrl: null,
      analysisResult: null,
      editedRooms: [],
      editedWalls: [],
      step: 'upload',
      error: null,
    }));
    setPlanHistory({ past: [], future: [] });
    setPlanRevision(0);
  }, []);

  // ============================================
  // LOW CONFIDENCE HANDLING
  // ============================================

  const continueFromWarning = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'editing' }));
  }, []);

  const goToManualEntry = useCallback(() => {
    router.push('/boq/new');
  }, [router]);

  // ============================================
  // ROOM & WALL EDITING
  // ============================================

  const updateRoom = useCallback((roomId: string, updates: Partial<DetectedRoom>) => {
    recordPlanEdit();
    const dimensions = updates.dimensions;
    setState((prev) => ({
      ...prev,
      editedRooms: prev.editedRooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              ...updates,
              // Recalculate area if dimensions changed
              area:
                updates.dimensions
                  ? updates.dimensions.width * updates.dimensions.length
                  : room.area,
              isEdited: true,
            }
          : room
      ),
      error: null,
      // Wall segments created by the reader carry the room's original side
      // lengths. Keep them in sync when a person corrects those dimensions,
      // otherwise the review and BOQ can still use the stale scan geometry.
      editedWalls: (dimensions || updates.wallType) ? prev.editedWalls.map((wall) => {
        if (!wall.id.startsWith(`wall_${roomId}_`)) return wall;
        const next = updates.wallType ? { ...wall, type: updates.wallType } : wall;
        if (wall.id === `wall_${roomId}_top` || wall.id === `wall_${roomId}_bottom`) {
          return dimensions ? { ...next, length: dimensions.width } : next;
        }
        if (wall.id === `wall_${roomId}_left` || wall.id === `wall_${roomId}_right`) {
          return dimensions ? { ...next, length: dimensions.length } : next;
        }
        return next;
      }) : prev.editedWalls,
    }));
  }, [recordPlanEdit]);

  const updateWall = useCallback((wallId: string, updates: Partial<DetectedWall>) => {
    setState((prev) => ({
      ...prev,
      editedWalls: prev.editedWalls.map((wall) =>
        wall.id === wallId ? { ...wall, ...updates } : wall
      ),
    }));
  }, []);

  const addRoom = useCallback((room: DetectedRoom) => {
    recordPlanEdit();
    setState((prev) => ({
      ...prev,
      editedRooms: [...prev.editedRooms, room],
      error: null,
    }));
  }, [recordPlanEdit]);

  const removeRoom = useCallback((roomId: string) => {
    recordPlanEdit();
    setState((prev) => ({
      ...prev,
      editedRooms: prev.editedRooms.filter((room) => room.id !== roomId),
      editedWalls: prev.editedWalls.filter((wall) => !wall.id.startsWith(`wall_${roomId}_`)),
      error: null,
    }));
  }, [recordPlanEdit]);

  const undoPlanEdit = useCallback(() => {
    const previous = planHistory.past.at(-1);
    if (!previous) return;
    const current = snapshot();
    setState((prev) => ({ ...prev, editedRooms: previous.rooms, editedWalls: previous.walls,
      analysisResult: prev.analysisResult ? { ...prev.analysisResult, doors: previous.doors, windows: previous.windows } : null }));
    setPlanHistory((history) => ({ past: history.past.slice(0, -1), future: [current, ...history.future] }));
    setPlanRevision((revision) => revision + 1);
  }, [planHistory.past, snapshot]);

  const redoPlanEdit = useCallback(() => {
    const next = planHistory.future[0];
    if (!next) return;
    const current = snapshot();
    setState((prev) => ({ ...prev, editedRooms: next.rooms, editedWalls: next.walls,
      analysisResult: prev.analysisResult ? { ...prev.analysisResult, doors: next.doors, windows: next.windows } : null }));
    setPlanHistory((history) => ({ past: [...history.past, current], future: history.future.slice(1) }));
    setPlanRevision((revision) => revision + 1);
  }, [planHistory.future, snapshot]);

  const confirmDimensions = useCallback(() => {
    setState((prev) => {
      if (prev.editedRooms.length === 0 || prev.editedRooms.some((room) =>
        !Number.isFinite(room.dimensions.width) || !Number.isFinite(room.dimensions.length) ||
        room.dimensions.width <= 0 || room.dimensions.length <= 0)) {
        return { ...prev, error: 'Add at least one room with valid dimensions before continuing.' };
      }
      return { ...prev, step: 'project_info', error: null };
    });
  }, []);

  // ============================================
  // PROJECT INFO
  // ============================================

  const updateProjectInfo = useCallback((info: Partial<ProjectInfo>) => {
    setState((prev) => ({
      ...prev,
      projectInfo: { ...prev.projectInfo, ...info },
    }));
  }, []);

  const confirmProjectInfo = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'config' }));
  }, []);

  // ============================================
  // CONFIGURATION
  // ============================================

  const updateConfig = useCallback((config: Partial<VisionConfig>) => {
    setState((prev) => ({
      ...prev,
      config: { ...prev.config, ...config },
    }));
  }, []);

  const updatePlanOpenings = useCallback((openings: { doors?: number; windows?: number }) => {
    recordPlanEdit();
    setState((prev) => ({
      ...prev,
      analysisResult: prev.analysisResult ? { ...prev.analysisResult, ...openings } : null,
    }));
  }, [recordPlanEdit]);

  const confirmConfig = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'calculating' }));

    // Small delay for animation, then generate BOQ
    setTimeout(() => {
      setState((prev) => {
        const boqItems = generateBOQ(prev.editedRooms, prev.editedWalls, prev.config, prev.analysisResult?.windows, prev.analysisResult?.doors);
        const boqItemsWithEnablement = addTemporaryEnablementItems(boqItems, prev.config);
        return {
          ...prev,
          generatedBOQ: boqItemsWithEnablement,
          step: 'results',
        };
      });
    }, 2500); // 2.5 second calculation animation
  }, []);

  /**
   * Jumps straight to the results step with a previously-computed BOQ, skipping
   * upload, analysis and every editing step in between.
   *
   * Exists for one caller: resuming a save that was interrupted by signing in.
   * The floor plan analysis is a paid Gemini call, so re-running upload →
   * analyze → edit → configure from scratch because the visitor had not yet
   * created an account would be asking them to pay for a second scan of the
   * same document. uploadedFile and editedWalls are deliberately left out —
   * a File cannot survive a JSON round trip through storage, and nothing past
   * this step reads walls again.
   */
  const restoreResults = useCallback((restored: {
    projectInfo: ProjectInfo;
    config: VisionConfig;
    editedRooms: DetectedRoom[];
    generatedBOQ: GeneratedBOQItem[];
  }) => {
    setState((prev) => ({
      ...prev,
      projectInfo: restored.projectInfo,
      config: restored.config,
      editedRooms: restored.editedRooms,
      generatedBOQ: restored.generatedBOQ,
      step: 'results',
      error: null,
    }));
  }, []);

  // ============================================
  // BOQ EDITING
  // ============================================

  const updateBOQItem = useCallback((itemId: string, updates: Partial<GeneratedBOQItem>) => {
    setState((prev) => ({
      ...prev,
      generatedBOQ: prev.generatedBOQ.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...updates,
              // Recalculate totals if quantity or price changed
              totalUsd:
                (updates.quantity ?? item.quantity) * (updates.unitPriceUsd ?? item.unitPriceUsd),
              totalZwg:
                (updates.quantity ?? item.quantity) * (updates.unitPriceZwg ?? item.unitPriceZwg),
              isEdited: true,
            }
          : item
      ),
    }));
  }, []);

  const removeBOQItem = useCallback((itemId: string) => {
    setState((prev) => ({
      ...prev,
      generatedBOQ: prev.generatedBOQ.filter((item) => item.id !== itemId),
    }));
  }, []);

  // ============================================
  // DERIVED VALUES
  // ============================================

  const totalArea = state.editedRooms.reduce((sum, room) => sum + room.area, 0);

  const boqTotals = state.generatedBOQ.reduce(
    (acc, item) => ({
      usd: acc.usd + item.totalUsd,
      zwg: acc.zwg + item.totalZwg,
    }),
    { usd: 0, zwg: 0 }
  );

  // ============================================
  // RETURN API
  // ============================================

  return {
    // State
    state,

    updatePlanOpenings,

    // Derived values
    totalArea,
    boqTotals,
    confidence: state.analysisResult?.confidence ?? 0,
    /** The AI readers were busy and the rooms came from the plan's printed labels. */
    readFromLabels: state.analysisResult?.source === 'labels',

    // Navigation
    goToStep,
    reset,

    // Upload
    handleFileUpload,
    cancelAnalysis,
    clearFile,

    // Warning handling
    continueFromWarning,
    goToManualEntry,

    // Editing
    updateRoom,
    updateWall,
    addRoom,
    removeRoom,
    undoPlanEdit,
    redoPlanEdit,
    canUndoPlanEdit: planHistory.past.length > 0,
    canRedoPlanEdit: planHistory.future.length > 0,
    planRevision,
    confirmDimensions,

    // Project info
    updateProjectInfo,
    confirmProjectInfo,

    // Configuration
    updateConfig,
    confirmConfig,

    // BOQ
    updateBOQItem,
    removeBOQItem,

    // Resuming a save interrupted by sign-in
    restoreResults,
  };
}

export type UseVisionTakeoffReturn = ReturnType<typeof useVisionTakeoff>;
