'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
import WorkflowProgress from '@/components/boq/WorkflowProgress';

const VISION_STEPS = [
  { id: 'upload', label: 'Upload Plan' },
  { id: 'verify', label: 'Verify Plan' },
  { id: 'details', label: 'Project Details' },
  { id: 'materials', label: 'Materials' },
  { id: 'review', label: 'Review Estimate' },
];

const VISION_STEP_INDEX = {
  upload: 0,
  analyzing: 0,
  warning: 1,
  editing: 1,
  project_info: 2,
  config: 3,
  calculating: 4,
  results: 4,
} as const;

export default function VisionTakeoffWizard() {
  const wizard = useVisionTakeoff();
  const { state } = wizard;
  const { isAuthenticated } = useAuth();
  const progressStep = VISION_STEP_INDEX[state.step];

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
      <div className="vision-workflow-header">
        <div className="workflow-title-row">
          <div>
            <span>AI VISION BOQ</span>
            <strong>{state.projectInfo.name || 'Floor Plan Estimate'}</strong>
          </div>
          <Link href="/boq/new?method=manual">Use manual builder</Link>
        </div>
        <WorkflowProgress
          currentStep={progressStep}
          maxStepReached={progressStep}
          steps={VISION_STEPS}
          minutesRemaining={Math.max(1, (VISION_STEPS.length - progressStep) * 2)}
        />
      </div>

      <div className="vision-workflow-content">
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
      </div>

      <style jsx>{`
        .vision-takeoff-wizard {
          min-height: calc(100vh - 120px);
          margin: -32px -24px 0;
          padding-bottom: 72px;
          background: #f7f8fa;
        }

        .vision-workflow-header {
          padding: 22px max(24px, calc((100% - 1180px) / 2)) 20px;
          background: white;
          border-bottom: 1px solid #d8e0eb;
        }

        .workflow-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .workflow-title-row > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .workflow-title-row span {
          color: #1d5fbf;
          font-size: 0.68rem;
          font-weight: 800;
        }

        .workflow-title-row strong {
          color: #0f172a;
          font-size: 0.95rem;
        }

        .workflow-title-row a {
          color: #526174;
          font-size: 0.75rem;
          font-weight: 700;
          text-decoration: none;
        }

        .vision-workflow-content {
          width: min(100%, 1180px);
          margin: 0 auto;
          padding: 42px 24px 0;
        }

        @media (max-width: 640px) {
          .vision-takeoff-wizard {
            margin-top: -32px;
          }

          .vision-workflow-header {
            padding: 18px 20px 16px;
          }

          .workflow-title-row {
            margin-bottom: 16px;
          }

          .vision-workflow-content {
            padding: 28px 18px 0;
          }
        }
      `}</style>
    </div>
  );
}
