import { describe, expect, it } from 'vitest';
import { assessPlanReview, planReviewKey, type PlanReviewInput } from './planReview';

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

  it('requires another acknowledgement after plan openings or scope change', () => {
    const confirmedKey = planReviewKey(base);
    expect(planReviewKey({ ...base, windows: 9 })).not.toBe(confirmedKey);
    expect(planReviewKey({ ...base, stages: ['Roofing'] })).not.toBe(confirmedKey);
  });
});
