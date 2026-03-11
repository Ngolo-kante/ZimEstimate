import type { QuestionFlow } from '../engine/types';
import { calculateBoreholeBOQ } from './calculations';

export const boreholeFlow: QuestionFlow = {
  projectType: 'borehole',
  title: 'Borehole Drilling',
  description: 'Get a full drilling, casing, and pump installation BOQ.',
  icon: 'CirclesThree',
  estimatedMinutes: 4,
  steps: [
    {
      id: 'depth',
      title: 'Drilling Depth',
      questions: [
        {
          id: 'drilling_depth',
          type: 'number',
          title: 'Expected drilling depth',
          unit: 'm',
          min: 10, max: 200,
          defaultValue: 60,
          required: true,
          notSureOption: true,
          notSureFollowUp: [
            { id: 'drilling_depth', type: 'number', title: 'We estimate 60m for most Zimbabwe properties', unit: 'm', defaultValue: 60 },
          ],
          recommendation: () => 'Typical Zimbabwe depth: 40–80m. Urban Harare ~40–60m. Rural areas can exceed 100m.',
        },
      ],
    },
    {
      id: 'casing',
      title: 'Casing',
      questions: [
        {
          id: 'casing_type',
          type: 'select',
          title: 'Casing material',
          required: true,
          options: [
            { value: 'upvc',  label: 'uPVC casing',   description: 'Most common. Corrosion-resistant and cost-effective.', recommended: true },
            { value: 'steel', label: 'Steel casing',  description: 'More durable in deep boreholes (>80m).' },
          ],
        },
        {
          id: 'casing_diameter',
          type: 'select',
          title: 'Casing diameter',
          required: true,
          options: [
            { value: '100mm', label: '100mm', description: 'Standard domestic borehole.', recommended: true },
            { value: '150mm', label: '150mm', description: 'Higher yield — commercial / farm use.' },
          ],
        },
      ],
    },
    {
      id: 'pump',
      title: 'Pump',
      questions: [
        {
          id: 'pump_type',
          type: 'select',
          title: 'Pump type',
          required: true,
          options: [
            { value: 'submersible', label: 'Submersible pump',  description: 'Electric pump inside borehole. Most efficient.', recommended: true },
            { value: 'hand',        label: 'Afridev hand pump', description: 'Manual operation. No electricity required.' },
            { value: 'none',        label: 'Drilling only',     description: 'No pump — I will source it separately.' },
          ],
        },
      ],
    },
    {
      id: 'rising_main',
      title: 'Rising Main',
      condition: (a) => a.pump_type !== 'none',
      questions: [
        {
          id: 'rising_material',
          type: 'select',
          title: 'Rising main material',
          options: [
            { value: 'hdpe',  label: 'HDPE pipe',  description: 'Flexible, most common for boreholes.', recommended: true },
            { value: 'upvc',  label: 'uPVC pipe',  description: 'Rigid, suitable for shallow boreholes.' },
          ],
        },
        {
          id: 'rising_diameter',
          type: 'select',
          title: 'Pipe diameter',
          options: [
            { value: '25mm', label: '25mm', description: 'Sufficient for most domestic pumps.' },
            { value: '32mm', label: '32mm', description: 'Higher flow rate — farm or commercial.', recommended: true },
          ],
        },
      ],
    },
    {
      id: 'optional_costs',
      title: 'Optional Costs',
      questions: [
        { id: 'include_mobilization',  type: 'toggle', title: 'Include rig mobilization cost',       defaultValue: true },
        { id: 'include_pump_test',     type: 'toggle', title: 'Include pump test & development',      defaultValue: true },
        { id: 'include_water_test',    type: 'toggle', title: 'Include water quality lab test',        defaultValue: false },
        { id: 'include_pump_install',  type: 'toggle', title: 'Include pump installation labour',     defaultValue: true },
      ],
    },
  ],
  calculateBOQ: calculateBoreholeBOQ,
};
