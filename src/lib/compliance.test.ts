import { describe, expect, it } from 'vitest';
import { summariseCompliance, getStageRequirements, COMPLIANCE_CERTIFICATE_PREFIX } from './compliance';
import type { StageTask } from '@/lib/database.types';

const task = (title: string, done = false, note: string | null = null): StageTask => ({
  id: title, stage_id: 's', title, description: null, assigned_to: null, verification_note: note,
  is_completed: done, completed_at: null, sort_order: 0, is_default: true, created_at: '2026-10-12',
} as StageTask);

const stage = (id: string, category: 'substructure' | 'superstructure' | 'roofing', tasks: StageTask[], applicable = true) => ({
  id, name: category, boq_category: category, is_applicable: applicable, tasks,
});

describe('one count for compliance on every page', () => {
  it('counts certificates per stage requirement and admin tasks separately', () => {
    const sub = stage('a', 'substructure', [task('Dig trenches', true), task('Mark layout')]);
    const sup = stage('b', 'superstructure', [task('Scaffolding')]);
    const summary = summariseCompliance([sub, sup]);
    const certs = getStageRequirements('substructure').length + getStageRequirements('superstructure').length;
    expect(summary).toMatchObject({ totalCerts: certs, doneCerts: 0, totalTasks: 3, doneTasks: 1, total: certs + 3, done: 1 });
  });

  it('counts a certificate as done from its marker task, not as an admin task', () => {
    const certId = getStageRequirements('substructure')[0].id;
    const sub = stage('a', 'substructure', [task('Site plan', true, `${COMPLIANCE_CERTIFICATE_PREFIX}${certId}`), task('Dig trenches')]);
    const summary = summariseCompliance([sub]);
    expect(summary.doneCerts).toBe(1);
    expect(summary.totalTasks).toBe(1);
  });

  it('ignores stages that are switched off', () => {
    const summary = summariseCompliance([stage('a', 'roofing', [task('Trusses')], false)]);
    expect(summary.total).toBe(0);
    expect(summary.next).toBeNull();
  });

  it('names the first open item, certificates before tasks, in stage order', () => {
    const summary = summariseCompliance([stage('a', 'substructure', [task('Dig trenches')])]);
    expect(summary.next).toMatchObject({ stageId: 'a', type: 'Certificate', label: getStageRequirements('substructure')[0].label });
  });
});
