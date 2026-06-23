// ─── Septic Tank Question Flow ─────────────────────────────────────────────────
// Declarative config consumed by QuickProjectWizard.

import type { QuestionFlow } from '../engine/types';
import { calculateSepticBOQ } from './calculations';

export const septicFlow: QuestionFlow = {
  projectType: 'septic',
  title: 'Septic Tank',
  description: 'Build your full septic system BOQ — tank + soakaway + pipework.',
  icon: 'Toilet',
  estimatedMinutes: 5,

  steps: [
    // ── Step 1: Construction Method ──────────────────────────────────────────
    {
      id: 'method',
      title: 'Construction Method',
      subtitle: 'How do you want the tank built?',
      questions: [
        {
          id: 'construction_method',
          type: 'select',
          title: 'Tank construction type',
          description: 'Each method suits different budgets and locations.',
          required: true,
          options: [
            {
              value: 'brick',
              label: 'Brick-built in-situ',
              description: 'Built with clay bricks and mortar on-site. Most common in rural Zimbabwe. Lower material cost.',
              recommended: false,
            },
            {
              value: 'precast',
              label: 'Precast concrete rings',
              description: 'Concrete rings stacked and sealed. Faster installation. Common in urban/peri-urban areas.',
              recommended: false,
            },
            {
              value: 'poly',
              label: 'Poly / fibreglass tank',
              description: 'Factory-made plastic tank, lowered into excavation. Quickest but highest material cost.',
              recommended: false,
            },
          ],
          recommendation: () => {
            // Will be rendered from the parent wizard, using location context if available
            return null;
          },
        },
        {
          id: 'owns_tank',
          type: 'toggle',
          title: 'I already have a tank',
          description: "If you already have a septic tank, we'll only generate the soakaway and pipework BOQ.",
          defaultValue: false,
        },
      ],
    },

    // ── Step 2: Tank Size ────────────────────────────────────────────────────
    {
      id: 'size',
      title: 'Tank Size',
      subtitle: "We'll calculate the right volume for your household.",
      condition: (a) => a.owns_tank !== true,
      questions: [
        {
          id: 'tank_size_method',
          type: 'select',
          title: 'How would you like to specify the size?',
          required: true,
          options: [
            { value: 'calculate', label: 'Calculate from household size', description: "Tell us occupant count and bathrooms — we'll size it." },
            { value: 'custom',    label: 'Enter custom dimensions',        description: 'I know the exact length x width x height I want.' },
          ],
          notSureOption: true,
          notSureFollowUp: [
            {
              id: 'occupants',
              type: 'number',
              title: 'How many people use the facility?',
              unit: 'people',
              min: 1, max: 50,
              defaultValue: 5,
              required: true,
            },
            {
              id: 'bathrooms',
              type: 'number',
              title: 'How many bathrooms?',
              unit: 'bathrooms',
              min: 1, max: 10,
              defaultValue: 2,
              required: true,
            },
          ],
        },
        // Shown when calculate is selected
        {
          id: 'occupants',
          type: 'number',
          title: 'Number of occupants',
          unit: 'people',
          min: 1, max: 50,
          defaultValue: 5,
          required: true,
          condition: (a) => a.tank_size_method === 'calculate',
        },
        {
          id: 'bathrooms',
          type: 'number',
          title: 'Number of bathrooms',
          unit: 'bathrooms',
          min: 1, max: 10,
          defaultValue: 2,
          required: true,
          condition: (a) => a.tank_size_method === 'calculate',
        },
        // Shown when custom is selected
        {
          id: 'custom_length',
          type: 'number',
          title: 'Tank internal length',
          unit: 'm',
          min: 1, max: 6,
          step: 0.1,
          defaultValue: 2.4,
          required: true,
          condition: (a) => a.tank_size_method === 'custom',
        },
        {
          id: 'custom_width',
          type: 'number',
          title: 'Tank internal width',
          unit: 'm',
          min: 0.8, max: 4,
          step: 0.1,
          defaultValue: 1.5,
          required: true,
          condition: (a) => a.tank_size_method === 'custom',
        },
        {
          id: 'custom_height',
          type: 'number',
          title: 'Tank internal height / depth',
          unit: 'm',
          min: 0.8, max: 3,
          step: 0.1,
          defaultValue: 1.2,
          required: true,
          condition: (a) => a.tank_size_method === 'custom',
        },
      ],
    },

    // ── Step 3: Site Conditions ───────────────────────────────────────────────
    {
      id: 'site',
      title: 'Site Conditions',
      subtitle: 'Soil and water table affect soakaway design.',
      questions: [
        {
          id: 'soil_type',
          type: 'select',
          title: 'What is the soil type at the site?',
          notSureOption: true,
          options: [
            { value: 'sandy',  label: 'Sandy / loamy',  description: 'Good drainage. Standard soakaway sizing.' },
            { value: 'clay',   label: 'Clay / black cotton', description: 'Poor drainage. Larger soakaway needed. +20% material cost.' },
            { value: 'loam',   label: 'Loam',           description: 'Moderate drainage. Standard sizing.' },
            { value: 'rock',   label: 'Rock / gravelly', description: 'Blasting may be needed for excavation.' },
          ],
          recommendation: (a) => {
            if (a.soil_type === 'clay') return '⚠️ Clay soils need a larger soakaway pit. We\'ve added 20% extra stone.';
            if (a.soil_type === 'rock') return '⚠️ Rocky sites may require a TLB or compressor for excavation.';
            return null;
          },
        },
        {
          id: 'water_table',
          type: 'select',
          title: 'Water table depth',
          notSureOption: true,
          options: [
            { value: 'deep',   label: 'Deep (>3m)', description: 'No concern for soakaway.' },
            { value: 'shallow',label: 'Shallow (1–3m)', description: 'Soakaway design must keep 1m clearance.', recommended: false },
          ],
        },
      ],
    },

    // ── Step 4: Soakaway ──────────────────────────────────────────────────────
    {
      id: 'soakaway',
      title: 'Soakaway / Drainage',
      subtitle: 'How should the effluent be dispersed?',
      questions: [
        {
          id: 'soakaway_type',
          type: 'select',
          title: 'Soakaway type',
          required: true,
          options: [
            { value: 'stone_pit',    label: 'Stone-filled pit', description: 'Excavated pit filled with broken stone. Most common.', recommended: true },
            { value: 'french_drain', label: 'French drain / perforated pipe', description: 'Horizontal perforated pipe in stone trench. Better for tight sites.' },
          ],
        },
      ],
    },

    // ── Step 5: Existing Equipment ────────────────────────────────────────────
    {
      id: 'existing',
      title: 'Existing Equipment',
      subtitle: 'Tell us what you already have to exclude from the BOQ.',
      questions: [
        {
          id: 'include_machine_excav',
          type: 'toggle',
          title: 'Include TLB / machine excavation',
          description: 'Turn ON to add TLB hire as an optional cost line item.',
          defaultValue: false,
        },
        {
          id: 'include_transport',
          type: 'toggle',
          title: 'Include material delivery / transport',
          description: 'Add a transport cost line item to the BOQ.',
          defaultValue: false,
        },
      ],
    },
  ],

  calculateBOQ: calculateSepticBOQ,
};
