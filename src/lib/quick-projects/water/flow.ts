import type { QuestionFlow } from '../engine/types';
import { calculateWaterBOQ } from './calculations';

export const waterFlow: QuestionFlow = {
  projectType: 'water',
  title: 'Water Tank',
  description: 'Size and price your water tank installation — tank, stand, pump, and connections.',
  icon: 'Drop',
  estimatedMinutes: 5,

  steps: [
    {
      id: 'scope',
      title: 'What do you need?',
      subtitle: 'Select all components you want to install.',
      questions: [
        {
          id: 'scope',
          type: 'select',
          title: 'Installation scope',
          required: true,
          options: [
            { value: 'tank_only',      label: 'Tank + stand only',              description: 'Supply and stand with basic connections.' },
            { value: 'tank_pump',      label: 'Tank + borehole pump',           description: 'Includes submersible/surface pump and rising main.', recommended: true },
            { value: 'tank_mains',     label: 'Tank + municipal connection',     description: 'Includes mains pipe, ball valve, and float valve.' },
            { value: 'tank_pump_mains',label: 'Tank + pump + mains connection', description: 'Full installation with both borehole pump and mains backup.' },
          ],
        },
        {
          id: 'owns_tank',
          type: 'toggle',
          title: 'I already own a tank',
          description: 'Owned tanks are excluded from the BOQ cost.',
          defaultValue: false,
        },
      ],
    },
    {
      id: 'tank_size',
      title: 'Tank Size',
      condition: (a) => a.owns_tank !== true,
      questions: [
        {
          id: 'tank_size',
          type: 'select',
          title: 'Tank capacity',
          required: true,
          notSureOption: true,
          notSureFollowUp: [
            {
              id: 'household_size',
              type: 'number',
              title: 'How many people in the household?',
              unit: 'people',
              min: 1, max: 50,
              defaultValue: 5,
              required: true,
            },
            {
              id: 'daily_usage',
              type: 'select',
              title: 'Water usage level',
              options: [
                { value: 'low',      label: 'Low (80L/person/day)',      description: 'Basic needs only.' },
                { value: 'moderate', label: 'Moderate (100L/person/day)',description: 'Typical household.', recommended: true },
                { value: 'high',     label: 'High (150L/person/day)',    description: 'Garden irrigation, livestock, etc.' },
              ],
            },
          ],
          options: [
            { value: '1000',  label: '1 000 L',  description: '~2 people, 5-day supply' },
            { value: '2500',  label: '2 500 L',  description: '~5 people, 5-day supply', recommended: true },
            { value: '5000',  label: '5 000 L',  description: '~8–10 people, 5-day supply' },
            { value: '10000', label: '10 000 L', description: 'Large household / farm' },
          ],
        },
      ],
    },
    {
      id: 'brand',
      title: 'Tank Brand',
      condition: (a) => a.owns_tank !== true,
      questions: [
        {
          id: 'tank_brand',
          type: 'select',
          title: 'Preferred tank brand',
          required: true,
          options: [
            { value: 'jojo',       label: 'Jojo (recommended)',     description: 'Most widely available in Zimbabwe. Good warranty.', recommended: true },
            { value: 'graniteside',label: 'Graniteside',            description: 'Local brand, slightly lower cost.' },
            { value: 'dal',        label: 'Dal Tank',               description: 'Local Harare manufacturer.' },
            { value: 'cheapest',   label: 'Cheapest available',     description: 'We\'ll price at lowest-cost equivalent.' },
            { value: 'no_pref',    label: 'No preference',          description: 'Default to Jojo pricing.' },
          ],
        },
      ],
    },
    {
      id: 'stand',
      title: 'Tank Stand',
      questions: [
        {
          id: 'stand_type',
          type: 'select',
          title: 'Stand type',
          required: true,
          options: [
            { value: 'steel_12', label: 'Steel stand 1.2m',   description: 'Low stand — gravity feed only short distances.' },
            { value: 'steel_18', label: 'Steel stand 1.8m',   description: 'Standard height — good gravity pressure.', recommended: true },
            { value: 'steel_24', label: 'Steel stand 2.4m',   description: 'High stand — better gravity pressure for large properties.' },
            { value: 'brick',    label: 'Brick plinth',       description: 'Masonry plinth — lower cost, permanent.' },
            { value: 'concrete', label: 'Concrete plinth',    description: 'Cast in-situ concrete pad.' },
          ],
          defaultValue: 'steel_18',
        },
        {
          id: 'owns_stand',
          type: 'toggle',
          title: 'I already have a stand',
          defaultValue: false,
        },
      ],
    },
    {
      id: 'pump',
      title: 'Borehole Pump',
      condition: (a) => a.scope === 'tank_pump' || a.scope === 'tank_pump_mains',
      questions: [
        {
          id: 'pump_type',
          type: 'select',
          title: 'Pump type',
          required: true,
          options: [
            { value: 'submersible', label: 'Submersible pump', description: 'Installed inside borehole. Handles greater depth.', recommended: true },
            { value: 'surface',     label: 'Surface pump',     description: 'Above-ground. Suitable for shallow boreholes (<7m).' },
          ],
        },
        {
          id: 'borehole_depth',
          type: 'number',
          title: 'Borehole depth',
          unit: 'm',
          min: 5, max: 200,
          defaultValue: 40,
          notSureOption: true,
          notSureFollowUp: [{ id: 'borehole_depth', type: 'number', title: 'Use our estimate (40m)', unit: 'm', defaultValue: 40 }],
        },
        {
          id: 'owns_pump',
          type: 'toggle',
          title: 'I already own a pump',
          defaultValue: false,
        },
      ],
    },
    {
      id: 'mains',
      title: 'Municipal Connection',
      condition: (a) => a.scope === 'tank_mains' || a.scope === 'tank_pump_mains',
      questions: [
        {
          id: 'mains_pipe_run',
          type: 'number',
          title: 'Distance from mains supply to tank',
          unit: 'm',
          min: 1, max: 100,
          defaultValue: 5,
        },
      ],
    },
    {
      id: 'optional_costs',
      title: 'Optional Costs',
      questions: [
        {
          id: 'include_transport',
          type: 'toggle',
          title: 'Include delivery / transport cost',
          defaultValue: false,
        },
        {
          id: 'include_trench',
          type: 'toggle',
          title: 'Include pipe trench excavation',
          defaultValue: false,
        },
        {
          id: 'trench_length',
          type: 'number',
          title: 'Trench length',
          unit: 'm',
          min: 1,
          defaultValue: 20,
          condition: (a) => a.include_trench === true,
        },
      ],
    },
  ],

  calculateBOQ: calculateWaterBOQ,
};
