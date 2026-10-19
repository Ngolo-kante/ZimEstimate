'use client';

import { useMemo } from 'react';
import CostDonut, { COST_COLORS } from '@/components/ui/CostDonut';
import { COUNCIL_TARIFF, getCostBreakdown, isTariffPriced, PROJECT_FEES, REQUIRED_FEE_IDS, type ResidentialDensity } from '@/lib/projectFees';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const dollars = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

const DENSITIES: { id: ResidentialDensity; label: string; example: string }[] = [
  { id: 'low', label: 'Low density', example: 'e.g. Borrowdale, Greendale, Hatfield' },
  { id: 'high', label: 'High density', example: 'e.g. Budiriro, Kuwadzana, Glen View' },
];

export default function CostOverview() {
  const milestones = useBoqWizardStore((state) => state.milestonesState);
  const scope = useBoqWizardStore((state) => state.projectScope);
  const selectedStages = useBoqWizardStore((state) => state.selectedStages);
  const laborType = useBoqWizardStore((state) => state.laborType);
  const density = useBoqWizardStore((state) => state.projectDetails.residentialDensity) || 'low';
  const locationType = useBoqWizardStore((state) => state.projectDetails.locationType);
  const updateProjectDetails = useBoqWizardStore((state) => state.updateProjectDetails);
  const updateItem = useBoqWizardStore((state) => state.updateMilestoneItem);

  const visible = useMemo(() => milestones.filter((milestone) =>
    milestone.id === 'project_fees' ||
    // Legacy / hand-added labour section is only shown when populated.
    (milestone.id === 'labor' ? milestone.items.length > 0 && laborType === 'materials_labor' : scope === 'entire' || selectedStages.includes(milestone.id))
  ), [milestones, scope, selectedStages, laborType]);
  const costs = useMemo(() => getCostBreakdown(visible), [visible]);
  const feeItems = milestones.find((milestone) => milestone.id === 'project_fees')?.items || [];
  const missingCore = PROJECT_FEES.filter((fee) => REQUIRED_FEE_IDS.has(fee.id) &&
    !(feeItems.find((item) => item.materialId === `project-fee-${fee.id}`)?.actualPriceUsd));

  return (
    <div className="space-y-4">
      <section aria-labelledby="cost-composition-title" className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-6">
        <div className="mb-5">
          <h3 id="cost-composition-title" className="text-lg font-bold text-[var(--color-text)]">Where your estimate goes</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">The split updates as you price the BOQ. Materials also includes any custom construction or site-work lines.</p>
        </div>
        <CostDonut
          format={dollars}
          slices={[
            { label: 'Materials & works', value: costs.materials, color: COST_COLORS.materials },
            { label: 'Labour', value: costs.labor, color: COST_COLORS.labor },
            { label: 'Professional & council fees', value: costs.fees, color: COST_COLORS.fees },
          ]}
        />
      </section>

      <section aria-labelledby="project-fees-title" className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-6">
        <h3 id="project-fees-title" className="text-lg font-bold text-[var(--color-text)]">Professional & council fees</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
          Council lines are worked out from the{' '}
          <a href={COUNCIL_TARIFF.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--color-accent)] underline underline-offset-2">{COUNCIL_TARIFF.name}</a>{' '}
          using your floor area. Other councils set their own fees, so replace any line with the figure you are quoted.
        </p>

        <fieldset className="mt-4">
          <legend className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Your stand is in a</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DENSITIES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={density === option.id}
                onClick={() => updateProjectDetails({ residentialDensity: option.id })}
                className={`rounded-xl border p-3 text-left transition ${density === option.id ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg,#EFF6FF)] ring-1 ring-[var(--color-accent)]' : 'border-[var(--color-border-light)] hover:border-[var(--color-accent)]'}`}
              >
                <span className="block text-sm font-semibold text-[var(--color-text)]">{option.label} area</span>
                <span className="block text-xs text-[var(--color-text-secondary)]">{option.example}</span>
              </button>
            ))}
          </div>
          {locationType === 'rural' && (
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">Rural district councils charge their own fees. Treat these as a guide and ask your council.</p>
          )}
        </fieldset>

        {scope === 'entire' && missingCore.length > 0 && (
          <p role="status" className="mt-4 rounded-xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3 py-2 text-sm text-[var(--color-warning-fg)]">
            {missingCore.length === 1 && missingCore[0].id === 'architectural-drawings'
              ? 'Add your drawing quote. Your total is understated until you do.'
              : `${missingCore.length} common fee lines are still unpriced. Your total is understated until you add them.`}
          </p>
        )}

        <div className="mt-5 space-y-5">
          {['Design and professional services', 'Council approvals and inspections', 'Site-dependent services'].map((group) => (
            <div key={group}>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">{group}</h4>
              <div className="grid gap-2">
                {PROJECT_FEES.filter((fee) => fee.group === group).map((fee) => {
                  const item = feeItems.find((candidate) => candidate.materialId === `project-fee-${fee.id}`);
                  const quantity = item?.quantity || 1;
                  const perUnit = quantity > 1;
                  return (
                    <div key={fee.id} className="flex flex-col gap-2 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <label htmlFor={`fee-${fee.id}`} className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--color-text)]">{fee.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-secondary)]">
                          {item?.description || fee.guidance}
                          {item && isTariffPriced(item) && perUnit && <> · {quantity} {item.unit}s = <strong>{dollars(quantity * item.actualPriceUsd)}</strong></>}
                        </span>
                      </label>
                      <span className="flex shrink-0 items-center gap-1 self-end rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 focus-within:border-[var(--color-accent)] sm:self-auto">
                        <span className="text-sm text-[var(--color-text-secondary)]">$</span>
                        <input
                          id={`fee-${fee.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          aria-label={`${fee.label} cost in USD${perUnit ? ` per ${item?.unit}` : ''}`}
                          value={item?.actualPriceUsd ?? 0}
                          disabled={!item}
                          onChange={(event) => {
                            if (!item) return;
                            const amount = Math.max(0, Number(event.target.value) || 0);
                            updateItem('project_fees', item.id, { actualPriceUsd: amount, actualPriceZwg: amount * 30 });
                          }}
                          className="w-24 bg-transparent py-2 text-right text-sm font-semibold text-[var(--color-text)] outline-none disabled:opacity-50"
                        />
                        {perUnit && <span className="text-xs text-[var(--color-text-secondary)]">/{item?.unit}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--color-text-secondary)]">Council figures are before any VAT. Building without approved plans or skipping an inspection stage carries council penalties. Add any other professional or authority charge as a custom line under this category below.</p>
      </section>
    </div>
  );
}
