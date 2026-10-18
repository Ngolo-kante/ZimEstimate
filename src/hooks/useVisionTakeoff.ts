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
  PlanBox,
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
  floorBoundary: PlanBox | null;
};

// API call to analyze floor plan
//
// Reading the plan does not require an account — only saving the project it
// produces does, gated separately in BOQResultsStep. The route's own defence
// against cost abuse is IP-based rate limiting (10/min), not auth, so nothing
// is given up by letting an anonymous visitor try the tool before signing up
// for it.
async function analyzeFloorPlanAPI(file: File, signal: AbortSignal, onPreviewImage: (image: Blob) => void, onRetry?: () => void): Promise<VisionAnalysisResult> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  return analyzePlanFile(file, { accessToken, signal, onPreviewImage, onRetry });
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
  /** The readers were busy and the plan is being read a second time. */
  const [analysisRetrying, setAnalysisRetrying] = useState(false);
  const [rescanCandidate, setRescanCandidate] = useState<VisionAnalysisResult | null>(null);
  const [isRescanning, setIsRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);

  const snapshot = useCallback((): PlanSnapshot => ({
    rooms: state.editedRooms,
    walls: state.editedWalls,
    doors: state.analysisResult?.doors ?? 0,
    windows: state.analysisResult?.windows ?? 0,
    floorBoundary: state.floorBoundary,
  }), [state.editedRooms, state.editedWalls, state.analysisResult, state.floorBoundary]);

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
    analysisControllerRef.current?.abort();
    setState(INITIAL_STATE);
    setPlanHistory({ past: [], future: [] });
    setPlanRevision(0);
    setRescanCandidate(null);
    setRescanError(null);
  }, []);

  // ============================================
  // FILE UPLOAD & ANALYSIS
  // ============================================

  const handleFileUpload = useCallback(async (file: File) => {
    analysisControllerRef.current?.abort();
    const controller = new AbortController();
    analysisControllerRef.current = controller;
    setRescanCandidate(null);
    setRescanError(null);

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);

    setState((prev) => ({
      ...prev,
      uploadedFile: file,
      previewUrl,
      floorBoundary: null,
      verifiedTotalAreaM2: null,
      step: 'analyzing',
      error: null,
      isProcessing: true,
    }));

    try {
      setAnalysisRetrying(false);
      const result = await analyzeFloorPlanAPI(file, controller.signal, (image) => {
        const imageUrl = URL.createObjectURL(image);
        setState((prev) => ({ ...prev, previewUrl: imageUrl }));
      }, () => setAnalysisRetrying(true));
      setAnalysisRetrying(false);

      captureProductEvent('ai_scan_used', { tool: 'vision_takeoff', file_kind: file.type === 'application/pdf' ? 'pdf' : 'image', outcome: 'success', rooms: result.rooms.length });

      setState((prev) => ({
        ...prev,
        analysisResult: result,
        editedRooms: result.rooms,
        editedWalls: result.walls,
        step: 'editing',
        isProcessing: false,
      }));
      setPlanHistory({ past: [], future: [] });
      setPlanRevision(0);
    } catch (error) {
      setAnalysisRetrying(false);
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
    analysisControllerRef.current?.abort();
    setState((prev) => ({
      ...prev,
      uploadedFile: null,
      previewUrl: null,
      analysisResult: null,
      editedRooms: [],
      editedWalls: [],
      floorBoundary: null,
      verifiedTotalAreaM2: null,
      step: 'upload',
      error: null,
    }));
    setPlanHistory({ past: [], future: [] });
    setPlanRevision(0);
    setRescanCandidate(null);
    setRescanError(null);
    setIsRescanning(false);
  }, []);

  const rescanPlan = useCallback(async () => {
    const file = state.uploadedFile;
    if (!file || isRescanning) return;
    const controller = new AbortController();
    analysisControllerRef.current = controller;
    setIsRescanning(true);
    setRescanError(null);
    setRescanCandidate(null);
    try {
      // Keep the current rooms and corrections until the user compares both reads.
      const result = await analyzeFloorPlanAPI(file, controller.signal, () => {});
      if (controller.signal.aborted) return;
      setRescanCandidate(result);
      captureProductEvent('ai_scan_used', { tool: 'vision_takeoff_rescan', outcome: 'success', rooms: result.rooms.length, confidence: result.confidence, model: result.reader?.model });
    } catch (error) {
      if (!controller.signal.aborted) {
        setRescanError(error instanceof Error ? error.message : 'The new scan failed. Your current review is unchanged.');
        captureProductEvent('ai_scan_used', { tool: 'vision_takeoff_rescan', outcome: 'failed' });
      }
    } finally {
      if (analysisControllerRef.current === controller) analysisControllerRef.current = null;
      setIsRescanning(false);
    }
  }, [state.uploadedFile, isRescanning]);

  const useRescanCandidate = useCallback(() => {
    if (!rescanCandidate) return;
    setState((prev) => ({ ...prev, analysisResult: rescanCandidate, editedRooms: rescanCandidate.rooms, editedWalls: rescanCandidate.walls, floorBoundary: null, error: null }));
    setPlanHistory({ past: [], future: [] });
    setPlanRevision((revision) => revision + 1);
    setRescanCandidate(null);
  }, [rescanCandidate]);

  const keepCurrentScan = useCallback(() => setRescanCandidate(null), []);
  const cancelRescan = useCallback(() => analysisControllerRef.current?.abort(), []);

  // ============================================
  // MANUAL ENTRY
  // ============================================

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
              // A typed size is the person's. One taken from the plan's printed
              // sizes (planCheck.ts) says so and counts as checked; one measured
              // off the plan to its scale (planWalls.ts) says so, unchecked.
              dimensionSource: updates.dimensions
                ? (updates.dimensionSource === 'printed' || updates.dimensionSource === 'scaled' ? updates.dimensionSource : 'user')
                : room.dimensionSource,
              dimensionsVerified: updates.dimensions ? updates.dimensionSource === 'printed' && updates.dimensionsVerified === true : room.dimensionsVerified,
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

  /* Boxes lined up with the walls around each room's printed name, as part
     of reading the plan (FloorPlanCanvas). Not an edit: no undo step, and
     the rooms are not marked as changed by the person. */
  const placeRooms = useCallback((positions: Record<string, PlanBox>) => {
    setState((prev) => ({
      ...prev,
      editedRooms: prev.editedRooms.map((room) => positions[room.id] ? { ...room, position: positions[room.id] } : room),
    }));
  }, []);

  const setFloorBoundary = useCallback((box: PlanBox | null) => {
    recordPlanEdit();
    setState((prev) => ({ ...prev, floorBoundary: box }));
  }, [recordPlanEdit]);

  const setVerifiedTotalArea = useCallback((area: number | null) => {
    setState((prev) => ({ ...prev, verifiedTotalAreaM2: area && Number.isFinite(area) && area > 0 ? area : null }));
  }, []);

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
    setState((prev) => ({ ...prev, editedRooms: previous.rooms, editedWalls: previous.walls, floorBoundary: previous.floorBoundary,
      analysisResult: prev.analysisResult ? { ...prev.analysisResult, doors: previous.doors, windows: previous.windows } : null }));
    setPlanHistory((history) => ({ past: history.past.slice(0, -1), future: [current, ...history.future] }));
    setPlanRevision((revision) => revision + 1);
  }, [planHistory.past, snapshot]);

  const redoPlanEdit = useCallback(() => {
    const next = planHistory.future[0];
    if (!next) return;
    const current = snapshot();
    setState((prev) => ({ ...prev, editedRooms: next.rooms, editedWalls: next.walls, floorBoundary: next.floorBoundary,
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
    analysisRetrying,
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
    rescanPlan,
    rescanCandidate,
    isRescanning,
    rescanError,
    useRescanCandidate,
    keepCurrentScan,
    cancelRescan,

    // Manual entry
    goToManualEntry,

    // Editing
    updateRoom,
    updateWall,
    addRoom,
    placeRooms,
    setFloorBoundary,
    setVerifiedTotalArea,
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
