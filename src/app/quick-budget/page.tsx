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
import {
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
      brickType: 'common',
      cementType: selectedProfile.config.cementType,
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
        cementType: selectedProfile.config.cementType,
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

  const handleSaveProject = async () => {
    if (!manualBuilderConfig || !stageEstimate) {
      showError('Complete valid inputs first to save this estimate.');
      return;
    }

    if (!isAuthenticated) {
      showInfo('Please sign in to save this project.');
      router.push('/auth/login?redirect=/quick-budget');
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

  return (
    <MainLayout fullWidth title="Quick Budget Checker">
      <div className="quick-budget-page">
        <header className="quick-budget-header">
          <span className="kicker">QUICK ESTIMATOR</span>
          <h1>Check what your budget can complete before starting BOQ.</h1>
          <p>
            Use this screen for fast planning. Set your budget, floor size, and location context to see the likely
            stage reach.
          </p>
          <div className="overall-band">
            <div>
              <span className="overall-label">Overall Coverage</span>
              <strong className="overall-value">{overallPercent}%</strong>
            </div>
            <div className="overall-track">
              <span style={{ width: `${Math.max(0, Math.min(100, overallPercent))}%` }} />
            </div>
          </div>
        </header>

        <section className="quick-budget-shell">
          <div className="quick-budget-form">
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

            <div className="presets">
              {['10000', '15000', '25000', '40000'].map((value) => (
                <button key={value} type="button" className="preset" onClick={() => setBudgetInput(value)}>
                  ${Number(value).toLocaleString()}
                </button>
              ))}
            </div>

            <div className="field">
              <label>Location Context</label>
              <div className="choice-grid">
                {locationOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = locationType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`choice ${selected ? 'selected' : ''}`}
                      onClick={() => setLocationType(option.id)}
                    >
                      <div className="choice-top">
                        <Icon size={16} weight={selected ? 'fill' : 'duotone'} />
                        <strong>{option.label}</strong>
                      </div>
                      <span>{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field">
              <label>Estimator Profile</label>
              <div className="choice-grid choice-grid-two">
                {profileOptions.map((option) => {
                  const selected = buildProfile === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`choice ${selected ? 'selected' : ''}`}
                      onClick={() => setBuildProfile(option.id)}
                    >
                      <div className="choice-top">
                        <CheckCircle size={16} weight={selected ? 'fill' : 'duotone'} />
                        <strong>{option.label}</strong>
                      </div>
                      <span>{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          <div className="quick-budget-results">
            {isCalculating ? (
              <div className="loading-card">
                <div className="loader" />
                <p>Pulling current stage amounts...</p>
                <div className="loading-lines">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : stageEstimate ? (
              <>
                <div className="summary">
                  <div className="summary-item">
                    <span>Estimated Full Build</span>
                    <strong>${Math.round(stageEstimate.estimatedTotalUsd).toLocaleString()}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Budget Coverage</span>
                    <strong>{stageEstimate.coveragePercent.toFixed(0)}%</strong>
                  </div>
                  <div className="summary-item">
                    <span>Likely Reach</span>
                    <strong>{stageEstimate.reachableStageLabel}</strong>
                  </div>
                </div>

                <div className="guidance">
                  {nextLockedStage
                    ? `Next stage target: ${nextLockedStage.label} needs about $${Math.round(nextLockedStage.stageCostUsd).toLocaleString()}.`
                    : 'Budget is sufficient for all major stages in this quick estimate.'}
                </div>

                <div className="stage-list">
                  {stageEstimate.rows.map((stage) => (
                    <div key={stage.id} className={`stage ${stage.affordable ? 'done' : ''}`}>
                      <div className="stage-head">
                        <span>{stage.label}</span>
                        <strong>${Math.round(stage.stageCostUsd).toLocaleString()}</strong>
                      </div>
                      <div className="stage-track">
                        <span style={{ width: `${Math.min(100, stage.coveragePercent)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <p className="note">
                  Indicative estimate only. Final totals vary by design complexity, finishes, and supplier rates.
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
                  <Button
                    variant="secondary"
                    icon={<ShareNetwork size={16} />}
                    onClick={handleShare}
                  >
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
              <div className="empty">Enter budget and floor size to preview stage completion.</div>
            )}
          </div>
        </section>
      </div>

      <style jsx>{`
        .quick-budget-page {
          max-width: 1180px;
          margin: 0 auto;
          padding: 26px 20px 84px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .quick-budget-header {
          border-radius: 22px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          background:
            radial-gradient(circle at 95% -10%, rgba(78, 154, 247, 0.2), rgba(78, 154, 247, 0)),
            linear-gradient(155deg, #ffffff, #f3f9ff);
          padding: 24px;
          box-shadow: 0 14px 24px rgba(15, 23, 42, 0.08);
        }

        .kicker {
          font-size: 0.7rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-accent-dark);
          font-weight: 700;
        }

        .quick-budget-header h1 {
          margin: 10px 0 8px;
          color: var(--color-primary);
          font-size: clamp(1.55rem, 3vw, 2.2rem);
          line-height: 1.15;
        }

        .quick-budget-header p {
          margin: 0;
          color: var(--color-text-secondary);
          line-height: 1.6;
          max-width: 760px;
        }

        .overall-band {
          margin-top: 16px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(78, 154, 247, 0.26);
          background: rgba(239, 246, 255, 0.85);
          display: grid;
          gap: 8px;
        }

        .overall-label {
          display: block;
          font-size: 0.7rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #1e40af;
          font-weight: 700;
        }

        .overall-value {
          font-size: 1.35rem;
          color: #1e3a8a;
        }

        .overall-track {
          height: 10px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.28);
          overflow: hidden;
        }

        .overall-track span {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #4e9af7, #2e6cf6);
        }

        .quick-budget-shell {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
          gap: 16px;
        }

        .quick-budget-form,
        .quick-budget-results {
          border-radius: 16px;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.26);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 10px 18px rgba(15, 23, 42, 0.05);
        }

        .quick-budget-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .field label {
          display: block;
          margin-bottom: 6px;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--color-text-muted);
        }

        .presets {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .preset {
          border: 1px solid rgba(148, 163, 184, 0.4);
          border-radius: 999px;
          background: white;
          padding: 6px 10px;
          font-size: 0.74rem;
          font-weight: 700;
          color: var(--color-primary);
          cursor: pointer;
          transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
        }

        .preset:hover {
          transform: translateY(-1px);
          border-color: rgba(78, 154, 247, 0.6);
          background: rgba(239, 246, 255, 0.95);
        }

        .choice-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .choice-grid-two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .choice {
          border: 1px solid rgba(148, 163, 184, 0.32);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.95);
          padding: 9px;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 4px;
          cursor: pointer;
          transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
        }

        .choice:hover {
          border-color: rgba(78, 154, 247, 0.55);
          background: rgba(239, 246, 255, 0.95);
          transform: translateY(-1px);
        }

        .choice.selected {
          border-color: rgba(46, 108, 246, 0.64);
          background: rgba(219, 234, 254, 0.78);
          box-shadow: 0 8px 16px rgba(78, 154, 247, 0.18);
        }

        .choice-top {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--color-primary);
        }

        .choice-top strong {
          font-size: 0.78rem;
        }

        .choice span {
          font-size: 0.72rem;
          color: var(--color-text-muted);
          line-height: 1.35;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding-top: 10px;
          margin-top: 8px;
          border-top: 1px solid rgba(148, 163, 184, 0.22);
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }

        .summary-item {
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.26);
          padding: 9px 10px;
          background: rgba(246, 250, 255, 0.9);
        }

        .summary-item span {
          display: block;
          font-size: 0.67rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--color-text-muted);
          margin-bottom: 4px;
        }

        .summary-item strong {
          font-size: 0.95rem;
          color: var(--color-primary);
          line-height: 1.25;
        }

        .guidance {
          margin: 0 0 10px;
          border: 1px solid rgba(59, 130, 246, 0.22);
          background: rgba(239, 246, 255, 0.9);
          border-radius: 12px;
          padding: 9px 10px;
          font-size: 0.78rem;
          color: #1e3a8a;
          font-weight: 600;
        }

        .stage-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stage {
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          padding: 10px;
          background: rgba(255, 255, 255, 0.9);
        }

        .stage.done {
          border-color: rgba(22, 163, 74, 0.35);
          background: rgba(240, 253, 244, 0.9);
        }

        .stage-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 7px;
        }

        .stage-head span {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .stage-head strong {
          font-size: 0.8rem;
          color: var(--color-text-secondary);
          font-weight: 700;
        }

        .stage-track {
          width: 100%;
          height: 7px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.26);
          overflow: hidden;
        }

        .stage-track span {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #4e9af7, #2e6cf6);
        }

        .note {
          margin: 10px 0 0;
          font-size: 0.74rem;
          color: var(--color-text-muted);
        }

        .empty {
          min-height: 180px;
          border-radius: 14px;
          border: 1px dashed rgba(148, 163, 184, 0.38);
          background: rgba(248, 250, 252, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 0.86rem;
          color: var(--color-text-secondary);
          padding: 20px;
        }

        .loading-card {
          min-height: 260px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: rgba(248, 250, 252, 0.92);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 18px;
          text-align: center;
        }

        .loading-card p {
          margin: 0;
          font-size: 0.9rem;
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .loader {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 3px solid rgba(148, 163, 184, 0.34);
          border-top-color: #2e6cf6;
          animation: spin 0.8s linear infinite;
        }

        .loading-lines {
          width: min(380px, 100%);
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

        @media (max-width: 1080px) {
          .quick-budget-shell {
            grid-template-columns: 1fr;
          }

          .choice-grid {
            grid-template-columns: 1fr;
          }

          .choice-grid-two {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .summary {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .quick-budget-page {
            padding: 16px 12px 72px;
          }

          .quick-budget-header {
            padding: 16px;
          }

          .quick-budget-form,
          .quick-budget-results {
            padding: 12px;
          }
        }
      `}</style>
    </MainLayout>
  );
}
