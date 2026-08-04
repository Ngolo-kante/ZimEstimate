'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FloppyDisk, X, CircleNotch, CaretLeft, CaretRight, Check, ShareNetwork, FileArrowDown } from '@phosphor-icons/react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/components/providers/AuthProvider';
import SavingOverlay from '@/components/ui/SavingOverlay';
import { useProjectAutoSave } from '@/hooks/useProjectAutoSave';
import { useBoqWizardStore, DEFAULT_ROOM_INPUTS, type BoqMilestoneId, type MilestoneData, type BOQItem, type ProjectDetailsState } from '@/store/boqWizardStore';
import LiveEstimatorLayout from './components/LiveEstimatorLayout';
import LiveEstimatePanel from './components/LiveEstimatePanel';
import ReviewTabs from './components/ReviewTabs';
import { exportBOQToPDF } from '@/lib/pdf-export';
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
import { getTemplateById, resolveFinishLevel } from '@/lib/projectTemplates';
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
    title: 'Materials & finishes',
    subtitle: 'Choose your brick, cement, finish level, and transport preferences for an accurate estimate.',
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
  const templateIdFromUrl = searchParams.get('template');
  const finishFromUrl = searchParams.get('finish');

  const [showInteractiveBuilder, setShowInteractiveBuilder] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  // Opening from a template lands on the finished BOQ, so start there rather than
  // rendering step one and jumping, which also keeps setState out of the effect.
  const [shakeError, setShakeError] = useState(false);
  const { error: showError, success: showSuccess } = useToast();

  const {
    currentStep,
    setCurrentStep,
    maxStepReached,
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
    setValidationErrors,
  } = useBoqWizardStore();

  // Keeps the active step visible in the strip.
  //
  // This used to be a scrollIntoView in a ref callback on the active chip. Two
  // problems: block:'nearest' scrolls VERTICALLY as well, so whenever the user
  // had scrolled down past the header the page was yanked back up to the
  // stepper — which is what made selecting a card appear to jump to the top.
  // And the ref was an inline arrow, so React reattached it on every render and
  // re-ran the scroll on every state change, not just when the step moved.
  //
  // Scrolling the strip's own scrollLeft touches the horizontal axis only and
  // cannot move the page.
  const stepNavRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const nav = stepNavRef.current;
    const chip = nav?.children[currentStep] as HTMLElement | undefined;
    if (!nav || !chip) return;
    const target = chip.offsetLeft - nav.clientWidth / 2 + chip.clientWidth / 2;
    nav.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [currentStep]);

  // Puts the next step's heading at the top of the viewport.
  //
  // Removing the old scrollIntoView stopped the page being yanked upward mid
  // step, but left nothing to reset the scroll when the step actually changed.
  // Pressing Continue at the bottom of a long step rendered the next one and
  // kept the old offset, so the user arrived at the bottom of a question whose
  // top they had never seen.
  //
  // Called from the navigation handlers rather than from an effect on
  // currentStep. An effect looked correct and did nothing: this content sits
  // inside a Suspense boundary that re-suspends across a step change, so the
  // component remounts, a "previous step" ref re-initialises to the new value,
  // and the guard skipped every time. Scrolling where the user actually
  // pressed the button has no such failure mode.
  const scrollStepIntoView = () => {
    // Measured and scrolled synchronously, before the new step renders.
    //
    // That works because everything above this point — the top bar, the
    // progress bar, the step strip — is identical on every step, so the
    // heading's target position does not depend on which step is about to
    // mount. Waiting was the thing that kept breaking: rAF and timers are both
    // throttled in a backgrounded tab, and this content remounts across a step
    // change, so anything deferred either fired late or found a detached ref.
    const header = document.querySelector('.wiz-step-header') as HTMLElement | null;
    if (!header) return;
    // Measured, not hardcoded — the bar grows on small screens.
    const bar = document.querySelector('.wiz-topbar') as HTMLElement | null;
    const offset = (bar?.offsetHeight ?? 0) + 16;
    const top = header.getBoundingClientRect().top + window.scrollY - offset;
    // Instant, not smooth. A step change is a discrete navigation, and animating
    // a 2,000px trip is slow rather than polished. behavior:'smooth' also
    // silently does nothing in some engines, which hides the failure.
    window.scrollTo(0, Math.max(0, top));
  };

  const isReviewStep = currentStep === WIZARD_STEPS.length - 1;

  /**
   * The finished BOQ, assembled the same way BOQTable assembles it — scope and
   * labour decide which milestones count, and a line is quantity x actual price.
   */
  const reviewBoq = useMemo(() => {
    const visible = milestonesState.filter((m) => {
      if (m.id === 'labor') return laborType === 'materials_labor';
      if (projectScope === 'stage') return selectedStages.includes(m.id);
      return true;
    });

    const items = visible.flatMap((m) =>
      m.items.map((item) => ({
        material_name: item.materialName,
        category: m.label ?? m.id,
        quantity: item.quantity || 0,
        unit: item.unit,
        unit_price_usd: item.actualPriceUsd,
        unit_price_zwg: item.actualPriceZwg,
      }))
    );

    const usd = items.reduce((sum, i) => sum + i.quantity * i.unit_price_usd, 0);
    const zwg = items.reduce((sum, i) => sum + i.quantity * i.unit_price_zwg, 0);
    return { items, usd, zwg };
  }, [milestonesState, projectScope, selectedStages, laborType]);

  // Free, and deliberately so: the PDF is the thing that gets forwarded to a
  // builder or a lender, and it carries our name with it.
  const handleDownloadPdf = () => {
    if (reviewBoq.items.length === 0) {
      showError('Add some items to the estimate before downloading.');
      return;
    }
    exportBOQToPDF(
      {
        projectName: projectDetails.name || 'ZimEstimate BOQ',
        location: projectDetails.locationType || '',
        totalArea: Number(projectDetails.floorPlanSize) || 0,
        items: reviewBoq.items,
        totals: { usd: reviewBoq.usd, zwg: reviewBoq.zwg },
        config: {
          scope: projectScope === 'stage' ? 'stages' : 'entire_house',
          brickType: projectDetails.brickTypes?.[0] ?? 'common',
          cementType: projectDetails.cementTypes?.[0] ?? 'cement_325',
          includeLabor: laborType === 'materials_labor',
        },
      },
      'USD'
    );
  };

  const handleShareEstimate = async () => {
    const text = [
      `ZimEstimate — ${projectDetails.name || 'Construction estimate'}`,
      projectDetails.floorPlanSize ? `Floor area: ${projectDetails.floorPlanSize} m2` : '',
      `Items: ${reviewBoq.items.length}`,
      `Estimated total: $${Math.round(reviewBoq.usd).toLocaleString()}`,
    ].filter(Boolean).join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: 'ZimEstimate BOQ', text, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n\n${window.location.href}`);
      showError('Estimate summary copied to clipboard.');
    } catch {
      /* dismissed by the user — nothing to report */
    }
  };

  const progressPct = Math.round((currentStep / WIZARD_STEPS.length) * 100);
  const minsRemaining = Math.max(1, (WIZARD_STEPS.length - currentStep) * 2);

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
    error: saveError,
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

  // The store persists to localStorage with skipHydration, so restore any
  // in-progress wizard once we are on the client and past hydration.
  useEffect(() => {
    void useBoqWizardStore.persist.rehydrate();
  }, []);

  // A template link carried a ?template= parameter that nothing read, so picking
  // one opened an empty wizard. Apply its inputs and open the review step, which
  // is the finished BOQ the card priced.
  const templateAppliedRef = useRef(false);
  useEffect(() => {
    if (!templateIdFromUrl || templateAppliedRef.current) return;
    const template = getTemplateById(templateIdFromUrl);
    if (!template) return;

    templateAppliedRef.current = true;
    const finishLevel = resolveFinishLevel(template, finishFromUrl ?? undefined);
    const scopes = Array.isArray(template.scope) ? template.scope : [template.scope];

    updateProjectDetails({
      projectType: 'new_build',
      name: template.name,
      locationType: template.locationType,
      floorPlanSize: String(template.sqm),
      // liveEstimator gates on buildingType as a core input, so without it the
      // review step rendered zero line items.
      buildingType: 'single_storey',
      standSize: template.standAreaSqm ? String(template.standAreaSqm) : '',
      brickTypes: [template.brickType],
      cementTypes: [template.cementType],
      finishLevel,
      // The live estimator sums roomInputs for its room count, so write the
      // template's breakdown in — otherwise it falls back to floorArea / 28 and
      // the generated BOQ drifts from the price shown on the card.
      roomInputs: {
        ...DEFAULT_ROOM_INPUTS,
        bedrooms: String(template.rooms.bedrooms),
        bathrooms: String(template.rooms.bathrooms),
        livingRoom: String(template.rooms.livingRoom),
        kitchen: String(template.rooms.kitchen),
      },
    });
    setGeometryMode('quick');
    setLaborType(template.includeLabor ? 'materials_labor' : 'materials_only');

    if (scopes.includes('full_house')) {
      setProjectScope('entire');
    } else {
      setProjectScope('stage');
      setSelectedStages(scopes as string[]);
    }

    // A template card prices a finished build, so it opens on the review step.
    // This used to come from a lazy useState initialiser; the step now lives in
    // the persisted store, so the jump belongs here with the rest of the
    // template's inputs.
    setCurrentStep(WIZARD_STEPS.length - 1);
  }, [templateIdFromUrl, finishFromUrl, updateProjectDetails, setGeometryMode, setLaborType, setProjectScope, setSelectedStages, setCurrentStep]);

  // Carry the /projects/new wizard's answers across. That wizard asks for a
  // project name and location, stashes them under this key, then hands off to
  // here — but nothing ever read the key back, so four steps of input were
  // discarded and the builder opened on "Untitled Estimate" asking for the same
  // details again.
  //
  // Only the two free-text fields are restored. The two wizards use different
  // project-type vocabularies ('new-house' there, 'full_house' here) and they
  // mean different things — project category versus BOQ scope — so mapping
  // between them would guess at the user's intent rather than carry it.
  const handoffAppliedRef = useRef(false);
  useEffect(() => {
    if (handoffAppliedRef.current || templateIdFromUrl) return;
    handoffAppliedRef.current = true;

    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem('zimestimate_new_project');
      if (raw) sessionStorage.removeItem('zimestimate_new_project');
    } catch {
      return;
    }
    if (!raw) return;

    try {
      const handoff = JSON.parse(raw) as { name?: string; location?: string };
      const patch: Partial<ProjectDetailsState> = {};
      if (handoff.name?.trim()) patch.name = handoff.name.trim();
      if (handoff.location?.trim()) patch.specificLocation = handoff.location.trim();
      if (Object.keys(patch).length > 0) updateProjectDetails(patch);
    } catch {
      /* malformed handoff — fall back to an empty wizard */
    }
  }, [templateIdFromUrl, updateProjectDetails]);

  // Warn before discarding work that has not reached the database yet. Autosave
  // only runs for a signed-in user with a project, so anonymous progress lives
  // solely in localStorage until then.
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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

  const PENDING_SAVE_KEY = 'zimestimate_boq_pending_save';

  const persistInSessionAndRedirect = (url: string) => {
    sessionStorage.setItem(PENDING_SAVE_KEY, 'true');
    window.location.href = url;
  };

  /**
   * Returns whether the estimate actually reached the database.
   *
   * createNewProject swallows its failure and returns null, and the caller used
   * to ignore that — so a save that never happened looked exactly like one that
   * did: the button span, stopped, and nothing was said. The estimate was not
   * on the dashboard afterwards because it had never been written.
   */
  const runSave = async (): Promise<boolean> => {
    try {
      if (!project?.id) {
        const created = await createNewProject(projectDetailsForSave);
        if (!created) {
          showError(saveError || 'Could not save the estimate. Please try again.');
          return false;
        }
      }
      await saveNow();
      showSuccess('Estimate saved. Find it under My Projects.');
      return true;
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not save the estimate.');
      return false;
    }
  };

  const handleSave = async () => {
    if (!isAuthenticated) {
      setShowSavePrompt(true);
      return;
    }
    await runSave();
  };

  /**
   * Finishes a save that was interrupted by signing in.
   *
   * persistInSessionAndRedirect set this flag and nothing ever read it, so the
   * sequence "press Save, sign in, come back" ended with the wizard restored,
   * the user believing it was saved, and nothing written. Reported as an
   * estimate that never appeared on the dashboard.
   *
   * The flag is cleared before saving, not after, so a failure cannot leave it
   * set to retry forever on every subsequent visit.
   */
  const resumeRef = useRef(false);
  useEffect(() => {
    if (resumeRef.current || !isAuthenticated || isLoading) return;
    if (sessionStorage.getItem(PENDING_SAVE_KEY) !== 'true') return;

    resumeRef.current = true;
    sessionStorage.removeItem(PENDING_SAVE_KEY);
    void runSave();
    // runSave is recreated each render; the ref guard is what keeps this to one
    // attempt, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading]);

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
      // Publish the per-field errors so the inputs can mark themselves. The
      // toast alone never said which field was at fault.
      setValidationErrors(validation.errors as Record<string, string>);
      setShakeError(true);
      if (validation.message) showError(validation.message);
      setTimeout(() => setShakeError(false), 500);
      return;
    }

    setValidationErrors({});

    let nextStep = currentStep + 1;
    // Skip Labour step (index 4) if user chose materials_only
    if (nextStep === 4 && laborType !== 'materials_labor') {
      nextStep = 5; // Jump to Review
    }
    const target = Math.min(WIZARD_STEPS.length - 1, nextStep);
    setCurrentStep(target);
    scrollStepIntoView();
  };

  return (
    <>
      <div className="wiz-root min-h-[calc(100vh-80px)]">
        {/* Static, not sticky. It was `sticky top-0` while the app navbar also
            occupies the top of the viewport, so the project name and Save
            Estimate rendered directly on top of the logo and account menu.
            Letting it scroll away leaves one sticky element below the navbar
            — the live estimate — instead of three fighting for the same
            64 pixels. */}
        <div className="wiz-topbar border-b">
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

            {/* Hidden on the review step, where the action row below carries
                Save. Two Save Estimate buttons on the same screen was the
                complaint; mid-wizard this one is still the way to save
                progress to an account. */}
            {!isReviewStep && (
              <button
                type="button"
                className="wiz-btn-save hidden lg:inline-flex"
                onClick={handleSave}
              >
                <FloppyDisk size={15} weight="fill" />
                {isSaving ? 'Saving...' : 'Save Estimate'}
              </button>
            )}
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
                {/* Numbered steps. These were six anonymous 6px bars whose only
                    label was a title tooltip, so there was nothing on screen
                    saying which step was which, and the click handler moved
                    backwards only. Now every step the user has reached is a
                    labelled button they can jump to in either direction. */}
                <nav ref={stepNavRef} aria-label="Estimate steps" className="wiz-step-nav mt-3">
                  {WIZARD_STEPS.map((step, index) => {
                    const isCurrent = index === currentStep;
                    const reachable = index <= maxStepReached;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        disabled={!reachable}
                        aria-current={isCurrent ? 'step' : undefined}
                        onClick={() => { if (reachable) { setCurrentStep(index); scrollStepIntoView(); } }}
                        title={reachable ? step.label : `Complete step ${index} first`}
                        className={`wiz-step-chip ${
                          isCurrent
                            ? 'wiz-step-chip--active'
                            : reachable
                            ? 'wiz-step-chip--done'
                            : 'wiz-step-chip--locked'
                        }`}
                      >
                        <span className="wiz-step-chip__num">{index + 1}</span>
                        <span className="wiz-step-chip__label">{step.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* ── Step Header ──────────────────────────────────────────────── */}
              <div className="wiz-step-header mb-8">
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
              {/* In normal flow, like the quick-project wizards. As a fixed
                  bar it sat under the live estimate bar and above the global
                  bottom navigation, so Back and Continue were unreachable and
                  the quick menu was covered. pb-24 clears the 72px nav bar. */}
              <div className="flex items-center justify-between gap-2 border-t border-slate-200 mt-10 pt-6 pb-24 lg:pb-0">
                <button
                  type="button"
                  onClick={() => {
                    let prevStep = currentStep - 1;
                    // Skip Labour step (index 4) when going back if user chose materials_only
                    if (prevStep === 4 && laborType !== 'materials_labor') {
                      prevStep = 3;
                    }
                    setCurrentStep(Math.max(0, prevStep));
                    scrollStepIntoView();
                  }}
                  aria-label="Back"
                  className={`wiz-btn-secondary shrink-0 ${currentStep === 0 ? 'invisible' : 'visible'}`}
                >
                  <CaretLeft size={16} /> <span className="hidden sm:inline">Back</span>
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
                  /* Save Project / Share / Download BOQ, in that order — the
                     same row the budget estimator tabs use, so the actions do
                     not change shape between one part of the app and another.
                     Share and the PDF work signed out; only Save needs an
                     account, because only Save needs somewhere to put it. */
                  /* On a phone the labels are hidden and the icons carry the
                     row. Four words across a 360px screen wrapped onto three
                     lines, which pushed the actions below the fold on the one
                     screen where they matter most. Save keeps its word at every
                     width — it is the action people are looking for, and an
                     unlabelled tick is a guess. */
                  <div className="flex items-center justify-end gap-2 min-w-0">
                    <button type="button" onClick={handleSave} className="wiz-btn-primary shrink-0">
                      {isSaving ? <><CircleNotch weight="bold" className="animate-spin" /> Saving</> : <><Check weight="bold" size={16} /> Save<span className="hidden sm:inline">&nbsp;Project</span></>}
                    </button>
                    <button type="button" onClick={handleShareEstimate} aria-label="Share estimate" title="Share" className="wiz-btn-secondary shrink-0">
                      <ShareNetwork size={16} weight="bold" /> <span className="hidden sm:inline">Share</span>
                    </button>
                    <button type="button" onClick={handleDownloadPdf} aria-label="Download BOQ as PDF" title="Download BOQ" className="wiz-btn-secondary shrink-0">
                      <FileArrowDown size={16} weight="bold" /> <span className="hidden sm:inline">Download BOQ</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          // The running estimate belongs beside the inputs, not on the review
          // step, where ReviewTabs already lists every line item — showing both
          // rendered the BOQ twice.
          rightEstimate={currentStep < WIZARD_STEPS.length - 1 ? (
            <LiveEstimatePanel
              onViewFullBoq={() => {
                const review = WIZARD_STEPS.length - 1;
                setCurrentStep(review);
                scrollStepIntoView();
              }}
            />
          ) : null}
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
    </>
  );
}

export default function BoqNewPage() {
  return (
    // MainLayout sits OUTSIDE the boundary, and the fallback is bare.
    //
    // Both sides used to render their own MainLayout — the fallback one and the
    // content one — and the boundary kept the fallback's DOM mounted rather
    // than dropping it. The result was two <main> landmarks and a full ghost
    // copy of the wizard chrome sitting above the real one: two step headers,
    // two step navs, two of every id. Effects and refs bound against whichever
    // copy mounted last, which is not something to leave to chance in the one
    // flow the whole product is built around.
    <MainLayout fullWidth>
      <Suspense fallback={<div className="p-8 text-center">Loading BOQ builder...</div>}>
        <BoqNewPageContent />
      </Suspense>
    </MainLayout>
  );
}
