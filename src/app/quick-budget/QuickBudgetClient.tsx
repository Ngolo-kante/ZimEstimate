'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { estimateStageReach, stageStatusFromParams, stageStatusToParams, type StageId, type StageStatus } from '@/lib/estimators/stageBudgetEstimator';
import { HOUSE_DEFAULTS, HOUSE_PROFILES } from '@/lib/estimators/houseBudgetOptions';
import { generateBOQFromBasics, ManualBuilderConfig } from '@/lib/calculations';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { createProject, saveProjectWithItems } from '@/lib/services/projects';
import { setCreatedProjectSnapshot, setOptimisticProjectCard } from '@/lib/projectCreationCache';
import { createQuickBOQ } from '@/lib/services/quickBoq';
import FindContractorCTA from '@/components/contractors/FindContractorCTA';
import StageReachList from '@/components/quick-budget/StageReachList';
import type { BOQItem, LaborConfig } from '@/lib/quick-projects/engine/types';
import SolarBudgetExplorer from '@/components/quick-projects/SolarBudgetExplorer';
import BudgetFitExplorer from '@/components/quick-projects/BudgetFitExplorer';
import { fencingBudgetFit, pavingBudgetFit } from '@/lib/quick-projects/budgetFitConfigs';
import BoreholeBudgetExplorer from '@/components/quick-projects/BoreholeBudgetExplorer';
import { loadPdfExport, PDF_LOAD_ERROR } from '@/lib/loadPdfExport';
import CostDonut, { COST_COLORS } from '@/components/ui/CostDonut';
import RoofProfileIcon from '@/components/ui/RoofProfileIcon';
import RoofShapeIcon from '@/components/ui/RoofShapeIcon';
import { LABOR_STAGES, LABOR_SUBSTAGES, MAX_LABOR_PERCENTAGE, STAGE_LABOR_PERCENTAGES, defaultLaborPercentage, type LaborRates } from '@/lib/calculations/laborSubstages';
import { COUNCIL_TARIFF, councilFeesTotal } from '@/lib/projectFees';
import { DEFAULT_ROOF_COVERING, DEFAULT_ROOF_SHAPE, ROOF_COVERINGS, ROOF_SHAPES, type RoofCovering, type RoofShape } from '@/lib/calculations/roofingOptions';
import { captureProductEvent, getBudgetBand, recordSharedLinkArrival } from '@/lib/productAnalytics';
import {
  House,
  SunHorizon,
  Drop,
  Rows,
  GridFour,
  ShareNetwork,
  FloppyDisk,
  FileText,
  HouseLine,
  MapPin,
  Storefront,
} from '@phosphor-icons/react';

const locationOptions = [
  {
    id: 'urban',
    label: 'Urban',
    hint: 'City rates, better supplier access.',
    icon: Storefront,
  },
  {
    id: 'peri-urban',
    label: 'Peri-Urban',
    hint: 'Balanced transport and supplier availability.',
    icon: HouseLine,
  },
  {
    id: 'rural',
    label: 'Rural',
    hint: 'Higher transport and waste assumptions.',
    icon: MapPin,
  },
] as const;

const profileOptions = [
  {
    id: 'standard',
    label: 'Standard Build',
    hint: 'Normal wall heights and stronger cement profile.',
    config: HOUSE_PROFILES.standard,
  },
  {
    id: 'economy',
    label: 'Economy Build',
    hint: 'Leaner assumptions to stretch early budget.',
    config: HOUSE_PROFILES.economy,
  },
] as const;

const stageCategoryLabels: Record<string, string> = {
  substructure: 'Site Preparation & Foundation',
  superstructure: 'Structural Walls & Frame',
  roofing: 'Roofing',
  finishing: 'Interior & Finishing',
  services: 'Plumbing & Electrical',
  exterior: 'External Work',
};

export default function QuickBudgetPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { success: showSuccess, error: showError, info: showInfo } = useToast();
  // Starts empty: a budget arrives from the link (the home page passes what
  // was typed there) or the person types or taps one. A pre-filled $15,000
  // looked like an answer nobody had given.
  const [budgetInput, setBudgetInput] = useState('');
  const [floorAreaInput, setFloorAreaInput] = useState(String(HOUSE_DEFAULTS.area));
  const [locationType, setLocationType] = useState<(typeof locationOptions)[number]['id']>(HOUSE_DEFAULTS.location);
  const [roofCovering, setRoofCovering] = useState<RoofCovering>(DEFAULT_ROOF_COVERING);
  const [roofShape, setRoofShape] = useState<RoofShape>(DEFAULT_ROOF_SHAPE);
  // On by default: a house needs builders, and a materials-only figure made
  // budgets look further along than they are.
  const [includeLabor, setIncludeLabor] = useState(true);
  // One rate for every stage here; the full BOQ lets each stage differ.
  const [laborPct, setLaborPct] = useState(STAGE_LABOR_PERCENTAGES.substructure);
  const laborRates = useMemo(
    // Left at the default, each trade uses its own rate (plastering and
    // boundary walls are not 35%); a rate the user types applies to all.
    () => (laborPct === STAGE_LABOR_PERCENTAGES.substructure ? {} : Object.fromEntries(LABOR_STAGES.map((stage) => [stage, laborPct]))) as LaborRates,
    [laborPct],
  );
  // Stages already built, or left for later, are not paid for from this budget.
  const [stageStatus, setStageStatus] = useState<Partial<Record<StageId, StageStatus>>>({});
  const [buildProfile, setBuildProfile] = useState<(typeof profileOptions)[number]['id']>(HOUSE_DEFAULTS.profile);
  const [stageEstimate, setStageEstimate] = useState<ReturnType<typeof estimateStageReach> | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isGeneratingBOQ, setIsGeneratingBOQ] = useState(false);
  // Which budget the user is checking. The house estimator was the only one
  // reachable from here, while the solar and borehole explorers were buried
  // inside their quick-project wizards.
  const [budgetMode, setBudgetMode] = useState<'house' | 'solar' | 'borehole' | 'fencing' | 'paving'>('house');

  // Restore inputs from the query string. Serves two paths: the home hero
  // handing its typed budget over via ?budget=, and returning from sign-in
  // after pressing Save, which round-trips every input so the estimate the
  // user built is still there rather than reset to defaults.
  // Read via window.location rather than useSearchParams to avoid wrapping the
  // whole page in the Suspense boundary Next requires for that hook.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const budgetRaw = params.get('budget');
    if (budgetRaw) {
      const value = Number(budgetRaw.replace(/[^0-9]/g, ''));
      if (Number.isFinite(value) && value > 0) setBudgetInput(String(value));
    }

    const areaRaw = params.get('area');
    if (areaRaw) {
      const value = Number(areaRaw.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(value) && value > 0) setFloorAreaInput(String(value));
    }

    const loc = params.get('loc');
    if (locationOptions.some((option) => option.id === loc)) {
      setLocationType(loc as (typeof locationOptions)[number]['id']);
    }

    const roof = params.get('roof');
    if (roof && roof in ROOF_COVERINGS) setRoofCovering(roof as RoofCovering);
    const shape = params.get('shape');
    if (shape && shape in ROOF_SHAPES) setRoofShape(shape as RoofShape);
    if (params.get('labour') === '0') setIncludeLabor(false);
    const pctRaw = Number(params.get('labourPct'));
    if (params.get('labourPct') && Number.isFinite(pctRaw)) setLaborPct(Math.min(MAX_LABOR_PERCENTAGE, Math.max(0, pctRaw)));
    setStageStatus(stageStatusFromParams(params));

    const profile = params.get('profile');
    if (profileOptions.some((option) => option.id === profile)) {
      setBuildProfile(profile as (typeof profileOptions)[number]['id']);
    }

    // Solar and borehole send the user through sign-in with ?mode=, so Save
    // returns them to the tab they pressed it on rather than the house tab.
    const mode = params.get('mode');
    // Every tab can be linked to — the "Start an estimate" page links straight
    // to each budget check, and fencing and paving used to fall back to house.
    if (mode === 'solar' || mode === 'borehole' || mode === 'fencing' || mode === 'paving') setBudgetMode(mode);

    // Someone opened a shared estimate. Held until they answer the consent
    // banner — see recordSharedLinkArrival.
    if (params.get('src') === 'share') {
      recordSharedLinkArrival(mode === 'solar' || mode === 'borehole' ? mode : 'house');
    }
  }, []);

  const parsedBudget = Number(budgetInput.replace(/,/g, ''));
  const parsedArea = Number(floorAreaInput.replace(/,/g, ''));

  const estimatorErrors = {
    budget: !budgetInput || !Number.isFinite(parsedBudget) || parsedBudget <= 0
      ? 'Enter a valid budget amount in USD.'
      : '',
    area: !floorAreaInput || !Number.isFinite(parsedArea) || parsedArea <= 0
      ? 'Enter a valid floor-plan size in m2.'
      : '',
  };

  const selectedProfile = useMemo(
    () => profileOptions.find((option) => option.id === buildProfile) ?? profileOptions[0],
    [buildProfile]
  );

  const manualBuilderConfig = useMemo<ManualBuilderConfig | null>(() => {
    if (estimatorErrors.budget || estimatorErrors.area) return null;
    const roomCount = Math.max(4, Math.round(parsedArea / 28));
    return {
      floorArea: parsedArea,
      roomCount,
      wallHeight: selectedProfile.config.wallHeightM,
      brickTypes: ['common'],
      cementTypes: [selectedProfile.config.cementType],
      scope: 'full_house',
      includeLabor,
      laborRates,
      locationType,
      roofCovering,
      roofShape,
    };
  }, [estimatorErrors.area, estimatorErrors.budget, locationType, roofCovering, roofShape, includeLabor, laborRates, parsedArea, selectedProfile.config.cementType, selectedProfile.config.wallHeightM]);

  const detailedItems = useMemo(() => {
    if (!manualBuilderConfig) return [];
    return generateBOQFromBasics(manualBuilderConfig);
  }, [manualBuilderConfig]);

  // The lines this budget pays for: stages already built or left for later are
  // dropped, and so is their labour (a labour line names its sub-stage).
  const countedItems = useMemo(() => detailedItems.filter((item) => {
    const stage = item.category === 'labor'
      ? LABOR_SUBSTAGES.find((substage) => `labor-${substage.id}` === item.materialId)?.stage
      : item.category;
    return !stage || (stageStatus[stage as StageId] ?? 'build') === 'build';
  }), [detailedItems, stageStatus]);

  const totals = useMemo(() => {
    return countedItems.reduce(
      (acc, item) => {
        acc.usd += item.totalUsd || 0;
        acc.zwg += item.totalZwg || 0;
        return acc;
      },
      { usd: 0, zwg: 0 }
    );
  }, [countedItems]);

  useEffect(() => {
    if (estimatorErrors.budget || estimatorErrors.area) {
      setStageEstimate(null);
      setIsCalculating(false);
      return;
    }

    setIsCalculating(true);
    const timer = window.setTimeout(() => {
      const result = estimateStageReach({
        budgetUsd: parsedBudget,
        floorAreaM2: parsedArea,
        locationType,
        roofCovering,
        roofShape,
        includeLabor,
        laborRates,
        stageStatus,
        wallHeightM: selectedProfile.config.wallHeightM,
        cementTypes: [selectedProfile.config.cementType],
      });
      setStageEstimate(result);
      setIsCalculating(false);
    }, 520);

    return () => window.clearTimeout(timer);
  }, [
    estimatorErrors.area,
    estimatorErrors.budget,
    locationType,
    roofCovering,
    roofShape,
    includeLabor,
    laborRates,
    stageStatus,
    parsedArea,
    parsedBudget,
    selectedProfile.config.cementType,
    selectedProfile.config.wallHeightM,
  ]);

  const nextLockedStage = useMemo(() => {
    if (!stageEstimate) return null;
    return stageEstimate.rows.find((stage) => stage.status === 'build' && !stage.affordable) ?? null;
  }, [stageEstimate]);

  const locationLabel = useMemo(() => {
    return locationOptions.find((option) => option.id === locationType)?.label ?? 'Urban';
  }, [locationType]);

  const councilFees = useMemo(() => {
    const floorArea = Number(floorAreaInput) || 0;
    return {
      low: councilFeesTotal({ floorArea, density: 'low', doubleStorey: false }),
      high: councilFeesTotal({ floorArea, density: 'high', doubleStorey: false }),
    };
  }, [floorAreaInput]);
  const overallPercent = stageEstimate ? Math.round(stageEstimate.coveragePercent) : 0;
  const buildStageCount = stageEstimate?.rows.filter((stage) => stage.status === 'build').length ?? 0;
  const affordableStageCount = stageEstimate?.rows.filter((stage) => stage.status === 'build' && stage.affordable).length ?? 0;
  const setStatus = (id: StageId, status: StageStatus) =>
    setStageStatus((current) => {
      const next = { ...current, [id]: status };
      if (status === 'build') delete next[id];
      return next;
    });

  const coverageTone = useMemo(() => {
    if (!stageEstimate) return 'idle';
    if (overallPercent >= 90) return 'secure';
    if (overallPercent >= 55) return 'balanced';
    return 'fragile';
  }, [overallPercent, stageEstimate]);

  const coverageLabel = useMemo(() => {
    if (!stageEstimate) return 'Waiting for inputs';
    if (overallPercent >= 100) return 'Fully funded path';
    if (overallPercent >= 70) return 'Strong partial coverage';
    if (overallPercent >= 45) return 'Early-stage funding';
    return 'Insufficient funding';
  }, [overallPercent, stageEstimate]);

  const formatUsd = (amount: number) => `$${Math.round(amount).toLocaleString()}`;

  const handleSaveProject = async () => {
    if (!manualBuilderConfig || !stageEstimate) {
      showError('Complete valid inputs first to save this estimate.');
      return;
    }

    if (!isAuthenticated) {
      // Carry the inputs through the sign-in round trip. Without them the user
      // returns to a reset form and has to rebuild the estimate they just made.
      const restore = new URLSearchParams({
        budget: String(parsedBudget),
        area: String(parsedArea),
        loc: locationType,
        roof: roofCovering,
        shape: roofShape,
        labour: includeLabor ? '1' : '0',
        ...(laborPct !== STAGE_LABOR_PERCENTAGES.substructure ? { labourPct: String(laborPct) } : {}),
        profile: buildProfile,
        ...stageStatusToParams(stageStatus),
      });
      showInfo('Please sign in to save this project.');
      router.push(`/auth/login?redirect=${encodeURIComponent(`/quick-budget?${restore}`)}`);
      return;
    }

    setIsSavingProject(true);
    try {
      const projectName = `Quick Budget ${parsedArea}m2`;
      const { project, error: createError } = await createProject({
        name: projectName,
        location: locationLabel,
        description: `Budget check: $${Math.round(parsedBudget).toLocaleString()} budget, ${overallPercent}% coverage.`,
        scope: 'entire_house',
        labor_preference: includeLabor ? 'with_labor' : 'materials_only',
        soil_type: null,
        site_slope: null,
        geotech_report_uploaded: false,
        geotech_report_uploaded_at: null,
        geotech_report_document_id: null,
        geotech_analysis_mode: 'manual',
      });

      if (createError || !project) {
        showError(createError?.message || 'Failed to create project.');
        return;
      }

      const itemsPayload = countedItems.map((item, index) => ({
        material_id: item.materialId,
        material_name: item.materialName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        unit_price_usd: item.unitPriceUsd,
        unit_price_zwg: item.unitPriceZwg,
        notes: item.calculationNote,
        sort_order: index,
      }));

      const { project: savedProject, items: savedItems, error: saveError } = await saveProjectWithItems(
        project.id,
        {
          total_usd: totals.usd,
          total_zwg: totals.zwg,
          selected_stages: stageEstimate.rows.filter((row) => row.status === 'build' && row.affordable).map((row) => row.id),
        },
        itemsPayload
      );

      if (saveError || !savedProject) {
        showError(saveError?.message || 'Project was created, but BOQ items failed to save.');
        return;
      }

      setOptimisticProjectCard({
        id: savedProject.id,
        name: savedProject.name,
        location: savedProject.location || locationLabel,
        type: 'quick-budget',
      });
      setCreatedProjectSnapshot({
        project: savedProject,
        items: savedItems,
      });

      showSuccess('Project saved successfully.');
      captureProductEvent('estimate_saved', { estimate: 'house', budget_band: getBudgetBand(parsedBudget) });
      router.push(`/projects?saved=${savedProject.id}`);
    } catch (error) {
      console.error(error);
      showError('Failed to save project.');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleShare = async () => {
    if (!stageEstimate) {
      showError('Run an estimate first before sharing.');
      return;
    }

    const shareText = [
      'ZimEstimate Quick Budget Check',
      `Budget: $${Math.round(parsedBudget).toLocaleString()}`,
      `Floor Area: ${parsedArea} m2`,
      `Location: ${locationLabel}`,
      `Coverage: ${Math.round(stageEstimate.coveragePercent)}%`,
      `Likely Reach: ${stageEstimate.reachableStageLabel}`,
    ].join('\n');

    /* A link that rebuilds this estimate. It used to be window.location.href —
       the page's address with none of what was typed in it — so whoever
       opened the WhatsApp message got the default $15,000 estimate, not the
       one being shown to them. These are the parameters the page already
       restores on load. */
    const link = `${window.location.origin}/quick-budget?${new URLSearchParams({
      budget: String(Math.round(parsedBudget)),
      area: String(parsedArea),
      loc: locationType,
      roof: roofCovering,
      shape: roofShape,
      labour: includeLabor ? '1' : '0',
      ...(laborPct !== STAGE_LABOR_PERCENTAGES.substructure ? { labourPct: String(laborPct) } : {}),
      profile: buildProfile,
      ...stageStatusToParams(stageStatus),
      // Marks an arrival from a share, so it can be counted when opened.
      src: 'share',
    }).toString()}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Quick Budget Estimate',
          text: shareText,
          url: link,
        });
        showSuccess('Estimate shared.');
        captureProductEvent('estimate_shared', { estimate: 'house', method: 'share_sheet', budget_band: getBudgetBand(parsedBudget) });
        return;
      }

      await navigator.clipboard.writeText(`${shareText}\n\n${link}`);
      showSuccess('Estimate summary copied to clipboard.');
      captureProductEvent('estimate_shared', { estimate: 'house', method: 'clipboard', budget_band: getBudgetBand(parsedBudget) });
    } catch {
      showError('Sharing was cancelled or unavailable.');
    }
  };

  const handleGenerateBOQ = async () => {
    if (!manualBuilderConfig || detailedItems.length === 0) {
      showError('Complete valid inputs first to generate a BOQ.');
      return;
    }

    setIsGeneratingBOQ(true);
    try {
      // jsPDF is ~100 KB compressed — loaded on click rather than with the
      // page, for a button most visitors never press.
      const pdf = await loadPdfExport('budget_estimator');
      if (!pdf) {
        showError(PDF_LOAD_ERROR);
        return;
      }
      pdf.exportBOQToPDF(
        {
          projectName: `Detailed BOQ - ${parsedArea}m2`,
          location: locationLabel,
          totalArea: parsedArea,
          items: countedItems.map((item) => ({
            material_name: item.materialName,
            category: stageCategoryLabels[item.category] || item.category,
            quantity: item.quantity,
            unit: item.unit,
            unit_price_usd: item.unitPriceUsd,
            unit_price_zwg: item.unitPriceZwg,
            note: item.calculationNote,
          })),
          totals: {
            usd: totals.usd,
            zwg: totals.zwg,
          },
          config: {
            scope: 'entire_house',
            brickType: 'common',
            cementType: selectedProfile.config.cementType,
            includeLabor,
          },
        },
        'USD'
      );
      showSuccess('Detailed BOQ generated.');
    } catch (error) {
      console.error(error);
      showError('Failed to generate detailed BOQ.');
    } finally {
      setIsGeneratingBOQ(false);
    }
  };

  // Save Project on the solar and borehole tabs. Without an onSave the explorers
  // have nothing to save to, and their Save button used to be hidden entirely on
  // this page — which is why the three tabs disagreed about their action row.
  const saveQuickBudget = async (
    projectType: 'solar' | 'borehole' | 'fencing' | 'paving',
    boqItems: BOQItem[],
    answers: Record<string, unknown>,
    labor: LaborConfig
  ) => {
    if (!isAuthenticated) {
      // Same round trip as the house tab: come back to the tab they were on.
      showInfo('Please sign in to save this project.');
      router.push(`/auth/login?redirect=${encodeURIComponent(`/quick-budget?mode=${projectType}`)}`);
      return;
    }

    const { boq, error } = await createQuickBOQ({ projectType, answers, boqItems, labor, currency: 'USD' });

    if (error) {
      showError(error.message || 'Failed to save estimate.');
      return;
    }

    captureProductEvent('estimate_saved', { estimate: projectType });

    // The sixth and last save path. It went to /projects/quick, a list that no
    // longer exists as its own page — every builder now finishes in the same
    // place, on the row it just created.
    router.push(boq ? `/projects?saved=${boq.id}` : '/projects');
  };

  return (
    <MainLayout fullWidth title="Budget Estimator">
      <div className="budget-checker-page">
        <div className="ambient ambient-one" aria-hidden />
        <div className="ambient ambient-two" aria-hidden />

        {/* What kind of budget? The house estimator used to be the whole page,
            with no sign that solar and borehole budgets existed at all. */}
        <nav className="budget-modes" aria-label="What are you budgeting for?">
          <div className="budget-modes__grid">
            {([
              { id: 'house', icon: House, title: 'House build', hint: 'How far your budget carries a full build, stage by stage.' },
              { id: 'solar', icon: SunHorizon, title: 'Solar system', hint: 'What panel, battery and inverter setup your budget buys.' },
              { id: 'borehole', icon: Drop, title: 'Borehole', hint: 'Drilling, casing and pump against what you have to spend.' },
              /* Fencing and paving answer the question from the other side —
                 how much you can buy — because their size is a choice. Septic
                 and water are deliberately absent: those are sized by what the
                 household needs, and inviting someone to buy "as much septic
                 tank as they can afford" would encourage under-sizing the one
                 thing that fails slowly and expensively. */
              { id: 'fencing', icon: Rows, title: 'Fencing', hint: 'How many metres of wall or fence your budget covers.' },
              { id: 'paving', icon: GridFour, title: 'Paving', hint: 'How much driveway or yard you can pave for the money.' },
            ] as const).map((mode) => {
              const Icon = mode.icon;
              const active = budgetMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBudgetMode(mode.id)}
                  className={`budget-mode-card${active ? ' is-active' : ''}`}
                  title={mode.hint}
                >
                  <Icon size={18} weight={active ? 'fill' : 'duotone'} />
                  <strong>{mode.title}</strong>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Every kind of budget sits on this one page under the same tabs, so
            switching between them never leaves the page or needs a "back". */}
        {budgetMode !== 'house' ? (
          <section className="explorer-panel">
            {budgetMode === 'solar' ? (
              <SolarBudgetExplorer
                onSave={(output) =>
                  saveQuickBudget('solar', output.boqItems ?? [], output.answers as unknown as Record<string, unknown>, {
                    enabled: false,
                    method: 'percentage',
                    percentage: 25,
                  })
                }
              />
            ) : budgetMode === 'borehole' ? (
              <BoreholeBudgetExplorer
                onSave={(items, answers, labor) => saveQuickBudget('borehole', items, answers, labor)}
              />
            ) : (
              <BudgetFitExplorer
                // Fencing and paving share this component; without a key the
                // fence type carries over to paving, which has no such type.
                key={budgetMode}
                config={budgetMode === 'fencing' ? fencingBudgetFit : pavingBudgetFit}
                initialBudget={budgetInput}
                onSave={(items, answers, labor) => saveQuickBudget(budgetMode, items, answers, labor)}
              />
            )}
          </section>
        ) : (
        <section className="workspace-grid">
          <div className="control-panel">
            <div className="panel-card">
              <div className="section-head">
                <h2>Your budget</h2>
              </div>

              <div className="field">
                <label htmlFor="budget-input">Available Budget (USD)</label>
                <Input
                  id="budget-input"
                  type="number"
                  min="1"
                  step="1"
                  value={budgetInput}
                  onChange={(event) => setBudgetInput(event.target.value)}
                  placeholder="e.g. 15000"
                  error={(budgetInput && estimatorErrors.budget) || undefined}
                />
              </div>

              <div className="presets">
                {['10000', '15000', '25000', '40000'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`preset ${budgetInput === value ? 'active' : ''}`}
                    onClick={() => setBudgetInput(value)}
                  >
                    {formatUsd(Number(value))}
                  </button>
                ))}
              </div>

              <div className="field">
                <label htmlFor="area-input">Floor Plan Size (m2)</label>
                <Input
                  id="area-input"
                  type="number"
                  min="1"
                  step="0.1"
                  value={floorAreaInput}
                  onChange={(event) => setFloorAreaInput(event.target.value)}
                  placeholder="e.g. 120"
                  error={estimatorErrors.area || undefined}
                />
              </div>
            </div>

            <div className="panel-card">
              <div className="section-head">
                <h2>Roof</h2>
                <span>{ROOF_SHAPES[roofShape].label}, {ROOF_COVERINGS[roofCovering].label}</span>
              </div>
              <p className="roof-sub">Roof shape</p>
              <div className="roof-grid roof-shapes" role="group" aria-label="Roof shape">
                {(Object.entries(ROOF_SHAPES) as [RoofShape, (typeof ROOF_SHAPES)[RoofShape]][]).map(([id, option]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={roofShape === id}
                    className={`roof-choice ${roofShape === id ? 'selected' : ''}`}
                    onClick={() => setRoofShape(id)}
                    title={option.description}
                  >
                    <RoofShapeIcon shape={id} className="roof-icon" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              <p className="roof-sub">Roof covering</p>
              <div className="roof-grid" role="group" aria-label="Roof covering">
                {(Object.entries(ROOF_COVERINGS) as [RoofCovering, (typeof ROOF_COVERINGS)[RoofCovering]][]).map(([id, option]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={roofCovering === id}
                    className={`roof-choice ${roofCovering === id ? 'selected' : ''}`}
                    onClick={() => setRoofCovering(id)}
                    title={option.description}
                  >
                    <RoofProfileIcon covering={id} className="roof-icon" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-card">
              <div className="section-head">
                <h2>Assumptions</h2>
              </div>

              <div className="assumption">
                <span className="assumption-label">Labour</span>
                <div className="labour-row">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeLabor}
                    aria-label="Include labour"
                    className={`labour-switch ${includeLabor ? 'on' : ''}`}
                    onClick={() => setIncludeLabor((value) => !value)}
                  >
                    <span className="knob" aria-hidden="true" />
                  </button>
                  {includeLabor ? (
                    <label className="labour-pct">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={MAX_LABOR_PERCENTAGE}
                        step={1}
                        value={laborPct}
                        onChange={(event) => setLaborPct(Math.min(MAX_LABOR_PERCENTAGE, Math.max(0, Number(event.target.value) || 0)))}
                        aria-label="Labour as a percentage of materials"
                      />
                      <span>% of materials</span>
                    </label>
                  ) : (
                    <span className="labour-off">Materials only</span>
                  )}
                </div>
                {includeLabor && laborPct === STAGE_LABOR_PERCENTAGES.substructure && (
                  <details className="labour-explain">
                    <summary>How labour is worked out</summary>
                    <p>
                      Builders here price labour as a share of the materials, or per square metre for plastering and tiling.
                      We use rates from builders&apos; quotes in Zimbabwe building groups (October 2026): most trades at {STAGE_LABOR_PERCENTAGES.substructure}% of their
                      materials; plastering, where the materials are cheap and the work is not, at {defaultLaborPercentage('plaster')}% (about $3 a m² of wall);
                      roofing at {defaultLaborPercentage('roof_cover')}%; boundary walls at {defaultLaborPercentage('boundary')}% (about $20 a metre).
                    </p>
                    {stageEstimate && stageEstimate.laborByTrade.length > 0 && (
                      <table>
                        <thead><tr><th scope="col">Trade</th><th scope="col">Rate</th><th scope="col">Labour</th><th scope="col">Per m² of floor</th></tr></thead>
                        <tbody>
                          {stageEstimate.laborByTrade.map((trade) => (
                            <tr key={trade.id}>
                              <th scope="row">{trade.label}</th>
                              <td>{trade.percent}%</td>
                              <td>{formatUsd(trade.usd)}</td>
                              <td>${trade.perM2.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <p>Typing one rate above applies it to every trade. Builders&apos; quotes vary widely: compare two or three.</p>
                  </details>
                )}
                {includeLabor && laborPct !== STAGE_LABOR_PERCENTAGES.substructure && (
                  <button type="button" className="link-button" onClick={() => setLaborPct(STAGE_LABOR_PERCENTAGES.substructure)}>
                    Back to {STAGE_LABOR_PERCENTAGES.substructure}%, the Zimbabwe rule of thumb
                  </button>
                )}
              </div>

              <div className="assumption">
                <span className="assumption-label">Location</span>
                <div className="segmented" role="group" aria-label="Location">
                  {locationOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={locationType === option.id}
                      className={locationType === option.id ? 'on' : ''}
                      onClick={() => setLocationType(option.id)}
                      title={option.hint}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <small>{locationOptions.find((option) => option.id === locationType)?.hint}</small>
              </div>

              <div className="assumption">
                <span className="assumption-label">Build</span>
                <div className="segmented" role="group" aria-label="Build profile">
                  {profileOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={buildProfile === option.id}
                      className={buildProfile === option.id ? 'on' : ''}
                      onClick={() => setBuildProfile(option.id)}
                      title={option.hint}
                    >
                      {option.label.replace(/ Build$/, '')}
                    </button>
                  ))}
                </div>
                <small>{selectedProfile.hint}</small>
              </div>
            </div>
          </div>

          <div className="results-panel">
            {isCalculating ? (
              <div className="loading-card">
                <div className="loader" />
                <p>Recomputing stage reach...</p>
                <div className="loading-lines">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : stageEstimate ? (
              <>
                <div className="result-top">
                  <div className="ring-col">
                  <div
                    className="coverage-ring"
                    style={{
                      background: `conic-gradient(#2e6cf6 ${Math.max(0, Math.min(100, overallPercent))}%, rgba(203, 213, 225, 0.38) ${Math.max(0, Math.min(100, overallPercent))}% 100%)`,
                    }}
                  >
                    <div>
                      <span>Coverage</span>
                      <strong>{overallPercent}%</strong>
                    </div>
                  </div>
                  <span className={`status-pill tone-${coverageTone}`}>{coverageLabel}</span>
                  </div>

                  <div className="result-stats">
                    <article>
                      <span>{buildStageCount < 5 ? 'Still to build' : 'Full build'}</span>
                      <strong>{formatUsd(stageEstimate.estimatedTotalUsd)}</strong>
                    </article>
                    <article>
                      <span>Stages covered</span>
                      <strong>{affordableStageCount} / {buildStageCount}</strong>
                    </article>
                    <article className={stageEstimate.budgetUsd >= stageEstimate.estimatedTotalUsd ? 'spare' : 'short'}>
                      <span>{stageEstimate.budgetUsd >= stageEstimate.estimatedTotalUsd ? 'To spare' : 'Short by'}</span>
                      <strong>{formatUsd(Math.abs(stageEstimate.budgetUsd - stageEstimate.estimatedTotalUsd))}</strong>
                    </article>
                  </div>
                </div>

                {/* The shortfall, not the next stage's full price: "Next stage
                    gap: $4,669" read as $4,669 missing when the budget already
                    covered three quarters of it. */}
                <div className="guidance">
                  {nextLockedStage
                    ? <>Your budget covers {affordableStageCount} of the {buildStageCount}{buildStageCount < 5 ? ' stages still to build' : ' stages'}. About <strong>{formatUsd(nextLockedStage.stageCostUsd * (1 - Math.min(100, nextLockedStage.coveragePercent) / 100))}</strong> more finishes {nextLockedStage.label}{stageEstimate.estimatedTotalUsd - stageEstimate.budgetUsd > nextLockedStage.stageCostUsd * (1 - Math.min(100, nextLockedStage.coveragePercent) / 100) + 1 ? <>, and {formatUsd(stageEstimate.estimatedTotalUsd - stageEstimate.budgetUsd)} the whole house</> : ''}.</>
                    : <>Your budget covers every stage{stageEstimate.budgetUsd > stageEstimate.estimatedTotalUsd ? <>, with about <strong>{formatUsd(stageEstimate.budgetUsd - stageEstimate.estimatedTotalUsd)}</strong> to spare</> : ''}.</>}
                </div>

                <div className="budget-split">
                  <h3>Where the money goes</h3>
                  <CostDonut
                    size="sm"
                    format={formatUsd}
                    centerLabel="With fees"
                    hideEmpty
                    slices={[
                      { label: 'Materials', value: stageEstimate.materialsUsd, color: COST_COLORS.materials },
                      { label: 'Labour', value: stageEstimate.laborUsd, color: COST_COLORS.labor },
                      { label: 'Council fees & inspections', value: councilFees.low, color: COST_COLORS.fees, note: 'Low-density stand' },
                    ]}
                  />
                  {councilFees.low > 0 && (
                    <p className="council-note">
                      Council fees are from the {COUNCIL_TARIFF.name} for a low-density stand ({formatUsd(councilFees.high)} in high density) and are not counted in how far your budget goes. Drawings are extra.
                    </p>
                  )}
                </div>

                <StageReachList rows={stageEstimate.rows} lines={detailedItems} onStatusChange={setStatus} />

                <p className="note">Indicative only: prices, design and your builder&apos;s rates will move the final figure.</p>

                <FindContractorCTA projectType="house" />


                {/* Save Project / Share / Generate BOQ, in this order, is the
                    action row every budget tab shows — the solar and borehole
                    explorers repeat it so switching tabs does not change what
                    the buttons at the bottom are or where they sit. */}
                <div className="actions">
                  <Button
                    variant="primary"
                    icon={<FloppyDisk size={16} />}
                    onClick={handleSaveProject}
                    loading={isSavingProject}
                  >
                    Save Project
                  </Button>
                  <Button variant="secondary" icon={<ShareNetwork size={16} />} onClick={handleShare}>
                    Share
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<FileText size={16} />}
                    onClick={handleGenerateBOQ}
                    loading={isGeneratingBOQ}
                  >
                    Generate BOQ
                  </Button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Start with budget + floor size</h3>
                <p>
                  Once valid values are entered, this panel will show stage-by-stage affordability and suggested next
                  spending targets.
                </p>
              </div>
            )}
          </div>
        </section>
        )}
      </div>

      <style jsx>{`
        .explorer-panel {
          position: relative;
          /* An auto margin in this flex column turns off stretching, so the
             width has to be set or the panel grows to fit its content. */
          width: 100%;
          min-width: 0;
          max-width: 920px;
          margin: 0 auto;
          padding: 0 0 48px;
        }
        .budget-checker-page {
          position: relative;
          max-width: 1260px;
          margin: 0 auto;
          padding: 20px 20px 84px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          isolation: isolate;
          /* The decorative .ambient blurs are absolutely positioned 30-40px
             outside this container, which pushed the document wider than the
             viewport between roughly 1150px and 1260px. Clip them here — no
             sticky descendants, so clipping is safe. */
          overflow-x: clip;
        }

        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(18px);
          opacity: 0.62;
          pointer-events: none;
          z-index: -1;
          animation: drift 9s ease-in-out infinite alternate;
        }

        .ambient-one {
          width: 280px;
          height: 280px;
          right: -30px;
          top: -35px;
          background: radial-gradient(circle, rgba(78, 154, 247, 0.38), rgba(78, 154, 247, 0));
        }

        .ambient-two {
          width: 260px;
          height: 260px;
          left: -40px;
          bottom: 12%;
          background: radial-gradient(circle, rgba(6, 20, 47, 0.22), rgba(6, 20, 47, 0));
          animation-delay: 0.9s;
        }

        .budget-modes {
          position: relative;
          z-index: 1;
          margin-bottom: 20px;
        }

        .budget-modes__grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        /* One row on a phone, swiped sideways, rather than three rows of tabs. */
        @media (max-width: 640px) {
          .budget-modes__grid {
            flex-wrap: nowrap;
            overflow-x: auto;
            scrollbar-width: none;
            margin: 0 -12px;
            padding: 2px 12px;
          }
          .budget-modes__grid::-webkit-scrollbar {
            display: none;
          }
          .budget-mode-card {
            flex: 0 0 auto;
          }
        }

        /* A row of tabs: the description is on hover (title) — five large
           cards pushed the estimator itself below the fold. */
        .budget-mode-card {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid var(--color-border, #e2e8f0);
          background: var(--color-surface, #fff);
          font: inherit;
          cursor: pointer;
          transition: border-color 0.18s ease, background 0.18s ease;
        }

        .budget-mode-card:hover {
          border-color: #94a3b8;
        }

        .budget-mode-card.is-active {
          border-color: var(--color-accent, #2E6CF6);
          background: #eff6ff;
        }

        .budget-mode-card :global(svg) {
          color: var(--color-accent, #2E6CF6);
        }

        .budget-mode-card strong {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--color-text);
        }

        .budget-mode-card:focus-visible {
          outline: 3px solid var(--color-accent, #2E6CF6);
          outline-offset: 2px;
        }

        .ring-col {
          display: grid;
          justify-items: center;
          gap: 8px;
        }

        .status-pill {
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 0.68rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 700;
          white-space: nowrap;
          color: #1e3a8a;
          background: #dbeafe;
        }

        .status-pill.tone-secure {
          color: #166534;
          background: #dcfce7;
        }

        .status-pill.tone-fragile {
          color: #991b1b;
          background: #fee2e2;
        }

        .result-stats article.short strong {
          color: #b91c1c;
        }

        .result-stats article.spare strong {
          color: #15803d;
        }

        .assumption {
          display: grid;
          gap: 6px;
          padding: 10px 0;
        }

        .assumption + .assumption {
          border-top: 1px solid #edf1f6;
        }

        .assumption-label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .assumption small {
          font-size: 0.74rem;
          color: var(--color-text-muted);
        }

        .labour-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .labour-pct {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          color: #334155;
        }

        .labour-pct input {
          width: 64px;
          min-height: 40px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 6px 8px;
          text-align: right;
          font: inherit;
          font-weight: 700;
          color: #0f172a;
        }

        .labour-pct input:focus {
          outline: none;
          border-color: #2e6cf6;
          box-shadow: 0 0 0 3px rgba(46, 108, 246, 0.15);
        }

        .labour-off {
          font-size: 0.85rem;
          color: var(--color-text-muted);
        }

        .link-button {
          justify-self: start;
          border: none;
          background: none;
          padding: 0;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 600;
          color: #1d4ed8;
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: pointer;
        }

        .segmented {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .segmented button {
          min-height: 40px;
          padding: 6px 14px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #fff;
          font: inherit;
          font-size: 0.84rem;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
        }

        .segmented button.on {
          border-color: #2e6cf6;
          background: #eff6ff;
          color: #1e3a8a;
          box-shadow: 0 0 0 1px #2e6cf6;
        }

        .segmented button:focus-visible,
        .link-button:focus-visible {
          outline: 2px solid #2e6cf6;
          outline-offset: 2px;
        }

        .workspace-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr);
          gap: 14px;
          align-items: start;
        }

        .control-panel,
        .results-panel {
          border-radius: 18px;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: rgba(255, 255, 255, 0.93);
          padding: 14px;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.07);
        }

        .control-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .panel-card {
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(248, 250, 252, 0.86);
          padding: 12px;
        }

        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .section-head h2 {
          margin: 0;
          font-size: 0.88rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 800;
          color: var(--color-primary);
        }

        .section-head span {
          font-size: 0.7rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          font-weight: 700;
        }

        .field + .field {
          margin-top: 10px;
        }

        .field label {
          display: block;
          margin-bottom: 6px;
          font-size: 0.72rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--color-text-muted);
        }

        .presets {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 10px 0 0;
        }

        .preset {
          border: 1px solid rgba(148, 163, 184, 0.4);
          border-radius: 999px;
          background: white;
          padding: 6px 10px;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--color-primary);
          cursor: pointer;
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .preset:hover {
          transform: translateY(-1px);
          border-color: rgba(46, 108, 246, 0.56);
          box-shadow: 0 6px 14px rgba(78, 154, 247, 0.2);
        }

        .preset.active {
          border-color: rgba(46, 108, 246, 0.66);
          background: rgba(219, 234, 254, 0.74);
        }

        .result-top {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 14px;
          align-items: center;
          margin-bottom: 12px;
        }

        .coverage-ring {
          width: 130px;
          height: 130px;
          border-radius: 50%;
          padding: 11px;
          box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2);
          animation: pulse 3.8s ease-in-out infinite;
        }

        .coverage-ring > div {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #f8fafc;
          border: 1px solid rgba(148, 163, 184, 0.22);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
        }

        .coverage-ring span {
          font-size: 0.67rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--color-text-muted);
          font-weight: 700;
        }

        .coverage-ring strong {
          font-size: 1.28rem;
          color: var(--color-primary);
        }

        .result-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .result-stats article {
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background: rgba(248, 250, 252, 0.94);
          padding: 10px;
        }

        .result-stats span {
          display: block;
          font-size: 0.66rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--color-text-muted);
          font-weight: 700;
          margin-bottom: 5px;
        }

        .result-stats strong {
          font-size: 0.93rem;
          color: var(--color-primary);
          line-height: 1.3;
        }

        .roof-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
          gap: 8px;
        }
        .roof-shapes {
          margin-bottom: 10px;
        }
        .roof-choice {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          min-height: 44px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 8px;
          background: #fff;
          color: #334155;
          font-size: 0.78rem;
          font-weight: 600;
          text-align: center;
          line-height: 1.25;
          cursor: pointer;
        }
        .roof-choice.selected {
          border-color: #2e6cf6;
          background: #eff6ff;
          color: #1e3a8a;
          box-shadow: 0 0 0 1px #2e6cf6;
        }
        .roof-choice :global(.roof-icon) {
          width: 48px;
          height: 24px;
        }
        .roof-sub {
          margin: 10px 0 6px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #64748b;
        }
        .roof-sub:first-of-type {
          margin-top: 0;
        }
        .labour-explain {
          margin-top: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 12px;
          background: #f8fafc;
          font-size: 0.78rem;
          line-height: 1.5;
          color: #475569;
        }
        .labour-explain summary {
          cursor: pointer;
          font-weight: 700;
          color: #1e3a8a;
        }
        .labour-explain p {
          margin: 6px 0;
        }
        .labour-explain table {
          width: 100%;
          border-collapse: collapse;
          margin: 6px 0;
        }
        .labour-explain th,
        .labour-explain td {
          padding: 3px 4px;
          text-align: right;
          border-bottom: 1px solid #e2e8f0;
          font-weight: 500;
        }
        .labour-explain th[scope='row'],
        .labour-explain thead th:first-child {
          text-align: left;
        }
        .labour-explain thead th {
          font-weight: 700;
          color: #334155;
        }
        .labour-note {
          margin: 6px 0 0;
          font-size: 0.75rem;
          line-height: 1.4;
          color: #64748b;
        }
        .labour-switch {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          padding: 0;
          border: none;
          background: none;
          cursor: pointer;
        }

        .labour-switch:focus-visible {
          outline: 2px solid #2e6cf6;
          outline-offset: 2px;
          border-radius: 999px;
        }

        .labour-switch .knob {
          position: relative;
          flex-shrink: 0;
          width: 38px;
          height: 22px;
          border-radius: 999px;
          background: #cbd5e1;
          transition: background 0.2s;
        }
        .labour-switch .knob::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s;
        }
        .labour-switch.on .knob {
          background: #2e6cf6;
        }
        .labour-switch.on .knob::after {
          transform: translateX(16px);
        }
        .budget-split {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 12px;
        }
        .budget-split h3 {
          margin: 0 0 12px;
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
        }
        .council-note {
          margin: 12px 0 0;
          font-size: 0.8rem;
          line-height: 1.5;
          color: #475569;
        }
        .guidance {
          border-radius: 12px;
          padding: 11px 14px;
          font-size: 0.86rem;
          line-height: 1.5;
          color: #1e3a8a;
          background: #eff6ff;
          margin-bottom: 12px;
        }

        .guidance :global(strong) {
          font-weight: 800;
        }

        .note {
          margin: 10px 0 0;
          font-size: 0.74rem;
          color: var(--color-text-muted);
          line-height: 1.5;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 11px;
          padding-top: 10px;
          border-top: 1px solid rgba(148, 163, 184, 0.22);
        }

        .empty {
          min-height: 280px;
          border-radius: 14px;
          border: 1px dashed rgba(148, 163, 184, 0.36);
          background: linear-gradient(140deg, rgba(248, 250, 252, 0.93), rgba(239, 246, 255, 0.9));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 8px;
          padding: 24px;
        }

        .empty h3 {
          margin: 0;
          font-size: 1.06rem;
          color: var(--color-primary);
        }

        .empty p {
          margin: 0;
          font-size: 0.86rem;
          line-height: 1.6;
          color: var(--color-text-secondary);
          max-width: 430px;
        }

        .loading-card {
          min-height: 280px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: rgba(248, 250, 252, 0.94);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          text-align: center;
          padding: 18px;
        }

        .loading-card p {
          margin: 0;
          font-size: 0.9rem;
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .loader {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 3px solid rgba(148, 163, 184, 0.34);
          border-top-color: #2e6cf6;
          animation: spin 0.82s linear infinite;
        }

        .loading-lines {
          width: min(360px, 100%);
          display: grid;
          gap: 8px;
        }

        .loading-lines span {
          display: block;
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(226, 232, 240, 0.95), rgba(241, 245, 249, 0.95), rgba(226, 232, 240, 0.95));
          background-size: 220% 100%;
          animation: shimmer 1.15s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -30% 0;
          }
        }

        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.015);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes drift {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(8px, -8px, 0);
          }
        }

        @media (max-width: 1120px) {
          .workspace-grid {
            grid-template-columns: 1fr;
          }

          .result-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 840px) {
          .result-top {
            grid-template-columns: 1fr;
            justify-items: center;
          }

          .result-stats {
            width: 100%;
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .budget-checker-page {
            padding: 14px 12px 74px;
          }

          .control-panel,
          .results-panel {
            padding: 11px;
          }

          .actions :global(.btn) {
            width: 100%;
          }
        }
      `}</style>
    </MainLayout>
  );
}
