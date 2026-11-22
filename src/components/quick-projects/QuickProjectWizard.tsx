'use client';

import { useCallback, useMemo, useEffect, useId, useState } from 'react';
import { useIsClient } from '@/hooks/useIsClient';
import { restoreQuickBOQSession, clearQuickBOQSession } from '@/lib/services/quickBoq';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Info,
  WarningCircle,
  CheckSquare,
} from '@phosphor-icons/react';
import { AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { CardBadge } from '@/components/ui/CardBadge';
import Button from '@/components/ui/Button';
import Switch from '@/components/ui/Switch';
import { applyDefaultAnswers, getActiveSteps, getVisibleQuestions, isStepComplete, updateAnswer } from '@/lib/quick-projects/engine/boqEngine';
import type { Answers, BOQItem, LaborConfig, QuestionFlow, QuestionOption, WizardStep } from '@/lib/quick-projects/engine/types';
import QuickBOQTable from './QuickBOQTable';
import BoreholeBudgetExplorer from './BoreholeBudgetExplorer';
import styles from './WizardChoices.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuickProjectWizardProps {
  flow: QuestionFlow;
  onSave?: (items: BOQItem[], answers: Answers, labor: LaborConfig, markupPct: number) => void;
  isContractor?: boolean;
}

// ─── Option Grid ──────────────────────────────────────────────────────────────

function OptionGrid({
  options,
  value,
  multi,
  onChange,
  hasError,
}: {
  options: QuestionOption[];
  value: string | string[];
  multi: boolean;
  onChange: (v: string | string[]) => void;
  hasError?: boolean;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  const SelectedIcon = multi ? CheckSquare : CheckCircle;

  function toggle(v: string) {
    if (multi) {
      const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
      onChange(next);
    } else {
      onChange(selected[0] === v ? '' : v);
    }
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 ${hasError ? 'rounded-xl ring-2 ring-red-300 ring-offset-2' : ''}`}>
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(opt.value)}
            className={`${styles.card} ${styles.answer} ${active ? styles.selected : ''}`}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <span className={`text-sm font-semibold block ${active ? 'text-blue-900' : 'text-slate-800'}`}>
                {opt.label}
              </span>
              {active ? (
                <SelectedIcon weight="fill" className="text-blue-600 flex-shrink-0" size={20} aria-hidden="true" />
              ) : (
                <span aria-hidden="true" className={`size-5 shrink-0 border border-slate-400 ${multi ? 'rounded-md' : 'rounded-full'}`} />
              )}
            </div>
            {opt.recommended && !active && <CardBadge variant="featured" className="mt-2">Recommended</CardBadge>}
            {opt.description && <p className={styles.detail}>{opt.description}</p>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Question Renderer ────────────────────────────────────────────────────────

function QuestionField({
  question,
  answers,
  notSureIds,
  onChange,
  onNotSure,
  showValidation,
}: {
  question: ReturnType<typeof getVisibleQuestions>[number];
  answers: Answers;
  notSureIds: Set<string>;
  onChange: (id: string, value: unknown) => void;
  onNotSure: (id: string, on: boolean) => void;
  showValidation: boolean;
}) {
  const switchId = useId();
  const val = answers[question.id];
  const toggleChecked = Boolean(val ?? question.defaultValue);
  const isNS = notSureIds.has(question.id);
  const tip = question.recommendation?.(answers);

  // Determine if this field has a validation error
  const isEmpty =
    val === undefined || val === null || val === '' ||
    (Array.isArray(val) && val.length === 0);
  const hasError = showValidation && question.required !== false && isEmpty;

  return (
    <div className={`mb-6 p-4 sm:p-6 rounded-xl bg-surface border transition-none ${hasError ? 'border-red-300 bg-red-50/30' : 'border-slate-200/60'}`}>
      <label className="block text-base font-bold text-slate-900 mb-1">{question.title}</label>
      {question.description && <p className="text-sm text-slate-500 mb-4">{question.description}</p>}

      {/* Toggle */}
      {question.type === 'toggle' && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2">
          <Switch
            id={switchId}
            checked={toggleChecked}
            label={question.title}
            onCheckedChange={(checked) => onChange(question.id, checked)}
          />
          <label htmlFor={switchId} className="flex min-h-11 flex-1 cursor-pointer items-center text-sm font-medium text-slate-900">
            {toggleChecked ? 'Yes' : 'No'}
          </label>
        </div>
      )}

      {/* Select — Dropdown layout */}
      {question.type === 'select' && question.layout === 'dropdown' && !isNS && (
        <select
          value={(val as string) ?? ''}
          onChange={(e) => onChange(question.id, e.target.value)}
          className={`w-full mt-4 rounded-xl border px-4 py-3 text-base outline-none transition-none bg-white appearance-none cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${hasError ? 'border-red-400' : 'border-slate-300'}`}
        >
          <option value="" disabled>Select an option...</option>
          {(question.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {/* Select — Card layout (default) */}
      {question.type === 'select' && question.layout !== 'dropdown' && !isNS && (
        <><OptionGrid
          options={question.options ?? []}
          value={(val as string) ?? ''}
          multi={false}
          onChange={(v) => onChange(question.id, v)}
          hasError={hasError}
        />
        {!question.notSureOption && !question.options?.some((opt) => opt.value === 'not_sure') && question.options?.find((opt) => opt.recommended) && (
          <button type="button" className="mt-3 min-h-11 text-sm font-medium text-blue-700 underline"
            onClick={() => onChange(question.id, question.options?.find((opt) => opt.recommended)?.value)}>
            Not sure — use {question.options.find((opt) => opt.recommended)?.label}
          </button>
        )}</>
      )}

      {/* Multi-select */}
      {question.type === 'multi-select' && (
        <OptionGrid
          options={question.options ?? []}
          value={(val as string[]) ?? []}
          multi={true}
          onChange={(v) => onChange(question.id, v)}
          hasError={hasError}
        />
      )}

      {/* Number — Slider layout */}
      {question.type === 'number' && question.layout === 'slider' && !isNS && (() => {
        const sliderVal = (val as number) ?? (question.defaultValue as number) ?? question.min ?? 0;
        return (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900">{sliderVal}</span>
              <span className="text-sm font-medium text-slate-500">{question.unit}</span>
            </div>
            <input
              type="range"
              min={question.min ?? 0}
              max={question.max ?? 100}
              step={question.step ?? 1}
              value={sliderVal}
              onChange={(e) => onChange(question.id, parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>{question.min ?? 0} {question.unit}</span>
              <span>{question.max ?? 100} {question.unit}</span>
            </div>
          </div>
        );
      })()}

      {/* Number — Standard input */}
      {question.type === 'number' && question.layout !== 'slider' && !isNS && (
        <div className="flex items-center gap-3 mt-4">
          <input
            type="number"
            className={`w-full max-w-[200px] rounded-xl border px-4 py-3 text-base outline-none transition-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${hasError ? 'border-red-400' : 'border-slate-300'}`}
            value={(val as number) ?? (question.defaultValue as number) ?? ''}
            min={question.min}
            max={question.max}
            step={question.step ?? 1}
            onChange={(e) => onChange(question.id, parseFloat(e.target.value) || 0)}
          />
          {question.unit && <span className="text-sm font-medium text-slate-500">{question.unit}</span>}
        </div>
      )}

      {/* Text */}
      {question.type === 'text' && (
        <input
          type="text"
          className={`w-full mt-4 rounded-xl border px-4 py-3 text-base outline-none transition-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${hasError ? 'border-red-400' : 'border-slate-300'}`}
          placeholder={question.placeholder ?? ''}
          value={(val as string) ?? ''}
          onChange={(e) => onChange(question.id, e.target.value)}
        />
      )}

      {/* Not sure option */}
      {question.notSureOption && (
        <button
          type="button"
          className={`mt-4 text-sm font-medium transition-none ${isNS ? 'text-blue-600 hover:text-blue-700' : 'text-slate-400 hover:text-slate-600 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-400'}`}
          onClick={() => onNotSure(question.id, !isNS)}
        >
          {isNS ? '← I know the specifics now, go back to options' : "I'm not sure, use safe estimates"}
        </button>
      )}

      {/* Validation error */}
      {hasError && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
          <WarningCircle size={16} weight="fill" />
          <span>Please select an option to continue.</span>
        </div>
      )}

      {/* Recommendation tip */}
      {tip && (
        <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-blue-50 text-blue-800 border border-blue-100/50">
          <Info size={18} className="flex-shrink-0 mt-0.5 text-blue-600" />
          <span className="text-sm">{tip}</span>
        </div>
      )}
    </div>
  );
}

// ─── Step View ────────────────────────────────────────────────────────────────

function StepView({
  step,
  answers,
  notSureIds,
  onChange,
  onNotSure,
  showValidation,
}: {
  step: WizardStep;
  answers: Answers;
  notSureIds: Set<string>;
  onChange: (id: string, value: unknown) => void;
  onNotSure: (id: string, on: boolean) => void;
  showValidation: boolean;
}) {
  const questions = getVisibleQuestions(step, answers, notSureIds);
  return (
    <div
      key={step.id}
      className="w-full"
    >
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{step.title}</h2>
        {step.subtitle && <p className="text-slate-600 text-base">{step.subtitle}</p>}
      </div>
      <div className="space-y-6">
        {questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            answers={answers}
            notSureIds={notSureIds}
            onChange={onChange}
            onNotSure={onNotSure}
            showValidation={showValidation}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

function QuickProjectWizardInner({ flow, onSave, isContractor = false }: QuickProjectWizardProps) {
  // Restored either from a save attempt that bounced through sign-in, or from
  // "Edit inputs" on a saved estimate. Read once, in a lazy initialiser, so the
  // restored state is on screen from the first render rather than flashing
  // question one and jumping.
  const restored = useState(() =>
    typeof window === 'undefined' ? null : restoreQuickBOQSession()
  )[0];
  const restoredForThisFlow = restored?.projectType === flow.projectType ? restored : null;

  // Cleared here rather than in the read, so StrictMode's second invocation of
  // the initialiser above still sees the value.
  useEffect(() => {
    if (restoredForThisFlow) clearQuickBOQSession();
  }, [restoredForThisFlow]);

  // The answers were persisted all along and then thrown away on the way back
  // in, so a restored session rebuilt its BOQ from an empty answer set. That
  // also left "Edit inputs" with nothing to edit.
  const [answers, setAnswers] = useState<Answers>(
    (restoredForThisFlow?.answers as Answers) ?? {}
  );
  const [notSureIds, setNotSureIds] = useState<Set<string>>(new Set());
  const [stepIndex, setStepIndex] = useState(0);

  // An empty item list means "reopen the questions with these answers filled
  // in", which is what Edit inputs wants. Only a populated list should jump
  // straight to the finished BOQ.
  const [boqItems, setBoqItems] = useState<BOQItem[] | null>(
    restoredForThisFlow?.boqItems?.length ? restoredForThisFlow.boqItems : null
  );
  const [showValidation, setShowValidation] = useState(false);
  const [labor, setLabor] = useState<LaborConfig>(
    restoredForThisFlow?.labor ?? {
      // On by default: most of these jobs need a builder. Borehole quotes
      // already carry the drilling crew and pump fitting as their own lines,
      // so a further percentage there would charge for labour twice.
      enabled: flow.projectType !== 'borehole',
      method: 'percentage',
      percentage: 25,
      dailyRateUsd: 35,
      days: 5,
      workerCount: 2,
    }
  );

  const activeSteps = useMemo(() => getActiveSteps(flow, answers), [flow, answers]);
  const currentStep = activeSteps[stepIndex];
  const totalSteps = activeSteps.length;
  const isLastStep = stepIndex === totalSteps - 1;
  const canProceed = currentStep ? isStepComplete(currentStep, answers, notSureIds) : true;

  const handleChange = useCallback((id: string, value: unknown) => {
    setAnswers((prev) => updateAnswer(prev, id, value));
    // Clear validation errors as user interacts
    setShowValidation(false);
  }, []);

  const handleNotSure = useCallback((id: string, on: boolean) => {
    setNotSureIds((prev) => {
      const next = new Set(prev);
      if (on) {
        next.add(id);
        setAnswers((a) => updateAnswer(a, id, 'not_sure'));
      } else {
        next.delete(id);
        setAnswers((a) => updateAnswer(a, id, undefined));
      }
      return next;
    });
    setShowValidation(false);
  }, []);

  function handleNext() {
    if (!canProceed) {
      // Show validation errors instead of blocking the button
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    if (isLastStep) {
      // Fold in defaults for anything the user never touched. Controls with a
      // defaultValue render that default but store nothing, so without this the
      // BOQ was costed from undefined for questions the user had been shown as
      // answered — a toggle defaulting to Yes would silently cost as No.
      // Applied only here, so step navigation keeps working off raw answers.
      const items = flow.calculateBOQ(applyDefaultAnswers(activeSteps, answers, notSureIds));
      setBoqItems(items);
    } else {
      setStepIndex((i) => Math.min(i + 1, totalSteps - 1));
    }
  }

  function handleBack() {
    setShowValidation(false);
    if (boqItems) {
      setBoqItems(null);
    } else {
      setStepIndex((i) => Math.max(i - 1, 0));
    }
  }

  const progressPct = boqItems ? 100 : Math.round((stepIndex / totalSteps) * 100);

  // ── Borehole Budget Explorer ────────────────────────────────────────────────
  if (flow.projectType === 'borehole' && answers.estimate_mode === 'budget' && stepIndex > 0) {
    return (
      <BoreholeBudgetExplorer
        onBack={() => { setStepIndex(0); setAnswers({}); }}
        isContractor={isContractor}
        onSave={onSave}
      />
    );
  }

  // ── BOQ Results View ───────────────────────────────────────────────────────
  if (boqItems) {
    return (
      <div className="w-full max-w-5xl mx-auto animate-fade-in pb-24">
        <button onClick={handleBack} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-none mb-6">
          <ArrowLeft size={16} /> Back to questions
        </button>
        <QuickBOQTable
          initialMarkupPct={restoredForThisFlow?.markupPct}
          projectType={flow.projectType}
          initialItems={boqItems}
          labor={labor}
          onLaborChange={setLabor}
          isContractor={isContractor}
          answers={applyDefaultAnswers(activeSteps, answers, notSureIds)}
          onSave={onSave ? (items, markupPct) => onSave(items, applyDefaultAnswers(activeSteps, answers, notSureIds), labor, markupPct) : undefined}
        />
      </div>
    );
  }

  // ── Step Wizard View ───────────────────────────────────────────────────────
  return (
    <div className="w-full pb-24">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm font-semibold text-slate-500 mb-3">
          <span>Step {stepIndex + 1} of {totalSteps}</span>
          <span className="text-blue-600">{progressPct}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full motion-safe:transition-[width] motion-safe:duration-200" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        {currentStep && (
          <StepView
            step={currentStep}
            answers={answers}
            notSureIds={notSureIds}
            onChange={handleChange}
            onNotSure={handleNotSure}
            showValidation={showValidation}
          />
        )}
      </AnimatePresence>

      {/* Navigation */}
      {/* pb-24 on mobile clears the global bottom navigation, which is fixed,
          72px tall and painted over anything in normal flow beneath it. Without
          it Continue and Cancel sat underneath the nav bar and could not be
          tapped — the same collision that hid Back and Continue in the manual
          builder. */}
      <div className="flex items-center justify-between mt-8 pt-5 pb-24 lg:pb-0 border-t border-slate-200/50">
        <div>
          {stepIndex > 0 ? (
            <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={handleBack} className="bg-white">
              Back
            </Button>
          ) : (
            <Link href="/quick-projects">
              <Button variant="secondary" className="bg-white text-slate-400 hover:text-slate-600 hover:border-slate-300">
                Cancel
              </Button>
            </Link>
          )}
        </div>
        <Button
          variant="primary"
          icon={isLastStep ? <CheckCircle size={18} weight="bold" /> : <ArrowRight size={16} />}
          iconPosition="right"
          onClick={handleNext}
          className={isLastStep ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "shadow-blue-500/25 shadow-lg"}
        >
          {isLastStep ? 'Generate Bill of Quantities' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}

/**
 * The wizard restores a session from browser storage in its first render
 * (a save that went through sign-in, or "Edit inputs"). The server cannot see
 * that storage, so it renders this placeholder, and the wizard mounts on the
 * client with the restored session already in place.
 */
export default function QuickProjectWizard(props: QuickProjectWizardProps) {
  const isClient = useIsClient();
  if (!isClient) {
    return <div className="w-full pb-24" aria-busy="true"><div className="h-2 w-full animate-pulse rounded-full bg-slate-100" /></div>;
  }
  return <QuickProjectWizardInner {...props} />;
}
