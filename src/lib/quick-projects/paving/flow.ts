import type { QuestionFlow } from '../engine/types';
import { calculatePavingBOQ } from './calculations';

export const pavingFlow: QuestionFlow = {
  projectType: 'paving',
  title: 'Paving & Driveways',
  description: 'Get a full paving BOQ — surface, sub-base, edging, and optional extras.',
  icon: 'Road',
  estimatedMinutes: 4,
  steps: [
    {
      id: 'type',
      title: 'Paving Type',
      questions: [
        {
          id: 'paving_type',
          type: 'select',
          title: 'What paving surface?',
          required: true,
          options: [
            { value: 'interlock', label: 'Interlocking bricks',   description: 'Most popular in Zimbabwe. Removable, durable, various colours.', recommended: true },
            { value: 'concrete',  label: 'Concrete slab',          description: 'Cast in place. Low maintenance.' },
            { value: 'stamped',   label: 'Stamped / decorative concrete', description: 'Concrete with pattern finish. Premium look.' },
            { value: 'cobble',    label: 'Granite cobblestones',   description: 'Natural stone. Long-lasting, premium.' },
          ],
        },
      ],
    },
    {
      id: 'area',
      title: 'Area',
      questions: [
        {
          id: 'area_method',
          type: 'select',
          title: 'How do you know the area?',
          options: [
            { value: 'total',      label: 'I know the total area', description: 'Enter total m².' },
            { value: 'dimensions', label: 'Enter dimensions',       description: 'Length × width.' },
          ],
        },
        { id: 'area_m2',     type: 'number', title: 'Total paving area', unit: 'm²', min: 1, max: 5000, defaultValue: 50, required: true, condition: (a) => a.area_method !== 'dimensions' },
        { id: 'area_length', type: 'number', title: 'Length', unit: 'm', min: 1, required: true, condition: (a) => a.area_method === 'dimensions' },
        { id: 'area_width',  type: 'number', title: 'Width',  unit: 'm', min: 1, required: true, condition: (a) => a.area_method === 'dimensions' },
      ],
    },
    {
      id: 'sub_base',
      title: 'Sub-base',
      questions: [
        {
          id: 'sub_base_needed',
          type: 'select',
          title: 'Is a new sub-base required?',
          options: [
            { value: 'yes', label: 'Yes — prepare new sub-base',   description: 'Add G5 material and compaction.' },
            { value: 'no',  label: 'No — existing base is adequate', description: 'Pave directly on existing foundation.' },
          ],
          notSureOption: true,
          notSureFollowUp: [{ id: 'sub_base_needed', type: 'select', title: 'We recommend including a sub-base for new driveways.',
            options: [{ value: 'yes', label: 'Yes (recommended)', recommended: true }, { value: 'no', label: 'No' }] }],
        },
        { id: 'include_compaction', type: 'toggle', title: 'Include plate compactor hire', defaultValue: true, condition: (a) => a.sub_base_needed === 'yes' },
      ],
    },
    {
      id: 'edging',
      title: 'Edging & Kerbing',
      questions: [
        { id: 'kerb_length', type: 'number', title: 'Total kerbing length (0 if none)', unit: 'm', min: 0, defaultValue: 0 },
        {
          id: 'kerb_type',
          type: 'select',
          title: 'Kerb type',
          condition: (a) => parseFloat(a.kerb_length as string) > 0,
          options: [
            { value: 'precast', label: 'Precast kerb', description: 'Factory made, quick to install.', recommended: true },
            { value: 'cast',    label: 'Cast in-situ', description: 'Lower material cost, more labour.' },
          ],
        },
      ],
    },
    {
      id: 'optional_costs',
      title: 'Optional Costs',
      questions: [
        { id: 'include_excavation', type: 'toggle', title: 'Include area excavation',      defaultValue: false },
        { id: 'include_sealing',    type: 'toggle', title: 'Include paving sealer',        defaultValue: false },
        { id: 'include_transport',  type: 'toggle', title: 'Include material transport',   defaultValue: false },
      ],
    },
  ],
  calculateBOQ: calculatePavingBOQ,
};
