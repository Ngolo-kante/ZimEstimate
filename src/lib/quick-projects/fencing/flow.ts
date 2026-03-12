import type { QuestionFlow } from '../engine/types';
import { calculateFencingBOQ } from './calculations';

export const fencingFlow: QuestionFlow = {
  projectType: 'fencing',
  title: 'Fencing & Boundary Walls',
  description: 'Get a BOQ for your perimeter fence or boundary wall.',
  icon: 'Fence',
  estimatedMinutes: 4,
  steps: [
    {
      id: 'type',
      title: 'Fence Type',
      questions: [
        {
          id: 'fence_type',
          type: 'select',
          title: 'What type of fence or wall?',
          required: true,
          options: [
            { value: 'precast',  label: 'Precast concrete panels', description: 'Pre-made panels between pillars. Quick to install. Very common in Zimbabwe.' },
            { value: 'brick',    label: 'Brick boundary wall',      description: 'Plastered brick wall. Durable, provides privacy.' },
            { value: 'palisade', label: 'Palisade (steel)',         description: 'Steel spear-top palisade. Security-focused.' },
            { value: 'mesh',     label: 'Diamond mesh',             description: 'Chain-link mesh. Budget-friendly.' },
            { value: 'electric', label: 'Electric fence',           description: 'High-security perimeter. Often used with other fencing.' },
          ],
        },
      ],
    },
    {
      id: 'dimensions',
      title: 'Dimensions',
      questions: [
        { id: 'fence_length', type: 'number', title: 'Total perimeter length', unit: 'm', min: 5, max: 2000, defaultValue: 60, required: true },
        { id: 'fence_height', type: 'number', title: 'Fence / wall height',   unit: 'm', min: 0.9, max: 3.0, step: 0.1, defaultValue: 1.8, required: true },
      ],
    },
    {
      id: 'gates',
      title: 'Gates',
      questions: [
        { id: 'gate_count', type: 'number', title: 'Number of gates', min: 0, max: 10, defaultValue: 1 },
        {
          id: 'gate_type',
          type: 'select',
          title: 'Gate type',
          condition: (a) => parseInt(a.gate_count as string) > 0,
          options: [
            { value: 'sliding_4m',    label: '4m sliding gate',    description: 'Standard driveway gate.', recommended: true },
            { value: 'sliding_3m',    label: '3m sliding gate',    description: 'Smaller driveway opening.' },
            { value: 'swing_double',  label: 'Double swing gate',  description: '3m opening, swings open.' },
            { value: 'swing_single',  label: 'Single swing gate',  description: 'Pedestrian access gate.' },
          ],
        },
      ],
    },
    {
      id: 'optional_costs',
      title: 'Optional Costs',
      questions: [
        { id: 'include_paint',     type: 'toggle', title: 'Include painting / sealing (brick walls)', defaultValue: false, condition: (a) => a.fence_type === 'brick' },
        { id: 'include_transport', type: 'toggle', title: 'Include material delivery',                defaultValue: false },
      ],
    },
  ],
  calculateBOQ: calculateFencingBOQ,
};
