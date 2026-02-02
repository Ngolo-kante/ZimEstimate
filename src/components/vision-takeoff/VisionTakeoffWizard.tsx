'use client';

import { useVisionTakeoff } from '@/hooks/useVisionTakeoff';
import UploadStep from './steps/UploadStep';
import AnalysisProgress from './steps/AnalysisProgress';
import ConfidenceWarning from './steps/ConfidenceWarning';
import FloorPlanEditor from './FloorPlanEditor/FloorPlanEditor';
import ProjectInfoStep from './steps/ProjectInfoStep';
import ConfigurationStep from './steps/ConfigurationStep';
import CalculationAnimation from './steps/CalculationAnimation';
import BOQResultsStep from './steps/BOQResultsStep';

export default function VisionTakeoffWizard() {
  const wizard = useVisionTakeoff();
  const { state } = wizard;

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
          onItemUpdate={wizard.updateBOQItem}
          onItemRemove={wizard.removeBOQItem}
          onBack={() => wizard.goToStep('config')}
          onStartOver={wizard.reset}
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
