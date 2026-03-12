'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Info,
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { getActiveSteps, getVisibleQuestions, isStepComplete, updateAnswer } from '@/lib/quick-projects/engine/boqEngine';
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`group relative flex flex-col items-start p-4 rounded-xl border transition-all duration-200 text-left ${active ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'} ${opt.recommended && !active ? 'border-amber-200 bg-amber-50/30' : ''}`}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <span className={`text-sm font-semibold block ${active ? 'text-blue-900' : 'text-slate-800'}`}>
                {opt.label}
              </span>
              {active ? (
                <CheckCircle weight="fill" className="text-blue-600 flex-shrink-0" size={20} />
              ) : (
                <div className={`w-5 h-5 rounded-full border border-slate-300 flex-shrink-0 group-hover:border-blue-300 transition-colors ${multi ? 'rounded-md' : ''}`} />
              )}
            </div>
            {opt.recommended && !active && <span className="inline-block mt-2 px-2 py-0.5 rounded bg-amber-100/80 text-amber-700 text-[10px] font-bold uppercase tracking-wider">Recommended</span>}
            {opt.description && <p className={`mt-2 text-xs leading-relaxed ${active ? 'text-blue-700' : 'text-slate-500'}`}>{opt.description}</p>}
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
    <div className="mb-8 p-6 rounded-2xl bg-white border border-slate-200/60 shadow-sm">
      <label className="block text-base font-bold text-slate-900 mb-1">{question.title}</label>
      {question.description && <p className="text-sm text-slate-500 mb-4">{question.description}</p>}

      {/* Toggle */}
      {question.type === 'toggle' && (
        <label className="flex items-center gap-3 cursor-pointer mt-4 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-slate-50 transition-colors">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={Boolean(val ?? question.defaultValue)}
              onChange={(e) => onChange(question.id, e.target.checked)}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </div>
          <span className="text-sm font-medium text-slate-900">{Boolean(val ?? question.defaultValue) ? 'Yes' : 'No'}</span>
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
        <div className="flex items-center gap-3 mt-4">
          <input
            type="number"
            className="w-full max-w-[200px] rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
          className="w-full mt-4 rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          placeholder={question.placeholder ?? ''}
          value={(val as string) ?? ''}
          onChange={(e) => onChange(question.id, e.target.value)}
        />
      )}

      {/* Not sure option */}
      {question.notSureOption && (
        <button
          type="button"
          className={`mt-4 text-sm font-medium transition-colors ${isNS ? 'text-blue-600 hover:text-blue-700' : 'text-slate-400 hover:text-slate-600 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-400'}`}
          onClick={() => onNotSure(question.id, !isNS)}
        >
          {isNS ? '← I know the specifics now, go back to options' : "I'm not sure, use safe estimates"}
        </button>
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
}: {
  step: WizardStep;
  answers: Answers;
  notSureIds: Set<string>;
  onChange: (id: string, value: unknown) => void;
  onNotSure: (id: string, on: boolean) => void;
}) {
  const questions = getVisibleQuestions(step, answers, notSureIds);
  return (
    <motion.div
      key={step.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full"
    >
      <div className="mb-8">
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
          />
        ))}
      </div>
    </motion.div>
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
      <div className="w-full max-w-5xl mx-auto animate-fade-in pb-24">
        <button onClick={handleBack} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mb-6">
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
    <div className="w-full max-w-3xl mx-auto pb-24">
      {/* Progress */}
      <div className="mb-10">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          <span>Step {stepIndex + 1} of {totalSteps}</span>
          <span className="text-blue-600">{progressPct}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
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
          />
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-12 pt-6 border-t border-slate-200/50">
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
          disabled={!canProceed}
          onClick={handleNext}
          className={isLastStep ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "shadow-blue-500/25 shadow-lg"}
        >
          {isLastStep ? 'Generate Bill of Quantities' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
