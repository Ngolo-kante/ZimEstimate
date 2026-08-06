// Vision Takeoff Wizard State Management Hook
import { useState, useCallback } from 'react';
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

const ENABLEMENT_ITEM_TAG = '[Enablement Cost]';

// API call to analyze floor plan
//
// Reading the plan does not require an account — only saving the project it
// produces does, gated separately in BOQResultsStep. The route's own defence
// against cost abuse is IP-based rate limiting (10/min), not auth, so nothing
// is given up by letting an anonymous visitor try the tool before signing up
// for it.
async function analyzeFloorPlanAPI(file: File): Promise<VisionAnalysisResult> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/vision/analyze', {
    method: 'POST',
    // Sent when a session already exists, purely so the request is
    // attributable; the endpoint does not require it.
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Analysis failed');
  }

  return result.data;
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
  const [state, setState] = useState<VisionTakeoffState>(INITIAL_STATE);

  // ============================================
  // STEP NAVIGATION
  // ============================================

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, step, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // ============================================
  // FILE UPLOAD & ANALYSIS
  // ============================================

  const handleFileUpload = useCallback(async (file: File) => {
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
      const result = await analyzeFloorPlanAPI(file);

      // Determine next step based on confidence
      const nextStep: WizardStep = result.confidence < 90 ? 'warning' : 'editing';

      setState((prev) => ({
        ...prev,
        analysisResult: result,
        editedRooms: result.rooms,
        editedWalls: result.walls,
        step: nextStep,
        isProcessing: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: 'upload',
        error: error instanceof Error ? error.message : 'Analysis failed. Please try again.',
        isProcessing: false,
      }));
    }
  }, []);

  const clearFile = useCallback(() => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
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
  }, [state.previewUrl]);

  // ============================================
  // LOW CONFIDENCE HANDLING
  // ============================================

  const continueFromWarning = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'editing' }));
  }, []);

  const goToManualEntry = useCallback(() => {
    // Redirect to manual BOQ builder
    window.location.href = '/boq/new';
  }, []);

  // ============================================
  // ROOM & WALL EDITING
  // ============================================

  const updateRoom = useCallback((roomId: string, updates: Partial<DetectedRoom>) => {
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
    }));
  }, []);

  const updateWall = useCallback((wallId: string, updates: Partial<DetectedWall>) => {
    setState((prev) => ({
      ...prev,
      editedWalls: prev.editedWalls.map((wall) =>
        wall.id === wallId ? { ...wall, ...updates } : wall
      ),
    }));
  }, []);

  const addRoom = useCallback((room: DetectedRoom) => {
    setState((prev) => ({
      ...prev,
      editedRooms: [...prev.editedRooms, room],
    }));
  }, []);

  const removeRoom = useCallback((roomId: string) => {
    setState((prev) => ({
      ...prev,
      editedRooms: prev.editedRooms.filter((room) => room.id !== roomId),
      editedWalls: prev.editedWalls.filter((wall) => !wall.id.includes(roomId)),
    }));
  }, []);

  const confirmDimensions = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'project_info' }));
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

  const confirmConfig = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'calculating' }));

    // Small delay for animation, then generate BOQ
    setTimeout(() => {
      setState((prev) => {
        const boqItems = generateBOQ(prev.editedRooms, prev.editedWalls, prev.config);
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

    // Derived values
    totalArea,
    boqTotals,
    confidence: state.analysisResult?.confidence ?? 0,

    // Navigation
    goToStep,
    reset,

    // Upload
    handleFileUpload,
    clearFile,

    // Warning handling
    continueFromWarning,
    goToManualEntry,

    // Editing
    updateRoom,
    updateWall,
    addRoom,
    removeRoom,
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
