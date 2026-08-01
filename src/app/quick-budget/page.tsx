'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { estimateStageReach } from '@/lib/estimators/stageBudgetEstimator';
import { generateBOQFromBasics, ManualBuilderConfig } from '@/lib/calculations';
import { exportBOQToPDF } from '@/lib/pdf-export';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { createProject, saveProjectWithItems } from '@/lib/services/projects';
import { setCreatedProjectSnapshot, setOptimisticProjectCard } from '@/lib/projectCreationCache';
import SolarBudgetExplorer from '@/components/quick-projects/SolarBudgetExplorer';
import BoreholeBudgetExplorer from '@/components/quick-projects/BoreholeBudgetExplorer';
import {
  House,
  SunHorizon,
  Drop,
  ShareNetwork,
  FloppyDisk,
  FilePdf,
  CheckCircle,
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
    config: { wallHeightM: 3.0, cementType: 'cement_425' as const },
  },
  {
    id: 'economy',
    label: 'Economy Build',
    hint: 'Leaner assumptions to stretch early budget.',
    config: { wallHeightM: 2.7, cementType: 'cement_325' as const },
  },
] as const;

const stageCategoryLabels: Record<string, string> = {
  substructure: 'Site Preparation & Foundation',
  superstructure: 'Structural Walls & Frame',
  roofing: 'Roofing',
  finishing: 'Interior & Finishing',
  exterior: 'External Work',
};

export default function QuickBudgetPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { success: showSuccess, error: showError, info: showInfo } = useToast();
  const [budgetInput, setBudgetInput] = useState('15000');
  const [floorAreaInput, setFloorAreaInput] = useState('120');
  const [locationType, setLocationType] = useState<(typeof locationOptions)[number]['id']>('urban');
  const [buildProfile, setBuildProfile] = useState<(typeof profileOptions)[number]['id']>('standard');
  const [stageEstimate, setStageEstimate] = useState<ReturnType<typeof estimateStageReach> | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isGeneratingBOD, setIsGeneratingBOD] = useState(false);
  // Which budget the user is checking. The house estimator was the only one
  // reachable from here, while the solar and borehole explorers were buried
  // inside their quick-project wizards.
  const [budgetMode, setBudgetMode] = useState<'house' | 'solar' | 'borehole'>('house');

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

    const profile = params.get('profile');
    if (profileOptions.some((option) => option.id === profile)) {
      setBuildProfile(profile as (typeof profileOptions)[number]['id']);
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
      includeLabor: false,
      locationType,
    };
  }, [estimatorErrors.area, estimatorErrors.budget, locationType, parsedArea, selectedProfile.config.cementType, selectedProfile.config.wallHeightM]);

  const detailedItems = useMemo(() => {
    if (!manualBuilderConfig) return [];
    return generateBOQFromBasics(manualBuilderConfig);
  }, [manualBuilderConfig]);

  const totals = useMemo(() => {
    return detailedItems.reduce(
      (acc, item) => {
        acc.usd += item.totalUsd || 0;
        acc.zwg += item.totalZwg || 0;
        return acc;
      },
      { usd: 0, zwg: 0 }
    );
  }, [detailedItems]);

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
    parsedArea,
    parsedBudget,
    selectedProfile.config.cementType,
    selectedProfile.config.wallHeightM,
  ]);

  const nextLockedStage = useMemo(() => {
    if (!stageEstimate) return null;
    return stageEstimate.rows.find((stage) => !stage.affordable) ?? null;
  }, [stageEstimate]);

  const locationLabel = useMemo(() => {
    return locationOptions.find((option) => option.id === locationType)?.label ?? 'Urban';
  }, [locationType]);

  const overallPercent = stageEstimate ? Math.round(stageEstimate.coveragePercent) : 0;
  const affordableStageCount = stageEstimate?.rows.filter((stage) => stage.affordable).length ?? 0;

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
        profile: buildProfile,
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
        labor_preference: 'materials_only',
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

      const itemsPayload = detailedItems.map((item, index) => ({
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
          selected_stages: stageEstimate.rows.filter((row) => row.affordable).map((row) => row.id),
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
      router.push(`/projects/${savedProject.id}`);
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

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Quick Budget Estimate',
          text: shareText,
          url: window.location.href,
        });
        showSuccess('Estimate shared.');
        return;
      }

      await navigator.clipboard.writeText(`${shareText}\n\n${window.location.href}`);
      showSuccess('Estimate summary copied to clipboard.');
    } catch {
      showError('Sharing was cancelled or unavailable.');
    }
  };

  const handleGenerateDetailedBOD = () => {
    if (!manualBuilderConfig || detailedItems.length === 0) {
      showError('Complete valid inputs first to generate a detailed BOD.');
      return;
    }

    setIsGeneratingBOD(true);
    try {
      exportBOQToPDF(
        {
          projectName: `Detailed BOD - ${parsedArea}m2`,
          location: locationLabel,
          totalArea: parsedArea,
          items: detailedItems.map((item) => ({
            material_name: item.materialName,
            category: stageCategoryLabels[item.category] || item.category,
            quantity: item.quantity,
            unit: item.unit,
            unit_price_usd: item.unitPriceUsd,
            unit_price_zwg: item.unitPriceZwg,
          })),
          totals: {
            usd: totals.usd,
            zwg: totals.zwg,
          },
          config: {
            scope: 'entire_house',
            brickType: 'common',
            cementType: selectedProfile.config.cementType,
            includeLabor: false,
          },
        },
        'USD'
      );
      showSuccess('Detailed BOD generated.');
    } catch (error) {
      console.error(error);
      showError('Failed to generate detailed BOD.');
    } finally {
      setIsGeneratingBOD(false);
    }
  };

  // Solar and borehole have their own budget explorers, previously reachable
  // only from inside their quick-project wizards. Rendering them here keeps one
  // page answering "how far does my money go" whatever is being built.
  if (budgetMode !== 'house') {
    return (
      <MainLayout title="Budget Estimator">
        <div className="mx-auto max-w-4xl px-4 py-8">
          {budgetMode === 'solar' ? (
            <SolarBudgetExplorer onBack={() => setBudgetMode('house')} backLabel="Back to budget options" />
          ) : (
            <BoreholeBudgetExplorer onBack={() => setBudgetMode('house')} backLabel="Back to budget options" />
          )}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout fullWidth title="Budget Estimator">
      <div className="budget-checker-page">
        <div className="ambient ambient-one" aria-hidden />
        <div className="ambient ambient-two" aria-hidden />

        {/* What kind of budget? The house estimator used to be the whole page,
            with no sign that solar and borehole budgets existed at all. */}
        <div className="budget-modes">
          <p className="budget-modes__label">What are you budgeting for?</p>
          <div className="budget-modes__grid">
            {([
              { id: 'house', icon: House, title: 'House build', hint: 'How far your budget carries a full build, stage by stage.' },
              { id: 'solar', icon: SunHorizon, title: 'Solar system', hint: 'What panel, battery and inverter setup your budget buys.' },
              { id: 'borehole', icon: Drop, title: 'Borehole', hint: 'Drilling, casing and pump against what you have to spend.' },
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
                >
                  <Icon size={22} weight="duotone" />
                  <strong>{mode.title}</strong>
                  <span>{mode.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <header className={`studio-hero tone-${coverageTone}`}>
          <div className="hero-head">
            <span className="eyebrow">Budget Feasibility Studio</span>
            <span className="status-pill">{coverageLabel}</span>
          </div>

          <h1>Pressure-test your build budget before procurement starts.</h1>
          <p>
            Set budget, floor size, and context to see how far your money can realistically carry the project before
            BOQ execution.
          </p>

          <div className="hero-snapshot">
            <div className="snapshot-card">
              <span>Available Budget</span>
              <strong>{estimatorErrors.budget ? '--' : formatUsd(parsedBudget)}</strong>
            </div>
            <div className="snapshot-card">
              <span>Estimated Coverage</span>
              <strong>{overallPercent}%</strong>
            </div>
            <div className="snapshot-card">
              <span>Reachable Stage</span>
              <strong>{stageEstimate?.reachableStageLabel ?? 'Awaiting calculation'}</strong>
            </div>
            <div className="snapshot-card">
              <span>Floor Plan Size</span>
              <strong>{estimatorErrors.area ? '--' : `${parsedArea} m2`}</strong>
            </div>
          </div>
        </header>

        <section className="workspace-grid">
          <div className="control-panel">
            <div className="panel-card">
              <div className="section-head">
                <h2>Inputs</h2>
                <span>Auto-updates</span>
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
                  error={estimatorErrors.budget || undefined}
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
                <h2>Location Context</h2>
                <span>{locationLabel}</span>
              </div>
              <div className="choice-grid">
                {locationOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = locationType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      className={`choice ${selected ? 'selected' : ''}`}
                      onClick={() => setLocationType(option.id)}
                    >
                      <div className="choice-top">
                        <Icon size={17} weight={selected ? 'fill' : 'duotone'} />
                        <strong>{option.label}</strong>
                      </div>
                      <span>{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="panel-card">
              <div className="section-head">
                <h2>Estimator Profile</h2>
                <span>{selectedProfile.label}</span>
              </div>
              <div className="choice-grid profile-grid">
                {profileOptions.map((option) => {
                  const selected = buildProfile === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      className={`choice ${selected ? 'selected' : ''}`}
                      onClick={() => setBuildProfile(option.id)}
                    >
                      <div className="choice-top">
                        <CheckCircle size={17} weight={selected ? 'fill' : 'duotone'} />
                        <strong>{option.label}</strong>
                      </div>
                      <span>{option.hint}</span>
                    </button>
                  );
                })}
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

                  <div className="result-stats">
                    <article>
                      <span>Estimated Full Build</span>
                      <strong>{formatUsd(stageEstimate.estimatedTotalUsd)}</strong>
                    </article>
                    <article>
                      <span>Affordable Stages</span>
                      <strong>{affordableStageCount} / {stageEstimate.rows.length}</strong>
                    </article>
                    <article>
                      <span>Detailed BOQ Total</span>
                      <strong>{formatUsd(totals.usd)}</strong>
                    </article>
                  </div>
                </div>

                <div className="guidance">
                  {nextLockedStage
                    ? `Next stage gap: ${nextLockedStage.label} is estimated around ${formatUsd(nextLockedStage.stageCostUsd)}.`
                    : 'Current budget can absorb all stage bands in this quick estimate.'}
                </div>

                <div className="stage-list">
                  {stageEstimate.rows.map((stage) => (
                    <article key={stage.id} className={`stage ${stage.affordable ? 'done' : ''}`}>
                      <div className="stage-head">
                        <div className="stage-copy">
                          <span>{stage.label}</span>
                          <p>{stageCategoryLabels[stage.id] ?? 'Construction stage checkpoint'}</p>
                        </div>
                        <div className="stage-metrics">
                          <strong>{formatUsd(stage.stageCostUsd)}</strong>
                          <small>{Math.round(stage.coveragePercent)}% covered</small>
                        </div>
                      </div>
                      <div className="stage-track">
                        <span style={{ width: `${Math.min(100, stage.coveragePercent)}%` }} />
                      </div>
                    </article>
                  ))}
                </div>

                <p className="note">
                  Indicative estimate only. Final totals vary based on design complexity, specification shifts, and
                  supplier negotiations.
                </p>

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
                    icon={<FilePdf size={16} />}
                    onClick={handleGenerateDetailedBOD}
                    loading={isGeneratingBOD}
                  >
                    Generate Detailed BOD
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
      </div>

      <style jsx>{`
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

        .budget-modes__label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-secondary);
          margin-bottom: 10px;
        }

        .budget-modes__grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .budget-mode-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid var(--color-border, #e2e8f0);
          background: var(--color-surface, #fff);
          text-align: left;
          font: inherit;
          cursor: pointer;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .budget-mode-card:hover {
          border-color: #94a3b8;
        }

        .budget-mode-card.is-active {
          border-color: var(--color-accent, #2E6CF6);
          box-shadow: 0 0 0 1px var(--color-accent, #2E6CF6);
        }

        .budget-mode-card :global(svg) {
          color: var(--color-accent, #2E6CF6);
        }

        .budget-mode-card strong {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-text);
        }

        .budget-mode-card span {
          font-size: 0.75rem;
          line-height: 1.45;
          color: var(--color-text-secondary);
        }

        .budget-mode-card:focus-visible {
          outline: 3px solid var(--color-accent, #2E6CF6);
          outline-offset: 2px;
        }

        /* One per row on a phone: three cards side by side leaves each too
           narrow for its description to be readable. */
        @media (max-width: 720px) {
          .budget-modes__grid {
            grid-template-columns: 1fr;
          }
          .budget-mode-card {
            flex-direction: row;
            align-items: center;
            flex-wrap: wrap;
            padding: 14px;
          }
          .budget-mode-card strong {
            flex: 1 1 auto;
          }
          .budget-mode-card span {
            flex: 1 0 100%;
          }
        }

        .studio-hero {
          border-radius: 26px;
          border: 1px solid rgba(148, 163, 184, 0.34);
          background:
            linear-gradient(120deg, rgba(6, 20, 47, 0.98), rgba(16, 36, 78, 0.92)),
            radial-gradient(circle at 100% 0%, rgba(78, 154, 247, 0.4), rgba(78, 154, 247, 0));
          color: #f8fbff;
          padding: 24px;
          box-shadow: 0 22px 40px rgba(3, 10, 24, 0.27);
          overflow: hidden;
        }

        .tone-secure {
          box-shadow: 0 20px 44px rgba(11, 90, 44, 0.26);
        }

        .tone-balanced {
          box-shadow: 0 20px 44px rgba(30, 64, 175, 0.24);
        }

        .tone-fragile {
          box-shadow: 0 20px 44px rgba(153, 27, 27, 0.26);
        }

        .hero-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .eyebrow {
          font-size: 0.71rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 700;
          color: rgba(191, 219, 254, 0.95);
        }

        .status-pill {
          border: 1px solid rgba(148, 163, 184, 0.45);
          background: rgba(15, 23, 42, 0.44);
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 700;
        }

        .studio-hero h1 {
          margin: 10px 0 8px;
          font-size: clamp(1.64rem, 3vw, 2.36rem);
          line-height: 1.12;
          letter-spacing: -0.02em;
          max-width: 760px;
        }

        .studio-hero p {
          margin: 0;
          color: rgba(226, 232, 240, 0.92);
          line-height: 1.62;
          max-width: 760px;
        }

        .hero-snapshot {
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .snapshot-card {
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(15, 23, 42, 0.36);
          padding: 10px 12px;
        }

        .snapshot-card span {
          display: block;
          font-size: 0.68rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: rgba(203, 213, 225, 0.94);
          margin-bottom: 6px;
          font-weight: 700;
        }

        .snapshot-card strong {
          font-size: 0.96rem;
          line-height: 1.28;
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

        .choice-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .profile-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .choice {
          border: 1px solid rgba(148, 163, 184, 0.34);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.92);
          padding: 9px;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 4px;
          cursor: pointer;
          transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
        }

        .choice:hover {
          border-color: rgba(46, 108, 246, 0.58);
          transform: translateY(-1px);
        }

        .choice.selected {
          border-color: rgba(46, 108, 246, 0.74);
          background: rgba(219, 234, 254, 0.75);
          box-shadow: 0 8px 16px rgba(78, 154, 247, 0.2);
        }

        .choice-top {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--color-primary);
        }

        .choice-top strong {
          font-size: 0.79rem;
        }

        .choice span {
          font-size: 0.72rem;
          color: var(--color-text-muted);
          line-height: 1.4;
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

        .guidance {
          border: 1px solid rgba(59, 130, 246, 0.28);
          background: rgba(239, 246, 255, 0.9);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 0.8rem;
          line-height: 1.45;
          color: #1e3a8a;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .stage-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stage {
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background: rgba(255, 255, 255, 0.92);
          padding: 10px;
          animation: stageEnter 420ms ease both;
        }

        .stage:nth-child(2) {
          animation-delay: 60ms;
        }

        .stage:nth-child(3) {
          animation-delay: 120ms;
        }

        .stage:nth-child(4) {
          animation-delay: 180ms;
        }

        .stage:nth-child(5) {
          animation-delay: 240ms;
        }

        .stage.done {
          border-color: rgba(22, 163, 74, 0.38);
          background: rgba(240, 253, 244, 0.92);
        }

        .stage-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 7px;
        }

        .stage-copy span {
          display: block;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--color-primary);
          margin-bottom: 2px;
        }

        .stage-copy p {
          margin: 0;
          font-size: 0.72rem;
          color: var(--color-text-muted);
          line-height: 1.35;
        }

        .stage-metrics {
          text-align: right;
        }

        .stage-metrics strong {
          display: block;
          font-size: 0.81rem;
          color: var(--color-primary);
          line-height: 1.25;
        }

        .stage-metrics small {
          font-size: 0.7rem;
          color: var(--color-text-muted);
          font-weight: 600;
        }

        .stage-track {
          width: 100%;
          height: 7px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.28);
          overflow: hidden;
        }

        .stage-track span {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--color-accent), var(--color-accent-dark));
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

        @keyframes stageEnter {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 1120px) {
          .hero-snapshot {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .workspace-grid {
            grid-template-columns: 1fr;
          }

          .result-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 840px) {
          .choice-grid,
          .profile-grid {
            grid-template-columns: 1fr;
          }

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

          .studio-hero {
            padding: 18px;
          }

          .hero-head {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero-snapshot {
            grid-template-columns: 1fr;
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
