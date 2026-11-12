// Vision Takeoff Wizard State Management Hook
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { councilRequiresFullBrickWalls, generateBOQ, laborQuantitiesFor, planFloorArea } from '@/lib/calculations';
import { laborLines } from '@/lib/calculations/laborSubstages';
import { ADD_LATER_ITEMS } from '@/lib/estimators/addLater';
import { materials, getBestPrice } from '@/lib/materials';
import { TEMPORARY_WORKS_SUGGESTIONS } from '@/lib/buildFlowRules';
import { supabase } from '@/lib/supabase';
import { captureProductEvent } from '@/lib/productAnalytics';
import { analyzePlanFile, withTimeLimit, type AnalysisPhase } from '@/lib/vision/analyzePlan';
import { PlanReadFailure, type PlanFailureCode, type PlanPartial, type RecoveryAction, type WrongSheet } from '@/lib/vision/planFailure';
import { manualBuilderPatch } from '@/lib/vision/planFallback';
import { useBoqWizardStore } from '@/store/boqWizardStore';

/** A read that failed, with what is needed to offer a way forward. */
export type PlanFailure = { code: PlanFailureCode; message: string; sheet?: WrongSheet; partial?: PlanPartial };

/** How long the "working it out" screen may hold a BOQ that is already made. */
const RESULT_REVEAL_MS = 600;

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
async function analyzeFloorPlanAPI(file: File, signal: AbortSignal, onPreviewImage: (image: Blob) => void, onRetry?: () => void, onPhase?: (phase: AnalysisPhase) => void, fresh = false, onPageCount?: (pages: number) => void): Promise<VisionAnalysisResult> {
  // Reading is public: a stalled session refresh must not block an upload.
  const session = await withTimeLimit(supabase.auth.getSession(), 2_000, signal).catch(() => null);
  const accessToken = session?.data.session?.access_token;
  return analyzePlanFile(file, { accessToken, signal, onPreviewImage, onRetry, onPhase, fresh, onPageCount });
}

const fileKind = (file: File) => (file.type === 'application/pdf' ? 'pdf' : 'image');

function addTemporaryEnablementItems(items: GeneratedBOQItem[], config: VisionConfig): GeneratedBOQItem[] {
  const scopes = Array.isArray(config.scope) ? config.scope : [config.scope];
  const hasSubstructureScope = scopes.includes('full_house') || scopes.includes('substructure');
  if (!hasSubstructureScope) return items;

  const enablementItems = TEMPORARY_WORKS_SUGGESTIONS.flatMap((suggestion) => {
    // Only what the person ticked; undefined is an older saved setup, which had them all.
    if (config.includeExtras && !config.includeExtras.includes(suggestion.id)) return [];
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

export type OptionalExtra = { id: string; group: 'site' | 'house'; label: string; why: string; usd: number };

/**
 * The optional extras a plan's BOQ can include, each with its price: site
 * setup from the catalogue, and the house's own extras (kitchen units,
 * boundary wall, …) priced from this plan with their labour.
 */
function optionalExtrasFor(rooms: DetectedRoom[], walls: DetectedWall[], config: VisionConfig, windows?: number, doors?: number): OptionalExtra[] {
  const scopes = Array.isArray(config.scope) ? config.scope : [config.scope];
  const site: OptionalExtra[] = scopes.includes('full_house') || scopes.includes('substructure')
    ? TEMPORARY_WORKS_SUGGESTIONS.flatMap((suggestion) => {
      const price = getBestPrice(suggestion.id);
      return price ? [{ id: suggestion.id, group: 'site' as const, label: suggestion.label, why: suggestion.description, usd: price.priceUsd * suggestion.defaultQty }] : [];
    })
    : [];
  if (rooms.length === 0) return site;
  const everything = generateBOQ(rooms, walls, { ...config, includeExtras: undefined, includeLabor: false }, windows, doors);
  const area = planFloorArea(rooms, config).gross;
  const house = ADD_LATER_ITEMS.flatMap((entry) => {
    const lines = everything.filter((item) => entry.matches(item));
    if (lines.length === 0) return [];
    const materials = lines.reduce((sum, item) => sum + item.totalUsd, 0);
    const labour = config.includeLabor ? laborLines(lines, laborQuantitiesFor(lines, area, config), config.laborRates).reduce((sum, line) => sum + line.usd, 0) : 0;
    return [{ id: entry.id, group: 'house' as const, label: entry.label, why: entry.why, usd: materials + labour }];
  });
  return [...site, ...house];
}

export function useVisionTakeoff() {
  const router = useRouter();
  const [state, setState] = useState<VisionTakeoffState>(INITIAL_STATE);
  const analysisControllerRef = useRef<AbortController | null>(null);
  const [planHistory, setPlanHistory] = useState<{ past: PlanSnapshot[]; future: PlanSnapshot[] }>({ past: [], future: [] });
  const [planRevision, setPlanRevision] = useState(0);
  /** The readers were busy and the plan is being read a second time. */
  const [analysisRetrying, setAnalysisRetrying] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('preparing');
  const [rescanCandidate, setRescanCandidate] = useState<VisionAnalysisResult | null>(null);
  const [isRescanning, setIsRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);
  /** Why the last read failed; null once the person has moved on. */
  const [failure, setFailure] = useState<PlanFailure | null>(null);
  /** True when `previewUrl` is a picture the editor can draw (a PDF's page may not have rendered). */
  const [canShowPlan, setCanShowPlan] = useState(false);
  /** Pages in the uploaded PDF; 1 for a picture. */
  const [pdfPages, setPdfPages] = useState(1);
  const revealTimerRef = useRef<number | null>(null);

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

  useEffect(() => () => {
    analysisControllerRef.current?.abort();
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
  }, []);
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
    setFailure(null);
    setCanShowPlan(false);
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
    setFailure(null);
    setCanShowPlan(file.type.startsWith('image/'));
    setPdfPages(1);
    setAnalysisPhase('preparing');

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
        setCanShowPlan(true);
      }, () => setAnalysisRetrying(true), setAnalysisPhase, false, setPdfPages);
      setAnalysisRetrying(false);

      captureProductEvent('ai_scan_used', { tool: 'vision_takeoff', file_kind: fileKind(file), outcome: 'success', rooms: result.rooms.length, model: result.reader?.model, printed_sizes: result.printed?.rooms.length ?? 0 });

      setState((prev) => ({
        ...prev,
        analysisResult: result,
        editedRooms: result.rooms,
        editedWalls: result.walls,
        config: {
          ...prev.config,
          storeys: result.multiStorey ? 2 : 1,
          upperFloorAreaM2: result.multiStorey ? Math.round(planFloorArea(result.rooms, { statedFloorAreaM2: result.statedTotalAreaM2 }).gross * 10) / 10 : undefined,
        },
        // A total printed on the plan fills the "confirmed total" box; the
        // person can still change or clear it.
        verifiedTotalAreaM2: result.statedTotalAreaM2 ?? null,
        step: 'editing',
        isProcessing: false,
      }));
      setPlanHistory({ past: [], future: [] });
      setPlanRevision(0);
    } catch (error) {
      setAnalysisRetrying(false);
      const message = error instanceof Error ? error.message : 'Analysis failed. Please try again.';
      const failed: PlanFailure = error instanceof PlanReadFailure
        ? { code: error.code, message, sheet: error.sheet, partial: error.partial }
        : { code: 'unreadable', message };
      captureProductEvent('ai_scan_used', { tool: 'vision_takeoff', file_kind: fileKind(file), outcome: 'failed', reason: failed.code, sheet: failed.sheet });
      // The file stays: the recovery screen offers to read it again, or to
      // carry on with it another way (PlanRecovery.tsx).
      setFailure(failed);
      setState((prev) => ({ ...prev, step: 'upload', error: message, isProcessing: false }));
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
    setFailure(null);
    setCanShowPlan(false);
  }, []);

  // ============================================
  // AFTER A FAILED READ
  // ============================================

  const recordRecovery = useCallback((action: RecoveryAction) => {
    captureProductEvent('plan_recovery_chosen', { tool: 'vision_takeoff', action, reason: failure?.code });
  }, [failure?.code]);

  /** The same file again, without choosing it a second time. */
  const retryUpload = useCallback(() => {
    if (!state.uploadedFile) return;
    recordRecovery('retry');
    void handleFileUpload(state.uploadedFile);
  }, [state.uploadedFile, recordRecovery, handleFileUpload]);

  /**
   * The person's own plan with no rooms on it, for marking them by hand. Any
   * room whose name and size were read off the plan before the read failed
   * starts in the list, as printed; nothing else is filled in.
   */
  const startManualMarking = useCallback(() => {
    recordRecovery('mark_rooms');
    const rooms: DetectedRoom[] = (failure?.partial?.rooms ?? []).map((room, index) => ({
      id: `printed-${index}-${crypto.randomUUID()}`,
      name: room.name,
      dimensions: { width: room.width, length: room.length },
      area: room.width * room.length,
      // Never an invented location: the room is in the list until it is placed.
      position: { x: 0, y: 0, width: 0, height: 0 },
      wallType: 'internal',
      isEdited: false,
      dimensionSource: 'printed',
    }));
    setState((prev) => ({
      ...prev,
      analysisResult: { rooms, walls: [], totalArea: rooms.reduce((sum, room) => sum + room.area, 0), doors: 0, windows: 0, confidence: 0, imageWidth: 100, imageHeight: 100, source: 'manual' },
      editedRooms: rooms,
      editedWalls: [],
      floorBoundary: null,
      verifiedTotalAreaM2: failure?.partial?.statedTotalAreaM2 ?? null,
      step: 'editing',
      error: null,
    }));
    setPlanHistory({ past: [], future: [] });
    setPlanRevision(0);
    setFailure(null);
  }, [failure, recordRecovery]);

  /**
   * On to the manual builder with what is known: the project's name and
   * place, and the floor area just typed. A draft already in the builder
   * keeps everything this does not replace.
   */
  const continueInManualBuilder = useCallback(async (floorAreaM2?: number) => {
    recordRecovery('enter_area');
    try {
      // The builder's draft lives in the browser; load it before adding to it,
      // or the additions would be saved over it.
      await useBoqWizardStore.persist.rehydrate();
      const store = useBoqWizardStore.getState();
      const patch = manualBuilderPatch(
        { floorAreaM2, name: state.projectInfo.name, location: state.projectInfo.location },
        { name: store.projectDetails.name, specificLocation: store.projectDetails.specificLocation },
      );
      if (Object.keys(patch).length > 0) store.updateProjectDetails(patch);
    } catch (error) {
      // Storage blocked: the builder still opens, just empty.
      console.warn('Could not carry plan details to the manual builder.', error);
    }
    router.push('/boq/new?method=manual');
  }, [recordRecovery, router, state.projectInfo.name, state.projectInfo.location]);

  const chooseAnotherFile = useCallback(() => {
    recordRecovery('choose_file');
    clearFile();
  }, [recordRecovery, clearFile]);

  const dismissFailure = useCallback(() => {
    setFailure(null);
    setState((prev) => ({ ...prev, error: null }));
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
      // A new reading, not the one remembered for this file.
      const result = await analyzeFloorPlanAPI(file, controller.signal, () => {}, undefined, undefined, true);
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
    setState((prev) => ({
      ...prev,
      analysisResult: rescanCandidate,
      editedRooms: rescanCandidate.rooms,
      editedWalls: rescanCandidate.walls,
      config: {
        ...prev.config,
        storeys: rescanCandidate.multiStorey ? 2 : 1,
        upperFloorAreaM2: rescanCandidate.multiStorey ? Math.round(planFloorArea(rescanCandidate.rooms, { statedFloorAreaM2: prev.verifiedTotalAreaM2 ?? rescanCandidate.statedTotalAreaM2 }).gross * 10) / 10 : undefined,
      },
      floorBoundary: null,
      error: null,
    }));
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
    router.push('/boq/new?method=manual');
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
    setState((prev) => {
      // Rural and peri-urban houses are mostly built in farm bricks: start
      // there, shown ticked on the next screen. A brick already picked stays.
      const outOfTown = prev.projectInfo?.locationType === 'rural' || prev.projectInfo?.locationType === 'peri-urban';
      const brickType = outOfTown && prev.config.brickType === 'common' ? 'farm' : prev.config.brickType;
      return { ...prev, step: 'config', config: { ...prev.config, brickType } };
    });
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

  // Priced only while the person is choosing them, on the settings step.
  const optionalExtras = useMemo(
    () => state.step === 'config'
      ? optionalExtrasFor(state.editedRooms, state.editedWalls, { ...state.config, fullBrickInternalWalls: councilRequiresFullBrickWalls(state.projectInfo?.location), statedFloorAreaM2: state.verifiedTotalAreaM2 ?? undefined, locationType: state.projectInfo?.locationType || undefined }, state.analysisResult?.windows, state.analysisResult?.doors)
      : [],
    [state.step, state.editedRooms, state.editedWalls, state.config, state.projectInfo?.location, state.analysisResult?.windows, state.analysisResult?.doors, state.verifiedTotalAreaM2, state.projectInfo?.locationType],
  );

  const toggleExtra = useCallback((id: string) => {
    setState((prev) => {
      const current = prev.config.includeExtras ?? [];
      const includeExtras = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
      return { ...prev, config: { ...prev.config, includeExtras } };
    });
  }, []);

  const updatePlanOpenings = useCallback((openings: { doors?: number; windows?: number }) => {
    recordPlanEdit();
    setState((prev) => ({
      ...prev,
      analysisResult: prev.analysisResult ? { ...prev.analysisResult, ...openings } : null,
    }));
  }, [recordPlanEdit]);

  /* The BOQ is worked out at once. The next screen shows the plan's own
     figures for a moment and then gives way to the results; it used to count
     up invented numbers for two and a half seconds while nothing happened. */
  const confirmConfig = useCallback(() => {
    setState((prev) => {
      const config = { ...prev.config, fullBrickInternalWalls: councilRequiresFullBrickWalls(prev.projectInfo?.location), statedFloorAreaM2: prev.verifiedTotalAreaM2 ?? undefined, locationType: prev.projectInfo?.locationType || undefined };
      const boqItems = generateBOQ(prev.editedRooms, prev.editedWalls, config, prev.analysisResult?.windows, prev.analysisResult?.doors);
      return { ...prev, generatedBOQ: addTemporaryEnablementItems(boqItems, prev.config), step: 'calculating' };
    });
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => {
      revealTimerRef.current = null;
      setState((prev) => (prev.step === 'calculating' ? { ...prev, step: 'results' } : prev));
    }, RESULT_REVEAL_MS);
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
    analysisPhase,
    failure,
    canShowPlan,
    pdfPages,
    retryUpload,
    startManualMarking,
    continueInManualBuilder,
    chooseAnotherFile,
    dismissFailure,
    /** The person is marking the rooms themselves; nothing was scanned. */
    markedByHand: state.analysisResult?.source === 'manual',
    optionalExtras,
    toggleExtra,
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
