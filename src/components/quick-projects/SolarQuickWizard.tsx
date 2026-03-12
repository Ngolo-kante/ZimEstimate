'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import {
  Lightning,
  CheckCircle,
  Warning,
  HouseSimple,
  MapPin,
  SunDim,
} from '@phosphor-icons/react';
import {
  buildDefaultSelections,
  computeSolarSizing,
  estimateHardwareCost,
} from '@/lib/quick-projects/solar/calculations';
import {
  SOLAR_APPLIANCES,
  SOLAR_INTENT_LABELS,
  SOLAR_PANEL_WATT,
} from '@/lib/quick-projects/solar/catalog';
import type {
  SolarIntent,
  SolarWizardAnswers,
  SolarWizardOutput,
} from '@/lib/quick-projects/solar/types';
import { solarSizingToBOQ } from '@/lib/quick-projects/solar/boq';
import type { BOQItem, LaborConfig } from '@/lib/quick-projects/engine/types';
import QuickBOQTable from './QuickBOQTable';
import LaborSection from './LaborSection';

const INTENTS: SolarIntent[] = ['backup', 'heavy_backup', 'off_grid', 'replace', 'budget', 'quote_check'];

const defaultAnswers: SolarWizardAnswers = {
  intent: null,
  backupHours: null,
  location: '',
  propertyType: null,
  appliances: buildDefaultSelections(),
  simultaneousLoads: {
    kettleMicrowave: false,
    pumpWithHouse: false,
    geyserWithHouse: false,
  },
  roof: {
    type: null,
    shading: null,
    orientation: '',
    spaceM2: null,
  },
  existing: {
    hasExisting: false,
    inverterKva: null,
    batteryKwh: null,
    panelCount: null,
    issues: '',
  },
  budgetUsd: null,
  quote: {
    totalUsd: null,
    inverterKva: null,
    batteryKwh: null,
    panelCount: null,
    panelWatt: null,
    notes: '',
  },
};

const stepOrder = [
  'intent',
  'context',
  'backup',
  'appliances',
  'simultaneous',
  'roof',
  'existing',
  'budget',
  'quote',
  'results',
  'brands',
  'optional_costs',
] as const;

type StepId = typeof stepOrder[number];

const stepTitles: Record<StepId, { title: string; subtitle: string }> = {
  intent: {
    title: 'What do you want from solar?',
    subtitle: 'This helps us tailor the system to your goals in Zimbabwe.',
  },
  context: {
    title: 'Property context',
    subtitle: 'Location and property type help us frame usage patterns.',
  },
  backup: {
    title: 'Backup hours',
    subtitle: 'Most households target 4–8 hours due to ZESA outages.',
  },
  appliances: {
    title: 'Appliance audit',
    subtitle: 'Tick what you need during outages. Heavy loads increase system size.',
  },
  simultaneous: {
    title: 'Simultaneous loads',
    subtitle: 'These raise inverter size because motors have surge power.',
  },
  roof: {
    title: 'Roof and installation',
    subtitle: `Each panel needs about 2 m². Panel wattage assumed at ${SOLAR_PANEL_WATT}W.`,
  },
  existing: {
    title: 'Existing system (optional)',
    subtitle: 'Tell us what you already have so we can size upgrades properly.',
  },
  budget: {
    title: 'Budget fit',
    subtitle: 'We will propose the best system within your budget.',
  },
  quote: {
    title: 'Quote check',
    subtitle: 'Let us sanity‑check a supplier quote against market tiers.',
  },
  results: {
    title: 'Solar recommendation',
    subtitle: 'Here is your sizing summary and cost estimate.',
  },
  brands: {
    title: 'Brand preferences',
    subtitle: 'Select your preferred equipment brands or leave as "No preference".',
  },
  optional_costs: {
    title: 'Optional costs',
    subtitle: 'Toggle any additional cost items you want included in the BOQ.',
  },
};

interface SolarQuickWizardProps {
  onChange: (output: SolarWizardOutput & { boqItems?: BOQItem[] }) => void;
  isContractor?: boolean;
  onSave?: (output: SolarWizardOutput & { boqItems?: BOQItem[] }) => void;
}

export default function SolarQuickWizard({ onChange, isContractor = false, onSave }: SolarQuickWizardProps) {
  const [answers, setAnswers] = useState<SolarWizardAnswers>(defaultAnswers);
  const [currentStep, setCurrentStep] = useState<StepId>('intent');

  // Brand preferences
  const [panelBrand, setPanelBrand] = useState('no_pref');
  const [inverterBrand, setInverterBrand] = useState('no_pref');
  const [batteryBrand, setBatteryBrand] = useState('no_pref');

  // Optional costs
  const [includeTransport, setIncludeTransport] = useState(false);
  const [includeInstall, setIncludeInstall] = useState(true);
  const [includeContingency, setIncludeContingency] = useState(false);

  // BOQ output
  const [boqItems, setBoqItems] = useState<BOQItem[] | null>(null);
  const [labor, setLabor] = useState<LaborConfig>({ enabled: false, method: 'percentage', percentage: 25 });

  const activeSteps = useMemo(() => {
    return stepOrder.filter((step) => {
      if (step === 'backup') {
        return ['backup', 'heavy_backup', 'off_grid', 'replace', 'budget'].includes(answers.intent || '');
      }
      if (step === 'appliances' || step === 'simultaneous' || step === 'roof') {
        return answers.intent !== 'quote_check';
      }
      if (step === 'existing') {
        return answers.intent === 'replace';
      }
      if (step === 'budget') {
        return answers.intent === 'budget';
      }
      if (step === 'quote') {
        return answers.intent === 'quote_check';
      }
      // brands and optional_costs only for non-quote-check
      if (step === 'brands' || step === 'optional_costs') {
        return answers.intent !== 'quote_check';
      }
      return true;
    });
  }, [answers.intent]);

  const stepIndex = activeSteps.indexOf(currentStep);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === activeSteps.length - 1;

  const result = useMemo(() => {
    if (!answers.intent || answers.intent === 'quote_check') return null;
    return computeSolarSizing(answers);
  }, [answers]);

  const costEstimate = result ? estimateHardwareCost(result) : null;

  const emitChange = (nextAnswers: SolarWizardAnswers) => {
    const nextResult = nextAnswers.intent && nextAnswers.intent !== 'quote_check'
      ? computeSolarSizing(nextAnswers)
      : null;
    onChange({ answers: nextAnswers, result: nextResult });
  };

  const updateAnswers = (updates: Partial<SolarWizardAnswers>) => {
    setAnswers((prev) => {
      const next = { ...prev, ...updates };
      emitChange(next);
      return next;
    });
  };

  const goNext = () => {
    if (isLast) {
      // Generate BOQ on last step
      if (result) {
        const augAnswers = {
          ...answers,
          panel_brand: panelBrand,
          inverter_brand: inverterBrand,
          battery_brand: batteryBrand,
          include_transport: includeTransport,
          include_install: includeInstall,
          include_contingency: includeContingency,
        };
        const items = solarSizingToBOQ(result, augAnswers as Parameters<typeof solarSizingToBOQ>[1]);
        setBoqItems(items);
      }
      return;
    }
    const nextStep = activeSteps[stepIndex + 1];
    if (nextStep) setCurrentStep(nextStep);
  };

  const goBack = () => {
    if (boqItems) {
      setBoqItems(null);
      return;
    }
    if (isFirst) return;
    const prevStep = activeSteps[stepIndex - 1];
    if (prevStep) setCurrentStep(prevStep);
  };

  // ── BOQ results view ──────────────────────────────────────────────────────
  if (boqItems) {
    return (
      <div className="solar-wizard">
        <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
          ← Back to wizard
        </button>
        <QuickBOQTable
          projectType="solar"
          initialItems={boqItems}
          labor={labor}
          onLaborChange={setLabor}
          isContractor={isContractor}
          onSave={onSave ? (items) => onSave({ answers, result, boqItems: items }) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="solar-wizard">
      <div className="wizard-header">
        <div>
          <span className="wizard-kicker">SOLAR GUIDED SETUP</span>
          <h3>{stepTitles[currentStep].title}</h3>
          <p>{stepTitles[currentStep].subtitle}</p>
        </div>
        <div className="wizard-progress">
          Step {stepIndex + 1} of {activeSteps.length}
        </div>
      </div>

      {currentStep === 'intent' && (
        <div className="option-grid">
          {INTENTS.map((intent) => (
            <Card
              key={intent}
              className={`option-card ${answers.intent === intent ? 'selected' : ''}`}
              onClick={() => updateAnswers({ intent })}
            >
              <Lightning size={22} />
              <span>{SOLAR_INTENT_LABELS[intent]}</span>
            </Card>
          ))}
        </div>
      )}

      {currentStep === 'context' && (
        <div className="form-grid">
          <Input
            label="City / Suburb"
            placeholder="e.g. Borrowdale, Harare"
            value={answers.location}
            onChange={(event) => updateAnswers({ location: event.target.value })}
          />
          <div className="pill-grid">
            {[
              { id: 'apartment', label: 'Apartment' },
              { id: 'house', label: 'House' },
              { id: 'farm', label: 'Farm / Plot' },
              { id: 'business', label: 'Business' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`pill ${answers.propertyType === item.id ? 'active' : ''}`}
                onClick={() => updateAnswers({ propertyType: item.id as any })}
              >
                <HouseSimple size={16} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {currentStep === 'backup' && (
        <div className="option-grid">
          {[2, 4, 6, 8, 12, 24].map((hours) => (
            <Card
              key={hours}
              className={`option-card ${answers.backupHours === hours ? 'selected' : ''}`}
              onClick={() => updateAnswers({ backupHours: hours })}
            >
              <SunDim size={22} />
              <span>{hours} hrs backup</span>
            </Card>
          ))}
        </div>
      )}

      {currentStep === 'appliances' && (
        <div className="appliance-grid">
          {SOLAR_APPLIANCES.map((appliance) => {
            const selection = answers.appliances[appliance.id];
            return (
              <div key={appliance.id} className={`appliance-card ${selection.include ? 'active' : ''}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={selection.include}
                    onChange={(event) => {
                      const include = event.target.checked;
                      setAnswers((prev) => {
                        const next = {
                          ...prev,
                          appliances: {
                            ...prev.appliances,
                            [appliance.id]: {
                              ...prev.appliances[appliance.id],
                              include,
                              qty: include ? prev.appliances[appliance.id].qty || 1 : 0,
                              hours: include ? prev.appliances[appliance.id].hours || 2 : 0,
                            },
                          },
                        };
                        emitChange(next);
                        return next;
                      });
                    }}
                  />
                  <span>{appliance.label}</span>
                  <small>{appliance.watts}W</small>
                </label>
                {selection.include && (
                  <div className="appliance-inputs">
                    <Input
                      label="Qty"
                      type="number"
                      min={1}
                      value={selection.qty || ''}
                      onChange={(event) => {
                        const qty = Number(event.target.value);
                        setAnswers((prev) => {
                          const next = {
                            ...prev,
                            appliances: {
                              ...prev.appliances,
                              [appliance.id]: {
                                ...prev.appliances[appliance.id],
                                qty,
                              },
                            },
                          };
                          emitChange(next);
                          return next;
                        });
                      }}
                    />
                    <Input
                      label="Hours/day"
                      type="number"
                      min={0}
                      value={selection.hours || ''}
                      onChange={(event) => {
                        const hours = Number(event.target.value);
                        setAnswers((prev) => {
                          const next = {
                            ...prev,
                            appliances: {
                              ...prev.appliances,
                              [appliance.id]: {
                                ...prev.appliances[appliance.id],
                                hours,
                              },
                            },
                          };
                          emitChange(next);
                          return next;
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {currentStep === 'simultaneous' && (
        <div className="checklist">
          <label className="checkline">
            <input
              type="checkbox"
              checked={answers.simultaneousLoads.kettleMicrowave}
              onChange={(event) => updateAnswers({
                simultaneousLoads: {
                  ...answers.simultaneousLoads,
                  kettleMicrowave: event.target.checked,
                },
              })}
            />
            Kettle and microwave run together
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={answers.simultaneousLoads.pumpWithHouse}
              onChange={(event) => updateAnswers({
                simultaneousLoads: {
                  ...answers.simultaneousLoads,
                  pumpWithHouse: event.target.checked,
                },
              })}
            />
            Pump runs with household loads
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={answers.simultaneousLoads.geyserWithHouse}
              onChange={(event) => updateAnswers({
                simultaneousLoads: {
                  ...answers.simultaneousLoads,
                  geyserWithHouse: event.target.checked,
                },
              })}
            />
            Geyser runs with household loads
          </label>
        </div>
      )}

      {currentStep === 'roof' && (
        <div className="form-grid">
          <Input
            label="Roof orientation"
            placeholder="e.g. North-facing"
            value={answers.roof.orientation}
            onChange={(event) => updateAnswers({
              roof: { ...answers.roof, orientation: event.target.value },
            })}
          />
          <Input
            label="Roof space (m²)"
            type="number"
            min={0}
            value={answers.roof.spaceM2 || ''}
            onChange={(event) => updateAnswers({
              roof: { ...answers.roof, spaceM2: Number(event.target.value) },
            })}
          />
          <div className="pill-grid">
            {[
              { id: 'tile', label: 'Tile' },
              { id: 'ibr', label: 'IBR' },
              { id: 'concrete', label: 'Concrete' },
              { id: 'other', label: 'Other' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`pill ${answers.roof.type === item.id ? 'active' : ''}`}
                onClick={() => updateAnswers({ roof: { ...answers.roof, type: item.id as any } })}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="pill-grid">
            {[
              { id: 'none', label: 'No shading' },
              { id: 'partial', label: 'Partial shading' },
              { id: 'heavy', label: 'Heavy shading' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`pill ${answers.roof.shading === item.id ? 'active' : ''}`}
                onClick={() => updateAnswers({ roof: { ...answers.roof, shading: item.id as any } })}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {currentStep === 'existing' && (
        <div className="form-grid">
          <label className="checkline">
            <input
              type="checkbox"
              checked={answers.existing.hasExisting}
              onChange={(event) => updateAnswers({
                existing: { ...answers.existing, hasExisting: event.target.checked },
              })}
            />
            I already have a solar system
          </label>
          {answers.existing.hasExisting && (
            <>
              <Input
                label="Current inverter (kVA)"
                type="number"
                min={0}
                value={answers.existing.inverterKva || ''}
                onChange={(event) => updateAnswers({
                  existing: { ...answers.existing, inverterKva: Number(event.target.value) },
                })}
              />
              <Input
                label="Current battery (kWh)"
                type="number"
                min={0}
                value={answers.existing.batteryKwh || ''}
                onChange={(event) => updateAnswers({
                  existing: { ...answers.existing, batteryKwh: Number(event.target.value) },
                })}
              />
              <Input
                label="Current panel count"
                type="number"
                min={0}
                value={answers.existing.panelCount || ''}
                onChange={(event) => updateAnswers({
                  existing: { ...answers.existing, panelCount: Number(event.target.value) },
                })}
              />
              <Input
                label="Main issues (optional)"
                placeholder="e.g. Battery not lasting, inverter trips"
                value={answers.existing.issues}
                onChange={(event) => updateAnswers({
                  existing: { ...answers.existing, issues: event.target.value },
                })}
              />
            </>
          )}
        </div>
      )}

      {currentStep === 'budget' && (
        <div className="form-grid">
          <Input
            label="Target budget (USD)"
            type="number"
            min={0}
            value={answers.budgetUsd || ''}
            onChange={(event) => updateAnswers({ budgetUsd: Number(event.target.value) })}
          />
          <div className="info-card">
            <MapPin size={18} />
            <p>
              We will size the system to fit your budget and show trade‑offs (backup hours or heavy loads).
            </p>
          </div>
        </div>
      )}

      {currentStep === 'quote' && (
        <div className="form-grid">
          <Input
            label="Quoted total price (USD)"
            type="number"
            min={0}
            value={answers.quote.totalUsd || ''}
            onChange={(event) => updateAnswers({
              quote: { ...answers.quote, totalUsd: Number(event.target.value) },
            })}
          />
          <Input
            label="Inverter size (kVA)"
            type="number"
            min={0}
            value={answers.quote.inverterKva || ''}
            onChange={(event) => updateAnswers({
              quote: { ...answers.quote, inverterKva: Number(event.target.value) },
            })}
          />
          <Input
            label="Battery size (kWh)"
            type="number"
            min={0}
            value={answers.quote.batteryKwh || ''}
            onChange={(event) => updateAnswers({
              quote: { ...answers.quote, batteryKwh: Number(event.target.value) },
            })}
          />
          <Input
            label="Panel count"
            type="number"
            min={0}
            value={answers.quote.panelCount || ''}
            onChange={(event) => updateAnswers({
              quote: { ...answers.quote, panelCount: Number(event.target.value) },
            })}
          />
          <Input
            label="Panel wattage"
            type="number"
            min={0}
            value={answers.quote.panelWatt || ''}
            onChange={(event) => updateAnswers({
              quote: { ...answers.quote, panelWatt: Number(event.target.value) },
            })}
          />
          <Input
            label="Notes about the quote"
            placeholder="e.g. Deye inverter, Dyness battery, 2 year warranty"
            value={answers.quote.notes}
            onChange={(event) => updateAnswers({
              quote: { ...answers.quote, notes: event.target.value },
            })}
          />
        </div>
      )}

      {currentStep === 'results' && result && (
        <div className="results-grid">
          <div className="results-card">
            <h4>Recommended System</h4>
            <div className="results-row">
              <span>Inverter size</span>
              <strong>{result.inverterKva} kVA</strong>
            </div>
            <div className="results-row">
              <span>Battery storage</span>
              <strong>{result.batteryKwh} kWh</strong>
            </div>
            <div className="results-row">
              <span>Solar array</span>
              <strong>{result.solarArrayKw} kW</strong>
            </div>
            <div className="results-row">
              <span>Panels needed</span>
              <strong>{result.panelCount} panels</strong>
            </div>
            <div className="results-row">
              <span>Daily energy</span>
              <strong>{result.dailyEnergyKwh} kWh</strong>
            </div>
            <div className="tier-pill">Tier: {result.tier}</div>
          </div>

          <div className="results-card">
            <h4>Estimated Cost (USD)</h4>
            {costEstimate && (
              <>
                <div className="results-row">
                  <span>Hardware</span>
                  <strong>${costEstimate.hardware}</strong>
                </div>
                <div className="results-row">
                  <span>Installation</span>
                  <strong>${costEstimate.install}</strong>
                </div>
                <div className="results-row">
                  <span>Total</span>
                  <strong>${costEstimate.total}</strong>
                </div>
              </>
            )}
            <div className="hint">Typical range: ${result.estimatedCostUsd.low}–${result.estimatedCostUsd.high}</div>
          </div>

          {result.warnings.length > 0 && (
            <div className="results-card warning">
              <h4>
                <Warning size={18} /> Notes
              </h4>
              <ul>
                {result.warnings.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="results-card summary">
            <h4>Summary</h4>
            <p>
              This sizing is tailored for Zimbabwe load‑shedding and assumes hybrid backup usage.
            </p>
            <div className="summary-pill">
              <CheckCircle size={16} /> Ready to save this quick project
            </div>
          </div>
        </div>
      )}

      {currentStep === 'results' && answers.intent === 'quote_check' && (
        <div className="results-grid">
          <div className="results-card warning">
            <h4>
              <Warning size={18} /> Quote check summary
            </h4>
            <p>
              We will compare your quote against Zimbabwe system tiers once you save this quick project.
            </p>
            <div className="results-row">
              <span>Quoted total</span>
              <strong>{answers.quote.totalUsd ? `$${answers.quote.totalUsd}` : 'Not provided'}</strong>
            </div>
            <div className="results-row">
              <span>Inverter</span>
              <strong>{answers.quote.inverterKva ? `${answers.quote.inverterKva} kVA` : 'Not provided'}</strong>
            </div>
            <div className="results-row">
              <span>Battery</span>
              <strong>{answers.quote.batteryKwh ? `${answers.quote.batteryKwh} kWh` : 'Not provided'}</strong>
            </div>
            <div className="results-row">
              <span>Panels</span>
              <strong>{answers.quote.panelCount ? `${answers.quote.panelCount} panels` : 'Not provided'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ── Brand Picker ─────────────────────────────────────────────────── */}
      {currentStep === 'brands' && (
        <div className="form-grid">
          <div>
            <label className="field-label">Solar Panel Brand</label>
            <div className="pill-grid">
              {[
                { id: 'ja_solar', label: 'JA Solar' },
                { id: 'canadian_solar', label: 'Canadian Solar' },
                { id: 'no_pref', label: 'No preference' },
                { id: 'cheapest', label: 'Cheapest available' },
              ].map((b) => (
                <button key={b.id} type="button" className={`pill ${panelBrand === b.id ? 'pill--active' : ''}`} onClick={() => setPanelBrand(b.id)}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">Inverter Brand</label>
            <div className="pill-grid">
              {[
                { id: 'deye',    label: 'Deye' },
                { id: 'victron', label: 'Victron' },
                { id: 'solarmd', label: 'SolarMD' },
                { id: 'no_pref', label: 'No preference' },
              ].map((b) => (
                <button key={b.id} type="button" className={`pill ${inverterBrand === b.id ? 'pill--active' : ''}`} onClick={() => setInverterBrand(b.id)}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">Battery Brand</label>
            <div className="pill-grid">
              {[
                { id: 'pylontech',   label: 'Pylontech' },
                { id: 'freedom_won', label: 'Freedom Won' },
                { id: 'no_pref',     label: 'No preference' },
              ].map((b) => (
                <button key={b.id} type="button" className={`pill ${batteryBrand === b.id ? 'pill--active' : ''}`} onClick={() => setBatteryBrand(b.id)}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Optional Costs ───────────────────────────────────────────────── */}
      {currentStep === 'optional_costs' && (
        <div className="form-grid">
          {[
            { id: 'transport',   label: 'Equipment delivery / transport', val: includeTransport, set: setIncludeTransport },
            { id: 'install',     label: 'Installation labor (25% of hardware)', val: includeInstall, set: setIncludeInstall },
            { id: 'contingency', label: 'Contingency (5%)', val: includeContingency, set: setIncludeContingency },
          ].map((opt) => (
            <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
              <input type="checkbox" checked={opt.val} onChange={(e) => opt.set(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}

      <div className="wizard-actions">
        <Button variant="secondary" onClick={goBack} disabled={isFirst && !boqItems}>
          Back
        </Button>
        <Button variant="primary" onClick={goNext}>
          {isLast ? 'Generate BOQ' : 'Continue'}
        </Button>
      </div>

      <style jsx>{`
        .solar-wizard {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .wizard-header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .wizard-kicker {
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--color-text-muted);
          font-weight: 600;
        }

        .wizard-header h3 {
          margin: 8px 0 4px;
        }

        .wizard-progress {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
        }

        .option-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        :global(.option-card) {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border: 2px solid transparent !important;
          cursor: pointer;
        }

        :global(.option-card.selected) {
          border-color: var(--color-accent) !important;
          background: rgba(78, 154, 247, 0.08);
        }

        .form-grid {
          display: grid;
          gap: 16px;
        }

        .pill-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .pill {
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          border-radius: 999px;
          padding: 6px 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
        }

        .pill.active {
          border-color: var(--color-primary);
          background: rgba(59, 130, 246, 0.1);
        }

        .appliance-grid {
          display: grid;
          gap: 12px;
        }

        .appliance-card {
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 12px;
          background: var(--color-surface);
        }

        .appliance-card.active {
          border-color: var(--color-accent);
          background: rgba(78, 154, 247, 0.05);
        }

        .appliance-card label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
        }

        .appliance-card small {
          margin-left: auto;
          color: var(--color-text-muted);
        }

        .appliance-inputs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
          margin-top: 10px;
        }

        .checklist {
          display: grid;
          gap: 12px;
        }

        .checkline {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .results-grid {
          display: grid;
          gap: 16px;
        }

        .results-card {
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 16px;
          background: var(--color-surface);
        }

        .results-card.warning {
          border-color: rgba(234, 179, 8, 0.5);
          background: rgba(234, 179, 8, 0.1);
        }

        .results-card h4 {
          margin: 0 0 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .results-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
        }

        .tier-pill {
          margin-top: 12px;
          background: rgba(59, 130, 246, 0.1);
          padding: 6px 12px;
          border-radius: 999px;
          width: fit-content;
          font-weight: 600;
        }

        .summary-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(34, 197, 94, 0.1);
          color: var(--color-success, #16a34a);
          font-weight: 600;
        }

        .info-card {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 12px;
          border-radius: 12px;
          border: 1px dashed var(--color-border);
          color: var(--color-text-secondary);
        }

        .wizard-actions {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        @media (max-width: 720px) {
          .wizard-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
