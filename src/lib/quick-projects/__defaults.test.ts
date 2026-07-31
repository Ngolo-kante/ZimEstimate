import { describe, expect, it } from 'vitest';
import { applyDefaultAnswers, getActiveSteps, getVisibleQuestions, isStepComplete } from './engine/boqEngine';
import type { QuestionFlow } from './engine/types';
import { septicFlow } from './septic/flow';
import { waterFlow } from './water/flow';
import { boreholeFlow } from './borehole/flow';
import { fencingFlow } from './fencing/flow';
import { pavingFlow } from './paving/flow';

const flows: [string, QuestionFlow][] = [
  ['septic', septicFlow],
  ['water', waterFlow],
  ['borehole', boreholeFlow],
  ['fencing', fencingFlow],
  ['paving', pavingFlow],
];

describe('quick project defaults satisfy validation', () => {
  flows.forEach(([name, flow]) => {
    it(`${name}: every question with a defaultValue passes Continue untouched`, () => {
      const empty = new Set<string>();
      const steps = getActiveSteps(flow, {});
      const seeded = applyDefaultAnswers(steps, {}, empty);

      const offenders: string[] = [];
      steps.forEach((step) => {
        getVisibleQuestions(step, seeded, empty).forEach((q) => {
          if (q.defaultValue === undefined) return;
          if (seeded[q.id] === undefined) offenders.push(`${step.id}/${q.id}`);
        });
      });
      expect(offenders, `unseeded defaults: ${offenders.join(', ')}`).toEqual([]);
    });

    it(`${name}: Continue works on raw untouched answers, no seeding`, () => {
      // The exact reported scenario: open a step, leave a toggle showing its
      // default "No", press Continue. This asserts against raw {} answers, so
      // it fails if isStepComplete goes back to rejecting undefined.
      const empty = new Set<string>();
      const steps = getActiveSteps(flow, {});
      const blocked: string[] = [];
      steps.forEach((step) => {
        const visible = getVisibleQuestions(step, {}, empty).filter((q) => q.required !== false);
        if (visible.length === 0) return;
        if (visible.every((q) => q.defaultValue !== undefined) && !isStepComplete(step, {}, empty)) {
          blocked.push(step.id);
        }
      });
      expect(blocked, `steps rejecting Continue with defaults shown: ${blocked.join(', ')}`).toEqual([]);
    });

    it(`${name}: a step whose questions all have defaults is complete untouched`, () => {
      const empty = new Set<string>();
      const steps = getActiveSteps(flow, {});
      const seeded = applyDefaultAnswers(steps, {}, empty);

      const blocked: string[] = [];
      steps.forEach((step) => {
        const visible = getVisibleQuestions(step, seeded, empty).filter((q) => q.required !== false);
        if (visible.length === 0) return;
        const allDefaulted = visible.every((q) => q.defaultValue !== undefined);
        if (allDefaulted && !isStepComplete(step, seeded, empty)) blocked.push(step.id);
      });
      expect(blocked, `steps blocking Continue despite defaults: ${blocked.join(', ')}`).toEqual([]);
    });
  });
});
