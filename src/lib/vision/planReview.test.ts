import { describe, expect, it } from 'vitest';
import { assessPlanReview, isPlanReviewBlocked, planIdentityKey, type PlanReviewInput } from './planReview';

const base: PlanReviewInput = {
  area: 178,
  rooms: Array.from({ length: 8 }, (_, index) => ({ name: `Room ${index + 1}`, length: 4.45, width: 5 })),
  doors: 9,
  windows: 8,
  externalWallLength: 54,
  internalWallLength: 28,
  stages: ['Substructure', 'Superstructure', 'Roofing', 'Finishing', 'Exterior'],
  includeLabor: true,
};

describe('uploaded plan review', () => {
  it('flags missing and suspicious quantities without rejecting a valid area', () => {
    const findings = assessPlanReview({ ...base, doors: 1, windows: 0, noExternalWallsDetected: true });
    expect(findings.map((finding) => finding.id)).toEqual(['doors', 'windows', 'walls']);
    expect(findings.every((finding) => finding.severity === 'check')).toBe(true);
  });

  it('requires rooms, positive area and selected stages', () => {
    const findings = assessPlanReview({ ...base, area: 0, rooms: [], stages: [] });
    expect(findings.filter((finding) => finding.severity === 'required').map((finding) => finding.id)).toEqual(['area', 'rooms', 'stages']);
  });

  it('does not invent a warning when plausible plan quantities are supplied', () => {
    expect(assessPlanReview(base)).toEqual([]);
  });

  it('keeps a confirmation through door, window and stage edits but not a changed plan', () => {
    const confirmedKey = planIdentityKey(base);
    expect(planIdentityKey({ ...base, windows: 9, stages: ['Roofing'] })).toBe(confirmedKey);
    expect(planIdentityKey({ ...base, area: base.area + 10 })).not.toBe(confirmedKey);
    expect(planIdentityKey({ ...base, rooms: base.rooms.slice(1) })).not.toBe(confirmedKey);
  });

  it('says when only the printed labels were read, instead of a generic confidence warning', () => {
    const findings = assessPlanReview({ ...base, rooms: base.rooms.slice(0, 4), confidence: 60, readFromLabels: true });
    const labels = findings.find((finding) => finding.id === 'labels');
    expect(labels?.text).toContain('4 rooms');
    expect(labels?.severity).toBe('check');
    expect(findings.some((finding) => finding.id === 'confidence')).toBe(false);
  });

  it('blocks only on missing essentials', () => {
    expect(isPlanReviewBlocked(base)).toBe(false);
    expect(isPlanReviewBlocked({ ...base, windows: 0 })).toBe(false);
    expect(isPlanReviewBlocked({ ...base, stages: [] })).toBe(true);
  });
});
