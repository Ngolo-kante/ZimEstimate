import type { QuestionFlow, Answers } from '../engine/types';
import { calculateBoreholeBOQ } from './calculations';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Check whether the user selected a specific work item for existing borehole. */
function needsWork(a: Answers, work: string): boolean {
  const w = a.existing_work_needed;
  return Array.isArray(w) && w.includes(work);
}

/** True when the project is a brand-new borehole. */
function isNew(a: Answers): boolean {
  return a.project_scope !== 'existing_borehole' && a.project_scope !== 'quick_service';
}

/** True when the user only needs a quick service (no drilling). */
function isQuickService(a: Answers): boolean {
  return a.project_scope === 'quick_service';
}

/** True when budget mode is selected. */
function isBudgetMode(a: Answers): boolean {
  return a.estimate_mode === 'budget';
}

// ─── Flow ────────────────────────────────────────────────────────────────────

export const boreholeFlow: QuestionFlow = {
  projectType: 'borehole',
  title: 'Borehole Drilling',
  description:
    'Get a guided estimate for drilling, casing, pump, and water system — or price up work on an existing borehole.',
  icon: 'CirclesThree',
  estimatedMinutes: 5,
  steps: [
    // ═══════════════════════════════════════════════════════════════════════
    // Step 1 — Estimate Mode
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'estimate_mode',
      title: 'How would you like to estimate?',
      subtitle:
        'Choose quick for a fast estimate with smart defaults, detailed for full control, or budget to see what fits your budget.',
      questions: [
        {
          id: 'estimate_mode',
          type: 'select',
          title: 'Estimate type',
          required: true,
          options: [
            {
              value: 'quick',
              label: 'Quick Estimate',
              description:
                'Answer a few basic questions — we handle the rest with smart defaults. Best if you\'re exploring costs.',
            },
            {
              value: 'detailed',
              label: 'Detailed Estimate',
              description:
                'Choose every specification — casing grade, pump type, services, and compliance. Best for planning a real project.',
            },
            {
              value: 'budget',
              label: 'Budget Explorer',
              description:
                'Enter your budget and see the best borehole package that fits — tank, pump, stand, casing, and depth.',
            },
          ],
        },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Step 2 — Budget Input (budget mode only)
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'budget_input',
      title: 'What\'s Your Budget?',
      subtitle:
        'Enter the total amount you\'d like to spend. We\'ll show you the best combination of drilling depth, casing, pump, and tank that fits.',
      condition: (a) => isBudgetMode(a),
      questions: [
        {
          id: 'budget_amount',
          type: 'number',
          title: 'Total budget',
          description: 'The maximum amount you want to spend on the full borehole project.',
          unit: 'USD',
          min: 500,
          max: 50000,
          step: 100,
          required: true,
        },
        {
          id: 'borehole_purpose',
          type: 'select',
          title: 'What is this borehole for?',
          required: true,
          options: [
            {
              value: 'domestic',
              label: 'Home use',
              description: 'Household water supply — drinking, cooking, cleaning, and garden.',
            },
            {
              value: 'agricultural',
              label: 'Farming & irrigation',
              description: 'Watering crops, livestock, or large-scale garden irrigation.',
            },
            {
              value: 'commercial',
              label: 'Business or community',
              description: 'Schools, lodges, factories, churches, or commercial properties.',
            },
          ],
        },
        {
          id: 'project_location',
          type: 'select',
          layout: 'dropdown',
          title: 'Where is the project?',
          required: true,
          options: [
            { value: 'harare', label: 'Harare' },
            { value: 'bulawayo', label: 'Bulawayo' },
            { value: 'chitungwiza', label: 'Chitungwiza' },
            { value: 'mutare', label: 'Mutare' },
            { value: 'gweru', label: 'Gweru' },
            { value: 'masvingo', label: 'Masvingo' },
            { value: 'kwekwe', label: 'Kwekwe' },
            { value: 'kadoma', label: 'Kadoma' },
            { value: 'chinhoyi', label: 'Chinhoyi' },
            { value: 'marondera', label: 'Marondera' },
            { value: 'other', label: 'Other / not listed' },
          ],
        },
        {
          id: 'area_type',
          type: 'select',
          title: 'What type of area is the site?',
          required: true,
          options: [
            {
              value: 'urban',
              label: 'Urban',
              description: 'City or town centre with good road access.',
            },
            {
              value: 'peri_urban',
              label: 'Peri-urban',
              description: 'On the outskirts of town — mostly accessible.',
            },
            {
              value: 'rural',
              label: 'Rural',
              description: 'Countryside or farmland — may need off-road transport.',
            },
          ],
        },
        {
          id: 'budget_depth',
          type: 'number',
          layout: 'slider',
          title: 'Preferred drilling depth',
          description: 'Most boreholes in Zimbabwe are 40 m. Slide to adjust — we\'ll fit everything within your budget.',
          unit: 'm',
          min: 20,
          max: 160,
          step: 5,
          defaultValue: 40,
          required: true,
          recommendation: (a) => {
            const depth = parseInt(a.budget_depth as string) || 40;
            if (depth < 40)
              return '⚠️ Drilling less than 40 m is risky — you may not reach a reliable water source. Most contractors include 40 m in their base package.';
            if (depth > 100)
              return 'Very deep boreholes (100 m+) require larger pumps and more casing, which significantly increases cost.';
            return 'The standard drilling package in Zimbabwe starts at 40 m. This is sufficient for most residential areas.';
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Step 3 — Project Basics (non-budget modes)
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'project_basics',
      title: 'About Your Project',
      subtitle:
        'Let\'s start with the basics so we can tailor costs, recommendations, and compliance to your needs.',
      condition: (a) => !isBudgetMode(a),
      questions: [
        {
          id: 'project_name',
          type: 'text',
          title: 'Project name',
          placeholder: 'e.g. "My Home Borehole" or "Farm Well — Plot 12"',
          required: true,
        },
        // ── New or existing? ──────────────────────────────────────────────
        {
          id: 'project_scope',
          type: 'select',
          title: 'What kind of work do you need?',
          required: true,
          options: [
            {
              value: 'new_borehole',
              label: 'New borehole',
              description: 'Start from scratch — drilling, casing, pump, and everything else.',
            },
            {
              value: 'existing_borehole',
              label: 'Work on an existing borehole',
              description:
                'Additional drilling, casing replacement, pump upgrade, or maintenance on a borehole you already have.',
            },
            {
              value: 'quick_service',
              label: 'Quick service only',
              description:
                'Borehole flushing, water testing, pump retrieval, or other servicing — no drilling or casing work.',
            },
          ],
        },
        // ── Quick service selection ─────────────────────────────────────
        {
          id: 'quick_service_type',
          type: 'multi-select',
          title: 'What services do you need?',
          description: 'Select all that apply.',
          condition: (a) => isQuickService(a),
          required: true,
          options: [
            {
              value: 'flushing',
              label: 'Borehole flushing',
              description: 'Clear out mud, sand, and debris for clean water flow.',
            },
            {
              value: 'yield_test',
              label: 'Water yield test',
              description: 'Measure how much water your borehole produces per hour.',
            },
            {
              value: 'water_test_basic',
              label: 'Water quality test (bacteria)',
              description: 'Check for harmful bacteria — recommended for drinking water.',
            },
            {
              value: 'water_test_full',
              label: 'Full water analysis',
              description: 'Bacteria + chemical analysis — required for commercial use.',
            },
            {
              value: 'pump_retrieval',
              label: 'Pump retrieval',
              description: 'Professional removal of a stuck or dropped pump.',
            },
            {
              value: 'purification',
              label: 'Water purification system',
              description: 'Install a basic purification unit for safe drinking water.',
            },
          ],
        },
        // ── What work is needed? (existing only) ─────────────────────────
        {
          id: 'existing_work_needed',
          type: 'multi-select',
          title: 'What work do you need done?',
          description: 'Select all that apply — we\'ll build a combined estimate.',
          condition: (a) => a.project_scope === 'existing_borehole',
          required: true,
          options: [
            {
              value: 'additional_drilling',
              label: 'Deepen the borehole',
              description: 'Drill additional metres to reach deeper water.',
            },
            {
              value: 'casing_replacement',
              label: 'Replace or repair casing',
              description: 'Remove old casing and install new casing.',
            },
            {
              value: 'pump_replacement',
              label: 'Replace or upgrade pump',
              description: 'Swap out an old, broken, or undersized pump.',
            },
            {
              value: 'tank_addition',
              label: 'Add or replace water tank',
              description: 'Install a new tank and stand, or replace an existing one.',
            },
            {
              value: 'pump_retrieval',
              label: 'Retrieve a stuck pump',
              description: 'Professional removal of a jammed or dropped pump from the borehole.',
            },
            {
              value: 'maintenance',
              label: 'Testing & maintenance',
              description: 'Flushing, water quality testing, yield testing, or general servicing.',
            },
          ],
        },
        // ── Purpose ──────────────────────────────────────────────────────
        {
          id: 'borehole_purpose',
          type: 'select',
          title: 'What is this borehole for?',
          required: true,
          options: [
            {
              value: 'domestic',
              label: 'Home use',
              description: 'Household water supply — drinking, cooking, cleaning, and garden.',
            },
            {
              value: 'agricultural',
              label: 'Farming & irrigation',
              description: 'Watering crops, livestock, or large-scale garden irrigation.',
            },
            {
              value: 'commercial',
              label: 'Business or community',
              description: 'Schools, lodges, factories, churches, or commercial properties.',
            },
          ],
        },
        // ── Location ─────────────────────────────────────────────────────
        {
          id: 'project_location',
          type: 'select',
          layout: 'dropdown',
          title: 'Where is the project?',
          required: true,
          options: [
            { value: 'harare', label: 'Harare' },
            { value: 'bulawayo', label: 'Bulawayo' },
            { value: 'chitungwiza', label: 'Chitungwiza' },
            { value: 'mutare', label: 'Mutare' },
            { value: 'gweru', label: 'Gweru' },
            { value: 'masvingo', label: 'Masvingo' },
            { value: 'kwekwe', label: 'Kwekwe' },
            { value: 'kadoma', label: 'Kadoma' },
            { value: 'chinhoyi', label: 'Chinhoyi' },
            { value: 'marondera', label: 'Marondera' },
            { value: 'other', label: 'Other / not listed' },
          ],
          recommendation: () =>
            'Your location affects transport costs, drilling depth estimates, and council permit fees.',
        },
        // ── Area type ────────────────────────────────────────────────────
        {
          id: 'area_type',
          type: 'select',
          title: 'What type of area is the site?',
          required: true,
          options: [
            {
              value: 'urban',
              label: 'Urban',
              description: 'City or town centre with good road access.',
            },
            {
              value: 'peri_urban',
              label: 'Peri-urban',
              description: 'On the outskirts of town — mostly accessible.',
            },
            {
              value: 'rural',
              label: 'Rural',
              description: 'Countryside or farmland — may need off-road transport.',
            },
          ],
        },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Step 4 — Site Conditions  (new + detailed only)
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'site_conditions',
      title: 'Your Site',
      subtitle:
        'Understanding your ground and survey status helps us recommend the right equipment and flag extra costs. We\'ll cover permits in a later step.',
      condition: (a) => !isBudgetMode(a) && isNew(a) && !isQuickService(a) && a.estimate_mode === 'detailed',
      questions: [
        {
          id: 'site_survey_done',
          type: 'select',
          title: 'Has a professional site survey been done?',
          description:
            'A site survey locates the best drilling spot and checks for underground hazards like pipes, cables, or septic tanks.',
          required: true,
          options: [
            {
              value: 'yes',
              label: 'Yes, survey completed',
              description: 'A professional has already identified the drilling point.',
            },
            {
              value: 'no',
              label: 'Not yet',
              description: 'We\'ll include a site survey cost in your estimate.',
              recommended: true,
            },
            {
              value: 'not_sure',
              label: 'Not sure',
              description: 'We\'ll recommend including one — you can remove it later.',
            },
          ],
        },
        {
          id: 'ground_conditions',
          type: 'select',
          title: 'What are the ground conditions?',
          description:
            'This affects drilling difficulty and whether extra protection is needed for the borehole walls.',
          required: true,
          options: [
            {
              value: 'not_sure',
              label: 'Not sure',
              description: 'We\'ll use conservative estimates to protect your budget.',
            },
            {
              value: 'rocky',
              label: 'Rocky or hard ground',
              description: 'Solid rock — standard drilling, stable borehole walls.',
            },
            {
              value: 'mixed',
              label: 'Mixed soil and rock',
              description: 'Combination of soil layers — most common in Zimbabwe.',
            },
            {
              value: 'sandy',
              label: 'Sandy or loose soil',
              description:
                'Unstable ground — may need special drilling fluid or extra casing.',
            },
          ],
          recommendation: (a) => {
            if (a.ground_conditions === 'sandy')
              return 'Sandy soil usually requires mud drilling or double casing, which adds to the cost. We\'ll include these automatically. Important: your borehole must be at least 30 metres from any toilet pit, septic tank, or animal pen to prevent contamination.';
            if (a.ground_conditions === 'rocky' || a.ground_conditions === 'mixed')
              return 'Make sure the drilling site is at least 30 metres away from septic tanks, toilet pits, graveyards, or animal pens to protect your water quality.';
            return null;
          },
        },
        {
          id: 'has_permits',
          type: 'select',
          title: 'Do you have the required drilling permits?',
          description:
            'In Zimbabwe, you need a ZINWA permit (Form GW1) and local council approval before drilling. Drilling without permits can result in a $150 fine per visit.',
          required: true,
          options: [
            {
              value: 'no',
              label: 'No, not yet',
              description: 'We\'ll include permit costs in your estimate.',
            },
            {
              value: 'yes',
              label: 'Yes, permits sorted',
              description: 'We\'ll skip permit costs in your estimate.',
            },
            {
              value: 'not_sure',
              label: 'Not sure',
              description: 'We\'ll include them just in case — you can remove them later.',
            },
          ],
          recommendation: () =>
            'To apply you\'ll need: a site survey report, proof of land ownership (title deed or utility bill), a national ID, and the ZINWA application fee (~$60).',
        },
        // ── Site distance (optional for mobilization calc) ──────────────
        {
          id: 'site_distance_km',
          type: 'number',
          title: 'How far is the site from the nearest town?',
          description:
            'Helps calculate transport costs accurately. Leave empty or use "Not sure" for an automatic estimate based on your area type.',
          unit: 'km',
          min: 0,
          max: 500,
          notSureOption: true,
          notSureFollowUp: [
            {
              id: 'site_distance_km',
              type: 'number',
              title: 'We\'ll estimate based on your area type',
              unit: 'km',
              defaultValue: 0,
            },
          ],
        },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Step 5 — Drilling Depth
    //   New borehole  → full depth
    //   Existing      → additional metres  (only if selected)
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'drilling',
      title: 'Drilling Depth',
      subtitle:
        'The depth of your borehole is the biggest factor in cost. Don\'t worry if you\'re not sure — we\'ll estimate based on your area.',
      condition: (a) => !isBudgetMode(a) && !isQuickService(a) && (isNew(a) || needsWork(a, 'additional_drilling')),
      questions: [
        // ── New borehole: full depth ─────────────────────────────────────
        {
          id: 'drilling_depth',
          type: 'number',
          title: 'Expected drilling depth',
          unit: 'm',
          min: 10,
          max: 200,
          required: true,
          condition: (a) => isNew(a),
          notSureOption: true,
          notSureFollowUp: [
            {
              id: 'drilling_depth',
              type: 'number',
              title: 'Estimated depth for your area (you can adjust this)',
              unit: 'm',
              defaultValue: 50,
            },
          ],
          recommendation: (a) => {
            const loc = a.project_location as string;
            const area = a.area_type as string;
            const tips: Record<string, string> = {
              harare: 'Harare typically needs 40\u201360 m.',
              bulawayo: 'Bulawayo usually requires 50\u201380 m.',
              chitungwiza: 'Chitungwiza is similar to Harare \u2014 40\u201360 m.',
              mutare: 'Mutare area typically needs 40\u201360 m.',
              gweru: 'Gweru area usually requires 50\u201370 m.',
              masvingo: 'Masvingo area typically needs 50\u201370 m.',
            };
            let tip = tips[loc] || 'Most Zimbabwe properties need 40\u201380 m depth.';
            if (area === 'rural') tip += ' Rural areas can sometimes exceed 100 m.';
            tip += ' Note: final depth depends on the hydrogeologist\u2019s report and actual ground conditions.';
            return tip;
          },
        },
        // ── Existing borehole: additional metres ─────────────────────────
        {
          id: 'additional_metres',
          type: 'number',
          title: 'How many additional metres do you need drilled?',
          description:
            'This is the extra depth beyond the current borehole. Mobilization costs will be included automatically.',
          unit: 'm',
          min: 5,
          max: 100,
          defaultValue: 20,
          required: true,
          condition: (a) => !isNew(a) && needsWork(a, 'additional_drilling'),
          recommendation: () =>
            'Typical deepening is 10\u201330 m. Your driller can advise on the exact depth once they inspect the existing borehole.',
        },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Step 6 — Casing
    //   New + detailed → full casing spec
    //   Existing + casing_replacement → replacement spec
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'casing',
      title: 'Casing',
      subtitle:
        'Casing lines the inside of your borehole to prevent collapse and keep the water clean. The top 10\u201320 metres are critical for sealing out surface contamination.',
      condition: (a) =>
        !isBudgetMode(a) &&
        !isQuickService(a) &&
        ((isNew(a) && a.estimate_mode === 'detailed') ||
        (a.project_scope === 'existing_borehole' && needsWork(a, 'casing_replacement'))),
      questions: [
        // ── Length to replace (existing only) ─────────────────────────────
        {
          id: 'casing_replacement_length',
          type: 'number',
          title: 'Length of casing to replace',
          description:
            'How many metres of casing need replacing? Enter the full depth if doing a complete swap.',
          unit: 'm',
          min: 5,
          max: 200,
          defaultValue: 40,
          required: true,
          condition: (a) => !isNew(a) && needsWork(a, 'casing_replacement'),
        },
        {
          id: 'casing_material',
          type: 'select',
          title: 'Casing material',
          required: true,
          options: [
            {
              value: 'upvc',
              label: 'PVC casing',
              description:
                'Most popular — lightweight, corrosion-resistant, and cost-effective.',
              recommended: true,
            },
            {
              value: 'steel',
              label: 'Steel casing',
              description:
                'Stronger but heavier and more expensive. Best for very deep (>80 m) or rocky boreholes.',
            },
          ],
        },
        {
          id: 'casing_class',
          type: 'select',
          title: 'Casing grade',
          condition: (a) => a.casing_material === 'upvc',
          required: true,
          options: [
            {
              value: 'class_6',
              label: 'Standard (Class 6)',
              description: 'Suitable for most residential boreholes in stable soil. Pressure rating: 6 Bar.',
              recommended: true,
            },
            {
              value: 'class_9',
              label: 'Mid-grade (Class 9)',
              description:
                'Good balance of durability and cost — suitable for moderate depths and mixed soil. Pressure rating: 9 Bar.',
            },
            {
              value: 'class_10',
              label: 'Premium (Class 10)',
              description:
                'Highest pressure rating (10 Bar) — recommended for deep boreholes (>60 m) or rocky terrain.',
            },
          ],
          recommendation: (a) => {
            const depth =
              parseInt(a.drilling_depth as string) ||
              parseInt(a.casing_replacement_length as string) ||
              50;
            const ground = a.ground_conditions as string;
            if (depth > 60 || ground === 'rocky')
              return 'For depths over 60 m or rocky ground, we recommend Class 9 or Class 10 casing for better durability and pressure resistance.';
            return null;
          },
        },
        {
          id: 'casing_diameter',
          type: 'select',
          title: 'Casing diameter',
          required: true,
          options: [
            {
              value: '140mm',
              label: '140 mm',
              description: 'Standard size for home use — fits most domestic pumps.',
            },
            {
              value: '180mm',
              label: '180 mm',
              description: 'Wider bore — higher water yield for farming or commercial use.',
            },
          ],
          recommendation: (a) => {
            const purpose = a.borehole_purpose as string;
            if (purpose === 'agricultural' || purpose === 'commercial')
              return 'For farming or commercial use, 180 mm provides higher water yield.';
            return '140 mm is usually sufficient and more cost-effective for home use.';
          },
        },
        {
          id: 'double_casing',
          type: 'toggle',
          title: 'Add double casing for the top section',
          description:
            'Adds an extra layer of protection for the top 6\u201320 metres. Recommended for sandy or loose soil.',
          defaultValue: false,
          condition: (a) =>
            isNew(a) &&
            (a.ground_conditions === 'sandy' || a.ground_conditions === 'mixed'),
          recommendation: (a) => {
            if (a.ground_conditions === 'sandy')
              return 'Your site has sandy soil — double casing is strongly recommended to prevent collapse. The top section should be widened to 300mm for a proper sanitary seal.';
            return null;
          },
        },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Step 7 — Water System
    //   New                          → full system choice
    //   Existing + pump/tank work    → pump or tank selection
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'water_system',
      title: 'Your Water System',
      subtitle:
        'Tell us what you need — just the borehole, or a complete system with pump, tank, and stand.',
      condition: (a) =>
        !isBudgetMode(a) &&
        !isQuickService(a) &&
        (isNew(a) ||
        needsWork(a, 'pump_replacement') ||
        needsWork(a, 'tank_addition')),
      questions: [
        // ── System scope (new only) ──────────────────────────────────────
        {
          id: 'system_scope',
          type: 'select',
          title: 'What do you need?',
          required: true,
          condition: (a) => isNew(a),
          options: [
            {
              value: 'drilling_only',
              label: 'Borehole drilling only',
              description:
                'Just the hole and casing — I\'ll sort the pump and tank separately.',
            },
            {
              value: 'drilling_and_pump',
              label: 'Borehole + pump',
              description:
                'Drilling plus a pump to extract water. I already have a tank or don\'t need one yet.',
            },
            {
              value: 'complete_system',
              label: 'Complete system',
              description:
                'Everything — drilling, pump, water tank, and stand. Ready to use.',
              recommended: true,
            },
          ],
        },

        // ── Existing borehole depth (needed for pump sizing) ─────────────
        {
          id: 'existing_borehole_depth',
          type: 'number',
          title: 'What is the current depth of your borehole?',
          description: 'This helps us recommend the right pump size. An estimate is fine.',
          unit: 'm',
          min: 10,
          max: 200,
          defaultValue: 50,
          required: true,
          condition: (a) => !isNew(a) && needsWork(a, 'pump_replacement'),
        },

        // ── Pump power source ────────────────────────────────────────────
        {
          id: 'pump_power_source',
          type: 'select',
          title: 'How do you want to power the pump?',
          condition: (a) => {
            if (!isNew(a)) return needsWork(a, 'pump_replacement');
            return a.system_scope !== 'drilling_only';
          },
          required: true,
          options: [
            {
              value: 'solar',
              label: 'Solar powered',
              description:
                'No electricity bills, works during load shedding. Includes panels, controller, and pump.',
              recommended: true,
            },
            {
              value: 'hybrid',
              label: 'Hybrid (Solar + Grid)',
              description:
                'Automatically switches between solar and ZESA grid power. Best of both worlds — higher upfront cost but maximum reliability.',
            },
            {
              value: 'electric',
              label: 'Electric (ZESA grid)',
              description:
                'Lower upfront cost but depends on grid power and has ongoing electricity bills.',
            },
            {
              value: 'hand',
              label: 'Hand pump (Afridev)',
              description:
                'Manual operation — no electricity needed. Common in rural areas and community boreholes.',
            },
          ],
          recommendation: (a) => {
            const purpose = a.borehole_purpose as string;
            if (purpose === 'commercial')
              return 'For commercial use, hybrid (AC/DC) systems provide maximum uptime — solar during the day, grid power at night or on cloudy days.';
            return 'Solar is the most popular choice in Zimbabwe — it eliminates electricity costs and works during power outages. Solar array should be 1.3\u20131.5\u00D7 the pump wattage for best performance.';
          },
        },

        // ── Tank capacity ────────────────────────────────────────────────
        {
          id: 'tank_capacity',
          type: 'select',
          title: 'Water storage tank size',
          condition: (a) => {
            if (!isNew(a)) return needsWork(a, 'tank_addition');
            return a.system_scope === 'complete_system';
          },
          required: true,
          options: [
            {
              value: '2000',
              label: '2,000 litres',
              description: 'Compact — suitable for a very small household (1\u20132 people).',
            },
            {
              value: '2500',
              label: '2,500 litres',
              description: 'Good for a small household (2\u20134 people).',
            },
            {
              value: '5000',
              label: '5,000 litres',
              description: 'Suitable for a medium household or small garden.',
              recommended: true,
            },
            {
              value: '10000',
              label: '10,000 litres',
              description: 'Best for large households, farming, or commercial use.',
            },
          ],
          recommendation: (a) => {
            const purpose = a.borehole_purpose as string;
            if (purpose === 'agricultural')
              return 'For farming, we recommend at least 5,000 L. Consider 10,000 L if irrigating crops.';
            if (purpose === 'commercial')
              return 'For commercial use, 10,000 L provides the best buffer for continuous supply.';
            return 'For a typical household, 5,000 L covers daily needs with some reserve.';
          },
        },

        // ── Tank stand ───────────────────────────────────────────────────
        {
          id: 'include_tank_stand',
          type: 'select',
          title: 'Do you need a steel tank stand?',
          description:
            'An elevated stand provides gravity-fed water pressure to your building.',
          condition: (a) => {
            if (!isNew(a)) return needsWork(a, 'tank_addition');
            return a.system_scope === 'complete_system';
          },
          required: true,
          options: [
            {
              value: 'combo',
              label: 'Yes \u2014 bundled with tank (saves ~$200)',
              description: 'Tank + stand package deal at discounted rate. Most popular with contractors.',
              recommended: true,
            },
            {
              value: 'standard',
              label: 'Yes \u2014 standard height (separate)',
              description: '4 m for most tanks, 5 m for 10,000 L. Priced separately.',
            },
            {
              value: 'custom',
              label: 'Yes \u2014 custom height',
              description: 'I know the exact height I need.',
            },
            {
              value: 'no',
              label: 'No stand needed',
              description: 'I\u2019ll place the tank on the ground or have my own stand.',
            },
          ],
        },
        {
          id: 'tank_stand_height',
          type: 'number',
          title: 'Stand height',
          description: 'Standard is 4\u20135 m. Taller stands give more water pressure.',
          unit: 'm',
          min: 2,
          max: 10,
          defaultValue: 4,
          required: true,
          condition: (a) => a.include_tank_stand === 'custom',
        },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Step 8 — Site Security (detailed mode, new + solar/hybrid)
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'site_security',
      title: 'Site Security',
      subtitle:
        'Protect your investment. Equipment theft is a common concern — these add-ons help secure your borehole system.',
      condition: (a) =>
        !isBudgetMode(a) &&
        !isQuickService(a) &&
        a.estimate_mode === 'detailed' &&
        (isNew(a) || needsWork(a, 'pump_replacement')) &&
        (a.pump_power_source === 'solar' || a.pump_power_source === 'hybrid'),
      questions: [
        {
          id: 'include_antitheft_brackets',
          type: 'toggle',
          title: 'Anti-theft brackets for solar panels',
          description:
            'Tamper-proof bolts and brackets to secure solar panels to the mounting frame. ~$1 per bracket.',
          defaultValue: true,
        },
        {
          id: 'antitheft_bracket_qty',
          type: 'number',
          title: 'Number of brackets needed',
          description: 'Typically 4\u20138 brackets per installation depending on panel count.',
          unit: 'pcs',
          min: 1,
          max: 20,
          defaultValue: 6,
          condition: (a) => Boolean(a.include_antitheft_brackets),
        },
        {
          id: 'include_security_cage',
          type: 'toggle',
          title: 'Security cage for pump/inverter/battery',
          description:
            'A high-strength steel cage custom-fabricated to protect your solar inverter, battery, and pump controller from theft and vandalism.',
          defaultValue: false,
        },
        {
          id: 'security_cage_cost',
          type: 'number',
          title: 'Security cage cost',
          description: 'Enter the quoted price if you have one, or use our estimate of $350.',
          unit: 'USD',
          min: 100,
          max: 2000,
          defaultValue: 350,
          condition: (a) => Boolean(a.include_security_cage),
        },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Step 9 — Services & Compliance
    //   New + detailed                → full service toggles
    //   Existing + maintenance        → service toggles
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'services',
      title: 'Services & Compliance',
      subtitle:
        'These ensure your borehole is legal, safe, and fully operational. We recommend including all essentials — you can toggle any off.',
      condition: (a) =>
        !isBudgetMode(a) &&
        !isQuickService(a) &&
        ((isNew(a) && a.estimate_mode === 'detailed') ||
        (a.project_scope === 'existing_borehole' && needsWork(a, 'maintenance'))),
      questions: [
        {
          id: 'include_site_survey',
          type: 'toggle',
          title: 'Site survey',
          description:
            'A professional locates the best drilling spot and checks for underground hazards.',
          condition: (a) => isNew(a) && a.site_survey_done !== 'yes',
          defaultValue: true,
        },
        {
          id: 'include_flushing',
          type: 'toggle',
          title: 'Borehole flushing',
          description:
            'Clears mud, sand, and drilling debris. Essential for clean water after any drilling or maintenance work.',
          defaultValue: true,
        },
        {
          id: 'include_yield_test',
          type: 'toggle',
          title: 'Water yield test',
          description:
            'Measures how much water your borehole produces per hour. Helps size your pump correctly.',
          defaultValue: true,
          recommendation: () =>
            'Yield testing is mandatory for ZINWA compliance and helps ensure your pump is correctly sized. Cost: $250 flat fee.',
        },
        {
          id: 'water_quality_level',
          type: 'select',
          title: 'Water quality testing',
          description:
            'Lab analysis to check if the water is safe for use. Required for commercial properties.',
          required: true,
          options: [
            {
              value: 'none',
              label: 'Skip for now',
              description: 'You can always test the water later.',
            },
            {
              value: 'basic',
              label: 'Basic (bacteria check) — $25',
              description: 'Tests for harmful bacteria — recommended for drinking water.',
            },
            {
              value: 'full',
              label: 'Full analysis — $80',
              description:
                'Bacteria ($25) + chemical analysis ($55) — required for commercial use or schools.',
              recommended: true,
            },
          ],
          recommendation: (a) => {
            const purpose = a.borehole_purpose as string;
            if (purpose === 'commercial')
              return 'Commercial and community boreholes must have full water quality analysis for health certification.';
            if (purpose === 'domestic')
              return 'We recommend at least a basic test to confirm the water is safe for your family.';
            return null;
          },
        },
        {
          id: 'include_zinwa_permit',
          type: 'toggle',
          title: 'ZINWA drilling permit (Form GW1) — $60',
          description:
            'Required by law before drilling. This is a non-negotiable requirement for all new boreholes in Zimbabwe.',
          condition: (a) => isNew(a) && a.has_permits !== 'yes',
          defaultValue: true,
          recommendation: () =>
            'Drilling without a ZINWA permit is illegal and can result in a $150 fine per visit. Penalties for unauthorised drilling can reach up to $2,000.',
        },
        {
          id: 'include_council_fee',
          type: 'toggle',
          title: 'Local council approval fee',
          description: 'Application fee required by your local municipality before drilling.',
          condition: (a) => isNew(a) && a.has_permits !== 'yes',
          defaultValue: true,
        },
        {
          id: 'include_mobilization',
          type: 'toggle',
          title: 'Drilling rig transport',
          description:
            'Cost to bring the drilling rig to your site. Varies by distance from the depot.',
          condition: (a) => isNew(a),
          defaultValue: true,
        },
        {
          id: 'include_pump_install',
          type: 'toggle',
          title: 'Pump installation labour',
          description: 'Professional installation of your pump system. Important: the pump must never be placed inside the well screen to avoid erosion damage.',
          condition: (a) => {
            if (!isNew(a)) return false; // existing path handles this automatically
            return a.system_scope !== 'drilling_only';
          },
          defaultValue: true,
        },
        {
          id: 'include_purification',
          type: 'toggle',
          title: 'Water purification system',
          description:
            'Basic purification unit for safe drinking water — recommended for schools, lodges, and businesses.',
          condition: (a) => a.borehole_purpose === 'commercial',
          defaultValue: false,
        },
      ],
    },
  ],
  calculateBOQ: calculateBoreholeBOQ,
};
