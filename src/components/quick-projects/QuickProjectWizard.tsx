'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Info,
  Warning,
} from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import { getActiveSteps, getVisibleQuestions, isNotSure, isStepComplete, updateAnswer } from '@/lib/quick-projects/engine/boqEngine';
import type { Answers, BOQItem, LaborConfig, QuestionFlow, QuestionOption, WizardStep } from '@/lib/quick-projects/engine/types';
import QuickBOQTable from './QuickBOQTable';

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuickProjectWizardProps {
  flow: QuestionFlow;
  onSave?: (items: BOQItem[], answers: Answers, labor: LaborConfig) => void;
  isContractor?: boolean;
}

// ─── Option Grid ──────────────────────────────────────────────────────────────

function OptionGrid({
  options,
  value,
  multi,
  onChange,
}: {
  options: QuestionOption[];
  value: string | string[];
  multi: boolean;
  onChange: (v: string | string[]) => void;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  function toggle(v: string) {
    if (multi) {
      const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
      onChange(next);
    } else {
      onChange(selected[0] === v ? '' : v);
    }
  }

  return (
    <div className="option-grid">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`option-card ${active ? 'option-card--active' : ''} ${opt.recommended ? 'option-card--recommended' : ''}`}
          >
            <div className="option-card__label">
              {opt.label}
              {opt.recommended && <span className="option-card__badge">Recommended</span>}
            </div>
            {opt.description && <p className="option-card__desc">{opt.description}</p>}
            {active && <CheckCircle weight="fill" className="option-card__check" size={18} />}
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
}: {
  question: ReturnType<typeof getVisibleQuestions>[number];
  answers: Answers;
  notSureIds: Set<string>;
  onChange: (id: string, value: unknown) => void;
  onNotSure: (id: string, on: boolean) => void;
}) {
  const val = answers[question.id];
  const isNS = notSureIds.has(question.id);

  const tip = question.recommendation?.(answers);

  return (
    <div className="wizard-question">
      <label className="wizard-question__label">{question.title}</label>
      {question.description && <p className="wizard-question__hint">{question.description}</p>}

      {/* Toggle */}
      {question.type === 'toggle' && (
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={Boolean(val ?? question.defaultValue)}
            onChange={(e) => onChange(question.id, e.target.checked)}
          />
          <span className="toggle-switch__track" />
          <span className="toggle-switch__label">{Boolean(val ?? question.defaultValue) ? 'Yes' : 'No'}</span>
        </label>
      )}

      {/* Select */}
      {question.type === 'select' && !isNS && (
        <OptionGrid
          options={question.options ?? []}
          value={(val as string) ?? ''}
          multi={false}
          onChange={(v) => onChange(question.id, v)}
        />
      )}

      {/* Multi-select */}
      {question.type === 'multi-select' && (
        <OptionGrid
          options={question.options ?? []}
          value={(val as string[]) ?? []}
          multi={true}
          onChange={(v) => onChange(question.id, v)}
        />
      )}

      {/* Number */}
      {question.type === 'number' && !isNS && (
        <div className="number-input-row">
          <input
            type="number"
            className="wizard-input"
            value={(val as number) ?? (question.defaultValue as number) ?? ''}
            min={question.min}
            max={question.max}
            step={question.step ?? 1}
            onChange={(e) => onChange(question.id, parseFloat(e.target.value) || 0)}
          />
          {question.unit && <span className="wizard-input__unit">{question.unit}</span>}
        </div>
      )}

      {/* Text */}
      {question.type === 'text' && (
        <input
          type="text"
          className="wizard-input"
          placeholder={question.placeholder ?? ''}
          value={(val as string) ?? ''}
          onChange={(e) => onChange(question.id, e.target.value)}
        />
      )}

      {/* Not sure option */}
      {question.notSureOption && (
        <button
          type="button"
          className={`not-sure-btn ${isNS ? 'not-sure-btn--active' : ''}`}
          onClick={() => onNotSure(question.id, !isNS)}
        >
          {isNS ? '← Back to options' : 'Not sure?'}
        </button>
      )}

      {/* Recommendation tip */}
      {tip && (
        <div className="wizard-tip">
          <Info size={14} />
          <span>{tip}</span>
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
}: {
  step: WizardStep;
  answers: Answers;
  notSureIds: Set<string>;
  onChange: (id: string, value: unknown) => void;
  onNotSure: (id: string, on: boolean) => void;
}) {
  const questions = getVisibleQuestions(step, answers, notSureIds);
  return (
    <div className="wizard-step">
      <h2 className="wizard-step__title">{step.title}</h2>
      {step.subtitle && <p className="wizard-step__subtitle">{step.subtitle}</p>}
      <div className="wizard-step__questions">
        {questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            answers={answers}
            notSureIds={notSureIds}
            onChange={onChange}
            onNotSure={onNotSure}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function QuickProjectWizard({ flow, onSave, isContractor = false }: QuickProjectWizardProps) {
  const [answers, setAnswers] = useState<Answers>({});
  const [notSureIds, setNotSureIds] = useState<Set<string>>(new Set());
  const [stepIndex, setStepIndex] = useState(0);
  const [boqItems, setBoqItems] = useState<BOQItem[] | null>(null);
  const [labor, setLabor] = useState<LaborConfig>({
    enabled: false,
    method: 'percentage',
    percentage: 25,
    dailyRateUsd: 35,
    days: 5,
    workerCount: 2,
  });

  const activeSteps = useMemo(() => getActiveSteps(flow, answers), [flow, answers]);
  const currentStep = activeSteps[stepIndex];
  const totalSteps = activeSteps.length;
  const isLastStep = stepIndex === totalSteps - 1;
  const canProceed = currentStep ? isStepComplete(currentStep, answers, notSureIds) : true;

  const handleChange = useCallback((id: string, value: unknown) => {
    setAnswers((prev) => updateAnswer(prev, id, value));
  }, []);

  const handleNotSure = useCallback((id: string, on: boolean) => {
    setNotSureIds((prev) => {
      const next = new Set(prev);
      if (on) {
        next.add(id);
        // Set the question value to 'not_sure' sentinel
        setAnswers((a) => updateAnswer(a, id, 'not_sure'));
      } else {
        next.delete(id);
        setAnswers((a) => updateAnswer(a, id, undefined));
      }
      return next;
    });
  }, []);

  function handleNext() {
    if (isLastStep) {
      const items = flow.calculateBOQ(answers);
      setBoqItems(items);
    } else {
      setStepIndex((i) => Math.min(i + 1, totalSteps - 1));
    }
  }

  function handleBack() {
    if (boqItems) {
      setBoqItems(null);
    } else {
      setStepIndex((i) => Math.max(i - 1, 0));
    }
  }

  const progressPct = boqItems ? 100 : Math.round((stepIndex / totalSteps) * 100);

  // ── BOQ Results View ───────────────────────────────────────────────────────
  if (boqItems) {
    return (
      <div className="wizard-container">
        <button onClick={handleBack} className="wizard-back-btn">
          <ArrowLeft size={16} /> Back to questions
        </button>
        <QuickBOQTable
          projectType={flow.projectType}
          initialItems={boqItems}
          labor={labor}
          onLaborChange={setLabor}
          isContractor={isContractor}
          onSave={onSave ? (items) => onSave(items, answers, labor) : undefined}
        />
      </div>
    );
  }

  // ── Step Wizard View ───────────────────────────────────────────────────────
  return (
    <div className="wizard-container">
      {/* Progress bar */}
      <div className="wizard-progress">
        <div className="wizard-progress__bar" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="wizard-progress__label">Step {stepIndex + 1} of {totalSteps}</p>

      {/* Step content */}
      {currentStep && (
        <StepView
          step={currentStep}
          answers={answers}
          notSureIds={notSureIds}
          onChange={handleChange}
          onNotSure={handleNotSure}
        />
      )}

      {/* Navigation */}
      <div className="wizard-nav">
        {stepIndex > 0 && (
          <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={handleBack}>
            Back
          </Button>
        )}
        <Button
          variant="primary"
          icon={<ArrowRight size={16} />}
          iconPosition="right"
          disabled={!canProceed}
          onClick={handleNext}
        >
          {isLastStep ? 'Generate BOQ' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
