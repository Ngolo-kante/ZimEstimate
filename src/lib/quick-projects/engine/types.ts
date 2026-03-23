// ─── Generic Question Engine Types ────────────────────────────────────────────
// Declarative config system: define a QuestionFlow → the wizard renders it.
// Each project type (septic, solar, water, borehole, fencing, paving) is a
// QuestionFlow config file — no custom wizard UI per type.

export type ProjectType =
  | 'septic'
  | 'solar'
  | 'water'
  | 'borehole'
  | 'fencing'
  | 'paving';

export type Answers = Record<string, unknown>;

// ─── Question ─────────────────────────────────────────────────────────────────

export type QuestionType =
  | 'select'
  | 'multi-select'
  | 'number'
  | 'toggle'
  | 'text'
  | 'brand-picker'
  | 'checklist'
  | 'dimension'; // L × W × H inputs

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  recommended?: boolean;
  icon?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  unit?: string;                          // shown next to number inputs ("m", "L", etc.)
  placeholder?: string;
  notSureOption?: boolean;                // appends a "Not sure" option
  notSureFollowUp?: Question[];           // shown only when "not sure" is selected
  options?: QuestionOption[];
  min?: number;
  max?: number;
  step?: number;
  condition?: (answers: Answers) => boolean;  // hide question when false
  recommendation?: (answers: Answers) => string | null; // contextual tip
  defaultValue?: unknown;
  required?: boolean;
  layout?: 'cards' | 'dropdown' | 'slider';  // select: cards/dropdown; number: slider
}

// ─── Step ─────────────────────────────────────────────────────────────────────

export interface WizardStep {
  id: string;
  title: string;
  subtitle?: string;
  questions: Question[];
  condition?: (answers: Answers) => boolean; // hide entire step when false
}

// ─── BOQ Item ─────────────────────────────────────────────────────────────────

export interface BOQItem {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitCostUsd: number;
  totalCostUsd: number;
  included: boolean;   // user can toggle off (optional items)
  owned: boolean;      // user already owns → excluded from cost, shown greyed
  optional: boolean;   // labelled as optional (transport, contingency, etc.)
  brand?: string;
  notes?: string;
}

// ─── Labor ────────────────────────────────────────────────────────────────────

export type LaborMethod = 'daily_rate' | 'percentage';

export interface LaborConfig {
  enabled: boolean;
  method: LaborMethod;
  dailyRateUsd?: number;   // cost per builder per day
  days?: number;           // estimated working days
  percentage?: number;     // % of materials total (0–100)
  workerCount?: number;    // number of builders (for daily_rate method)
}

// ─── Question Flow ─────────────────────────────────────────────────────────────

export interface QuestionFlow {
  projectType: ProjectType;
  title: string;
  description: string;
  icon: string;           // phosphor icon name, e.g. 'Toilet'
  estimatedMinutes: number;
  steps: WizardStep[];
  calculateBOQ: (answers: Answers) => BOQItem[];
}

// ─── Wizard State ─────────────────────────────────────────────────────────────

export interface WizardState {
  answers: Answers;
  notSureIds: Set<string>;   // question ids where user chose "not sure"
  currentStepIndex: number;
  completed: boolean;
}

// ─── Quick BOQ (persisted record) ─────────────────────────────────────────────

export interface QuickBOQ {
  id: string;
  userId?: string;
  projectId?: string;         // optional link to a project
  projectType: ProjectType;
  answers: Answers;
  boqItems: BOQItem[];
  labor: LaborConfig;
  markupPct: number;
  currency: 'USD' | 'ZWG';
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function makeItem(
  id: string,
  category: string,
  description: string,
  quantity: number,
  unit: string,
  unitCostUsd: number,
  opts: { optional?: boolean; owned?: boolean; brand?: string; notes?: string } = {}
): BOQItem {
  return {
    id,
    category,
    description,
    quantity: Math.max(0, quantity),
    unit,
    unitCostUsd,
    totalCostUsd: Math.max(0, quantity) * unitCostUsd,
    included: !opts.owned,
    owned: opts.owned ?? false,
    optional: opts.optional ?? false,
    brand: opts.brand,
    notes: opts.notes,
  };
}
