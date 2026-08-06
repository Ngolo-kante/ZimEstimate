'use client';

import { useEffect, useRef, useState } from 'react';
import { useVisionTakeoff } from '@/hooks/useVisionTakeoff';
import { useAuth } from '@/components/providers/AuthProvider';
import UploadStep from './steps/UploadStep';
import AnalysisProgress from './steps/AnalysisProgress';
import ConfidenceWarning from './steps/ConfidenceWarning';
import FloorPlanEditor from './FloorPlanEditor/FloorPlanEditor';
import ProjectInfoStep from './steps/ProjectInfoStep';
import ConfigurationStep from './steps/ConfigurationStep';
import CalculationAnimation from './steps/CalculationAnimation';
import BOQResultsStep, { PENDING_VISION_SAVE_KEY } from './steps/BOQResultsStep';

export default function VisionTakeoffWizard() {
  const wizard = useVisionTakeoff();
  const { state } = wizard;
  const { isAuthenticated } = useAuth();

  // True only for the render right after a save was resumed, so
  // BOQResultsStep knows to complete it automatically rather than wait for a
  // second click on a button the user already pressed once.
  const [justResumed, setJustResumed] = useState(false);
  const resumedRef = useRef(false);

  useEffect(() => {
    if (resumedRef.current || !isAuthenticated) return;

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(PENDING_VISION_SAVE_KEY);
    } catch {
      return;
    }
    if (!stored) return;

    resumedRef.current = true;
    localStorage.removeItem(PENDING_VISION_SAVE_KEY);

    try {
      const restored = JSON.parse(stored);
      wizard.restoreResults(restored);
      setJustResumed(true);
    } catch {
      // Malformed payload — the wizard just starts fresh, the same as it
      // always did before this existed. Nothing left to clean up; the key
      // is already removed above.
    }
    // wizard is a fresh object every render (useVisionTakeoff returns a new
    // one each time); depending on it here would re-run this on every state
    // change, defeating resumedRef's one-shot guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <div className="vision-takeoff-wizard">
      {/* Upload Step */}
      {state.step === 'upload' && (
        <UploadStep
          onFileSelect={wizard.handleFileUpload}
          error={state.error}
        />
      )}

      {/* Analysis Progress */}
      {state.step === 'analyzing' && (
        <AnalysisProgress />
      )}

      {/* Low Confidence Warning */}
      {state.step === 'warning' && (
        <ConfidenceWarning
          confidence={wizard.confidence}
          onContinue={wizard.continueFromWarning}
          onManualEntry={wizard.goToManualEntry}
        />
      )}

      {/* Floor Plan Editor */}
      {state.step === 'editing' && (
        <FloorPlanEditor
          rooms={state.editedRooms}
          walls={state.editedWalls}
          imageUrl={state.previewUrl}
          confidence={wizard.confidence}
          totalArea={wizard.totalArea}
          onRoomUpdate={wizard.updateRoom}
          onRoomRemove={wizard.removeRoom}
          onConfirm={wizard.confirmDimensions}
          onBack={wizard.clearFile}
        />
      )}

      {/* Project Info */}
      {state.step === 'project_info' && (
        <ProjectInfoStep
          projectInfo={state.projectInfo}
          onUpdate={wizard.updateProjectInfo}
          onConfirm={wizard.confirmProjectInfo}
          onBack={() => wizard.goToStep('editing')}
        />
      )}

      {/* Configuration */}
      {state.step === 'config' && (
        <ConfigurationStep
          config={state.config}
          totalArea={wizard.totalArea}
          onUpdate={wizard.updateConfig}
          onConfirm={wizard.confirmConfig}
          onBack={() => wizard.goToStep('project_info')}
        />
      )}

      {/* Calculation Animation */}
      {state.step === 'calculating' && (
        <CalculationAnimation />
      )}

      {/* BOQ Results */}
      {state.step === 'results' && (
        <BOQResultsStep
          items={state.generatedBOQ}
          totals={wizard.boqTotals}
          projectInfo={state.projectInfo}
          totalArea={wizard.totalArea}
          config={state.config}
          editedRooms={state.editedRooms}
          onItemUpdate={wizard.updateBOQItem}
          onItemRemove={wizard.removeBOQItem}
          onBack={() => wizard.goToStep('config')}
          onStartOver={wizard.reset}
          autoSave={justResumed}
        />
      )}

      <style jsx>{`
        .vision-takeoff-wizard {
          min-height: calc(100vh - 200px);
        }
      `}</style>
    </div>
  );
}
