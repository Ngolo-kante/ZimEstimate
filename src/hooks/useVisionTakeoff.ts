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
  DEFAULT_CONFIG,
} from '@/lib/vision/types';
import { generateBOQ } from '@/lib/calculations';

// API call to analyze floor plan
async function analyzeFloorPlanAPI(file: File): Promise<VisionAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/vision/analyze', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Analysis failed');
  }

  return result.data;
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
        return {
          ...prev,
          generatedBOQ: boqItems,
          step: 'results',
        };
      });
    }, 2500); // 2.5 second calculation animation
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
  };
}

export type UseVisionTakeoffReturn = ReturnType<typeof useVisionTakeoff>;
