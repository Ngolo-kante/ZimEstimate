'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FloppyDisk, X, CircleNotch, CaretLeft, CaretRight, Check } from '@phosphor-icons/react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/components/providers/AuthProvider';
import SavingOverlay from '@/components/ui/SavingOverlay';
import { useProjectAutoSave } from '@/hooks/useProjectAutoSave';
import { useBoqWizardStore, type BoqMilestoneId, type MilestoneData, type BOQItem } from '@/store/boqWizardStore';
import LiveEstimatorLayout from './components/LiveEstimatorLayout';
import LiveEstimatePanel from './components/LiveEstimatePanel';
import ReviewTabs from './components/ReviewTabs';
import ProjectTypeSection from './components/sections/ProjectTypeSection';
import ProjectLocationSection from './components/sections/ProjectLocationSection';
import BuildingDesignSection from './components/sections/BuildingDesignSection';
import MaterialsSection from './components/sections/MaterialsSection';
import LaborSection from './components/sections/LaborSection';
import SiteConditionsSection from './components/sections/SiteConditionsSection';
import { InteractiveRoomBuilder, type RoomInstance } from './components/InteractiveRoomBuilder';
import { buildLiveMilestones } from './utils/liveEstimator';
import { validateBOQWizardStep, type BOQWizardValidationState } from './wizardValidation';
import { inferProjectType } from './projectTypes';
import { useToast } from '@/components/ui/Toast';
import type { BOQItem as DbBOQItem, Project } from '@/lib/database.types';
import './wizard-design.css';

function getLocationLabel(type: string, city: string, specific: string) {
  const parts = [];
  if (type) parts.push(type.charAt(0).toUpperCase() + type.slice(1));
  if (city) parts.push(city);
  if (specific) parts.push(specific);
  return parts.join(' - ');
}

function normalizeLocationType(raw: string): 'urban' | 'peri-urban' | 'rural' | '' {
  const value = raw.trim().toLowerCase().replace(/\s+/g, '-');
  if (value === 'urban' || value === 'peri-urban' || value === 'rural') {
    return value;
  }

  return '';
}

function normalizeMilestone(category: string | null | undefined): BoqMilestoneId {
  if (
    category === 'substructure' ||
    category === 'superstructure' ||
    category === 'roofing' ||
    category === 'finishing' ||
    category === 'exterior' ||
    category === 'labor'
  ) {
    return category;
  }

  return 'substructure';
}

function mapLoadedItemsToMilestones(items: DbBOQItem[], previous: MilestoneData[]): MilestoneData[] {
  const byMilestone = new Map<BoqMilestoneId, BOQItem[]>();

  previous.forEach((milestone) => {
    byMilestone.set(milestone.id, []);
  });

  items.forEach((item) => {
    const milestoneId = normalizeMilestone(item.category);
    const group = byMilestone.get(milestoneId) || [];

    group.push({
      id: item.id,
      materialId: item.material_id,
      materialName: item.material_name,
      quantity: item.quantity,
      calculatedQuantity: item.quantity,
      unit: item.unit,
      averagePriceUsd: item.unit_price_usd,
      averagePriceZwg: item.unit_price_zwg,
      actualPriceUsd: item.unit_price_usd,
      actualPriceZwg: item.unit_price_zwg,
      description: item.notes || undefined,
      category: milestoneId,
      isOverridden: false,
      isEnablementCost: Boolean(item.notes?.includes('[Enablement Cost]')),
    });

    byMilestone.set(milestoneId, group);
  });

  return previous.map((milestone) => ({
    ...milestone,
    items: byMilestone.get(milestone.id) || [],
  }));
}

function serializeForDiff(milestones: MilestoneData[]): string {
  return JSON.stringify(
    milestones.map((milestone) => ({
      id: milestone.id,
      items: milestone.items.map((item) => ({
        materialId: item.materialId,
        materialName: item.materialName,
        qty: item.quantity,
        calculatedQty: item.calculatedQuantity,
        price: item.actualPriceUsd,
        unit: item.unit,
        category: item.category,
        description: item.description,
        isOverridden: item.isOverridden,
      })),
    }))
  );
}

const getStepIllustration = (step: number) => {
  const illustrations = [
    { src: '/placeholder-blueprint.webp', title: 'Step 1: Project Type', desc: 'Choose the kind of BOQ you are building.' },
    { src: '/placeholder-substructure.webp', title: 'Step 2: Project Details', desc: 'Name and location set the pricing context.' },
    { src: '/placeholder-blueprint.webp', title: 'Step 3: Building Design', desc: 'Define floor area and structure details.' },
    { src: '/placeholder-superstructure.webp', title: 'Step 4: Materials & Scope', desc: 'Confirm scope and materials coverage.' },
    { src: '/placeholder-roofing.webp', title: 'Step 5: Site Setup & Labor', desc: 'Add labor and optional site setup items.' },
    { src: '/placeholder-blueprint.webp', title: 'Step 6: Review Estimate', desc: 'Adjust quantities before saving.' },
  ];

  const current = illustrations[step];
  if (!current) return null;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-900 group shadow-lg">
      <img src={current.src} alt={current.title} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 ease-out" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-8 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-4 text-[10px] font-bold tracking-widest text-white uppercase">
          [Nano Banana Gen Asset]
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">{current.title}</h3>
        <p className="text-slate-300 text-sm">{current.desc}</p>
      </div>
    </div>
  );
};

const WIZARD_STEPS = [
  {
    id: 'project-type',
    label: 'Project Type',
    title: 'What are we building?',
    subtitle: 'Choose between a full house build or costing individual stages.',
  },
  {
    id: 'project-details',
    label: 'Project Details',
    title: 'Project location & site',
    subtitle: 'Name your project and tell us where it is — location affects material pricing.',
  },
  {
    id: 'building-design',
    label: 'Building Design',
    title: 'Floor plan & building design',
    subtitle: 'Enter your floor area and define the structure — or draw rooms interactively.',
  },
  {
    id: 'materials-scope',
    label: 'Materials',
    title: 'Materials & transport',
    subtitle: 'Choose your brick, cement, and transport preferences for an accurate estimate.',
  },
  {
    id: 'labor',
    label: 'Labour',
    title: 'Labour costs',
    subtitle: 'Choose whether to include labour and how to calculate it.',
  },
  {
    id: 'review-estimate',
    label: 'Review Estimate',
    title: 'Review your estimate',
    subtitle: 'Check quantities and line items before saving.',
  },
];

function BoqNewPageContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated, profile } = useAuth();
  const projectIdFromUrl = searchParams.get('id');

  const [showInteractiveBuilder, setShowInteractiveBuilder] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [shakeError, setShakeError] = useState(false);
  const { error: showError } = useToast();

  const progressPct = Math.round((currentStep / WIZARD_STEPS.length) * 100);
  const minsRemaining = Math.max(1, (WIZARD_STEPS.length - currentStep) * 2);

  const {
    projectDetails,
    updateProjectDetails,
    geometryMode,
    setGeometryMode,
    detailedRooms,
    setDetailedRooms,
    totalWindows,
    setTotalWindows,
    totalDoors,
    setTotalDoors,
    projectScope,
    setProjectScope,
    selectedStages,
    setSelectedStages,
    laborType,
    setLaborType,
    milestonesState,
    setMilestonesState,
    temporaryWorksSelections,
    includeSepticTank,
    septicDimensions,
    geotechDocument,
    setGeotechDocument,
  } = useBoqWizardStore();

  const projectDetailsForSave = useMemo(() => {
    const hasProTier = profile?.tier === 'pro' || profile?.tier === 'admin';
    const geotechAnalysisMode: 'manual' | 'pro_available' | 'pro_applied' = geotechDocument?.id
      ? (hasProTier ? 'pro_available' : 'manual')
      : 'manual';

    return {
      name: projectDetails.name,
      location: getLocationLabel(projectDetails.locationType, projectDetails.locationCity, projectDetails.specificLocation),
      soilType: projectDetails.soilType,
      siteSlope: projectDetails.siteSlope,
      geotechReportUploaded: Boolean(geotechDocument?.id),
      geotechReportUploadedAt: geotechDocument?.createdAt || null,
      geotechReportDocumentId: geotechDocument?.id || null,
      geotechAnalysisMode,
    };
  }, [projectDetails, geotechDocument, profile]);

  const {
    project,
    isSaving,
    isAutoSaving,
    isLoading,
    lastSaved,
    hasUnsavedChanges,
    saveNow,
    createNewProject,
    markChanged,
  } = useProjectAutoSave(
    projectDetailsForSave,
    projectScope,
    selectedStages,
    laborType,
    milestonesState,
    {
      projectId: projectIdFromUrl,
      autoSaveInterval: 5000,
      onLoadComplete: (loadedProject: Project, items: DbBOQItem[]) => {
        const locationParts = (loadedProject.location || '').split(' - ');
        const locationType = normalizeLocationType(locationParts[0] || '');
        const locationCity = locationParts[1] || '';
        const specificLocation = locationParts[2] || '';
        const inferredType = inferProjectType(loadedProject.scope, loadedProject.selected_stages);

        updateProjectDetails({
          projectType: inferredType,
          name: loadedProject.name,
          locationType,
          locationCity,
          specificLocation,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          soilType: (loadedProject.soil_type || '') as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          siteSlope: (loadedProject.site_slope || '') as any,
        });

        const scopeRaw = loadedProject.scope;
        if (scopeRaw && scopeRaw !== 'entire_house') {
          setProjectScope('stage');
          const nextStages = loadedProject.selected_stages && loadedProject.selected_stages.length > 0
            ? loadedProject.selected_stages
            : [scopeRaw];
          setSelectedStages(nextStages);
        } else {
          setProjectScope('entire');
          setSelectedStages(loadedProject.selected_stages || []);
        }

        setLaborType(loadedProject.labor_preference === 'with_labor' ? 'materials_labor' : 'materials_only');

        if (loadedProject.geotech_report_document_id) {
          setGeotechDocument({
            id: loadedProject.geotech_report_document_id,
            fileName: 'Geotech Report',
            createdAt: loadedProject.geotech_report_uploaded_at || loadedProject.updated_at,
          });
        }

        const hydratedMilestones = mapLoadedItemsToMilestones(items, useBoqWizardStore.getState().milestonesState);
        setMilestonesState(hydratedMilestones);
      },
    }
  );

  useEffect(() => {
    const currentMilestones = useBoqWizardStore.getState().milestonesState;

    const nextMilestones = buildLiveMilestones({
      projectDetails,
      geometryMode: geometryMode ?? 'quick',
      detailedRooms,
      totalWindows,
      totalDoors,
      projectScope,
      selectedStages,
      laborType,
      temporaryWorksSelections,
      includeSepticTank,
      septicDimensions,
      previousMilestones: currentMilestones,
    });

    const currentSignature = serializeForDiff(currentMilestones);
    const nextSignature = serializeForDiff(nextMilestones);

    if (currentSignature !== nextSignature) {
      setMilestonesState(nextMilestones);
    }
  }, [
    projectDetails,
    geometryMode,
    detailedRooms,
    totalWindows,
    totalDoors,
    projectScope,
    selectedStages,
    laborType,
    temporaryWorksSelections,
    includeSepticTank,
    septicDimensions,
    setMilestonesState,
  ]);

  const changeSignature = useMemo(() => {
    return JSON.stringify({
      projectDetails,
      geometryMode,
      detailedRooms,
      totalWindows,
      totalDoors,
      projectScope,
      selectedStages,
      laborType,
      temporaryWorksSelections,
      includeSepticTank,
      septicDimensions,
      geotechDocument,
      milestonesState,
    });
  }, [
    projectDetails,
    geometryMode,
    detailedRooms,
    totalWindows,
    totalDoors,
    projectScope,
    selectedStages,
    laborType,
    temporaryWorksSelections,
    includeSepticTank,
    septicDimensions,
    geotechDocument,
    milestonesState,
  ]);

  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    if (!project?.id) {
      baselineRef.current = null;
      return;
    }

    if (baselineRef.current === null) {
      baselineRef.current = changeSignature;
      return;
    }

    if (baselineRef.current !== changeSignature) {
      markChanged();
    }
  }, [project?.id, changeSignature, markChanged]);

  useEffect(() => {
    if (project?.id && lastSaved) {
      baselineRef.current = changeSignature;
    }
  }, [project?.id, lastSaved, changeSignature]);

  const handleInteractiveBuilderContinue = (
    rooms: RoomInstance[],
    totals: { area: number; walls: number; bricks: number }
  ) => {
    setDetailedRooms(rooms);
    setGeometryMode('detailed');

    const windowCount = rooms.reduce((sum, room) => sum + room.windows, 0);
    const doorCount = rooms.reduce((sum, room) => sum + room.doors, 0);

    setTotalWindows(windowCount);
    setTotalDoors(doorCount);
    updateProjectDetails({ floorPlanSize: String(totals.area.toFixed(1)) });
    setShowInteractiveBuilder(false);
  };

  const persistInSessionAndRedirect = (url: string) => {
    sessionStorage.setItem('zimestimate_boq_pending_save', 'true');
    window.location.href = url;
  };

  const handleSave = async () => {
    if (!isAuthenticated) {
      setShowSavePrompt(true);
      return;
    }

    if (!project?.id) {
      const created = await createNewProject(projectDetailsForSave);
      if (created) {
        await saveNow();
      }
      return;
    }

    await saveNow();
  };

  const handleNextStep = () => {
    const currentState: BOQWizardValidationState = {
      currentSection: currentStep === 0
        ? 'project_type'
        : currentStep === 1
          ? 'project'
          : currentStep === 2
            ? 'geometry'
            : currentStep === 3
              ? 'scope'
              : currentStep === 4
                ? 'labor'
                : 'finished',
      geometryMode: geometryMode ?? 'quick',
      projectDetails,
      projectScope,
      selectedStages,
      laborType,
    };

    const validation = validateBOQWizardStep(currentState);

    if (Object.keys(validation.errors).length > 0) {
      setShakeError(true);
      if (validation.message) showError(validation.message);
      setTimeout(() => setShakeError(false), 500);
      return;
    }

    let nextStep = currentStep + 1;
    // Skip Labour step (index 4) if user chose materials_only
    if (nextStep === 4 && laborType !== 'materials_labor') {
      nextStep = 5; // Jump to Review
    }
    setCurrentStep(Math.min(WIZARD_STEPS.length - 1, nextStep));
  };

  return (
    <MainLayout fullWidth hideBottomNav>
      <div className="wiz-root min-h-[calc(100vh-80px)]">
        <div className="wiz-topbar sticky top-0 z-40 border-b">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="font-semibold" style={{color:'var(--wiz-text-primary)'}}>{projectDetails.name || 'Untitled Estimate'}</span>
              {isAutoSaving ? (
                <span className="wiz-badge-saving inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  <CircleNotch weight="bold" className="animate-spin" /> Saving
                </span>
              ) : hasUnsavedChanges ? (
                <span className="wiz-badge-unsaved inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Unsaved
                </span>
              ) : project?.id ? (
                <span className="wiz-badge-saved inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  <FloppyDisk weight="fill" /> Saved
                </span>
              ) : null}
            </div>

            <button
              type="button"
              className="wiz-btn-save hidden lg:inline-flex"
              onClick={handleSave}
            >
              <FloppyDisk size={15} weight="fill" />
              {isSaving ? 'Saving...' : 'Save Estimate'}
            </button>
          </div>
        </div>

        <LiveEstimatorLayout
          leftControls={(
            <div className="flex flex-col h-full min-h-[600px]">
              {/* ── Progress Bar (QP-style) ───────────────────────────────────── */}
              <div className="mb-8">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2" style={{color:'var(--wiz-text-faint)'}}>
                  <span>Step {currentStep + 1} of {WIZARD_STEPS.length}</span>
                  <span style={{color:'var(--wiz-primary)'}}>{progressPct}%</span>
                  <span>~{minsRemaining} min to complete</span>
                </div>
                <div className="wiz-progress-bar-track w-full">
                  <motion.div
                    className="wiz-progress-bar-fill"
                    style={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                {/* Step dots (clickable back-navigation) */}
                <div className="flex items-center gap-1 mt-3">
                  {WIZARD_STEPS.map((step, index) => (
                    <div
                      key={step.id}
                      onClick={() => { if (index < currentStep) setCurrentStep(index); }}
                      title={step.label}
                      className={`wiz-step-dot ${
                        index === currentStep
                          ? 'wiz-step-dot--active'
                          : index < currentStep
                          ? 'wiz-step-dot--complete'
                          : 'wiz-step-dot--upcoming'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* ── Step Header ──────────────────────────────────────────────── */}
              <div className="mb-8">
                <span className="wiz-step-label mb-2 block">BOQ MANUAL BUILDER</span>
                <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{color:'var(--wiz-text-primary)'}}>{WIZARD_STEPS[currentStep].title}</h2>
                <p className="text-sm" style={{color:'var(--wiz-text-muted)'}}>{WIZARD_STEPS[currentStep].subtitle}</p>
              </div>

              {/* Step Content */}
              <div className="flex-1 space-y-5 relative">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="space-y-5"
                  >
                    {currentStep === 0 && (
                      <ProjectTypeSection />
                    )}

                    {currentStep === 1 && (
                      <>
                        <ProjectLocationSection />
                        <SiteConditionsSection />
                      </>
                    )}

                    {currentStep === 2 && (
                      <BuildingDesignSection onLaunchRoomBuilder={() => setShowInteractiveBuilder(true)} />
                    )}

                    {currentStep === 3 && (
                      <MaterialsSection />
                    )}

                    {currentStep === 4 && (
                      <LaborSection />
                    )}

                    {currentStep === 5 && (
                      <ReviewTabs />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* ── Navigation Footer ────────────────────────────────────────── */}
              <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-8px_16px_rgba(0,0,0,0.05)] backdrop-blur-md sm:px-6 sm:py-4 lg:static lg:mt-10 lg:bg-transparent lg:p-0 lg:pt-6 lg:shadow-none lg:backdrop-blur-none">
                <button
                  type="button"
                  onClick={() => {
                    let prevStep = currentStep - 1;
                    // Skip Labour step (index 4) when going back if user chose materials_only
                    if (prevStep === 4 && laborType !== 'materials_labor') {
                      prevStep = 3;
                    }
                    setCurrentStep(Math.max(0, prevStep));
                  }}
                  className={`wiz-btn-secondary ${currentStep === 0 ? 'invisible' : 'visible'}`}
                >
                  <CaretLeft size={16} /> Back
                </button>

                {currentStep < WIZARD_STEPS.length - 1 ? (
                  <motion.button
                    type="button"
                    onClick={handleNextStep}
                    animate={{ x: shakeError ? [-5, 5, -5, 5, 0] : 0 }}
                    transition={{ duration: 0.4 }}
                    className="wiz-btn-primary"
                  >
                    Continue <CaretRight size={16} />
                  </motion.button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    className="wiz-btn-primary"
                  >
                    {isSaving ? <><CircleNotch weight="bold" className="animate-spin" /> Saving</> : <><Check weight="bold" size={16} /> Save Estimate</>}
                  </button>
                )}
              </div>
            </div>
          )}
          rightEstimate={currentStep === 5 ? <LiveEstimatePanel /> : null}
          heroIllustration={null}
        />

        {showInteractiveBuilder && (
          <div data-testid="room-builder-modal" className="fixed inset-0 z-[200] flex flex-col bg-slate-900/50 backdrop-blur-sm">
            <div className="relative z-[210] flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div>
                <h2 className="font-semibold text-slate-900">Interactive Floor Plan</h2>
                <p className="text-xs text-slate-500">Draw rooms to calculate derived area and openings.</p>
              </div>
              <button
                type="button"
                aria-label="Close floor plan"
                onClick={() => setShowInteractiveBuilder(false)}
                className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-red-50 hover:text-red-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative z-[205] flex-1 overflow-hidden bg-slate-100">
              <InteractiveRoomBuilder
                roomCounts={{}}
                targetFloorArea={Number(projectDetails.floorPlanSize) || 0}
                onContinue={handleInteractiveBuilderContinue}
                onBack={() => setShowInteractiveBuilder(false)}
              />
            </div>
          </div>
        )}

        {showSavePrompt && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <FloppyDisk size={28} weight="duotone" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Save to Dashboard</h3>
              <p className="mt-2 text-sm text-slate-500">Sign in or create an account to save and continue this estimate later.</p>

              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={() => persistInSessionAndRedirect('/auth/login?redirect=/boq/new')}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl bg-blue-50 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  onClick={() => persistInSessionAndRedirect('/auth/signup?redirect=/boq/new')}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700"
                  onClick={() => setShowSavePrompt(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <SavingOverlay
          isVisible={isSaving || isLoading}
          message={isSaving ? 'Saving estimate...' : 'Loading project...'}
        />
      </div>
    </MainLayout>
  );
}

export default function BoqNewPage() {
  return (
    <Suspense fallback={<MainLayout title="New BOQ"><div className="p-8 text-center">Loading BOQ builder...</div></MainLayout>}>
      <BoqNewPageContent />
    </Suspense>
  );
}
