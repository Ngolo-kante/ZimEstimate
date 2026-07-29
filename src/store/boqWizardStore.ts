import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LOCATION_PROCEDURE_RULES, SoilType } from '@/lib/buildFlowRules';
import { calculateBoqHealth, type BoqHealthCategoryInput, type BoqHealthResult } from '@/lib/boqHealth';
import { STAGE_COMPLIANCE_REQUIREMENTS } from '@/lib/compliance';
import { BrickType, CementType } from '@/lib/vision/types';
import { DEFAULT_FINISH_LEVEL, type FinishLevel } from '@/lib/calculations';
import type { RoomInstance } from '@/app/boq/new/components/room-builder/types';

export type SiteSlopeType = 'flat' | 'gentle' | 'moderate' | 'steep';
export type CertificateStatus = 'pending' | 'in_progress' | 'done';
export type LaborPreference = 'materials_only' | 'materials_labor' | null;
export type ProjectScope = 'entire' | 'stage';

export const BOQ_MILESTONE_IDS = [
  'substructure',
  'superstructure',
  'roofing',
  'finishing',
  'exterior',
  'labor',
] as const;

export type BoqMilestoneId = (typeof BOQ_MILESTONE_IDS)[number];

export const DEFAULT_ROOM_INPUTS = {
  bedrooms: '',
  ensuiteBedrooms: '',
  bathrooms: '',
  guestToilet: '',
  livingRoom: '',
  diningRoom: '',
  kitchen: '',
  pantry: '',
  scullery: '',
  study: '',
  garage1: '',
  garage2: '',
  veranda: '',
  passage: '',
  storeRoom: '',
};

export type RoomInputKey = keyof typeof DEFAULT_ROOM_INPUTS;

export interface ProjectDetailsState {
  projectType: string;
  name: string;
  locationType: string;
  locationCity: string;
  specificLocation: string;
  soilType: SoilType | '';
  siteSlope: SiteSlopeType | '';
  floorPlanSize: string;
  standSize: string;
  buildingType: string;
  wallHeight: string;
  brickTypes: BrickType[];
  cementTypes: CementType[];
  finishLevel: FinishLevel;
  roomInputs: Record<RoomInputKey, string>;
}

export interface BOQItem {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number | null;
  unit: string;
  averagePriceUsd: number;
  averagePriceZwg: number;
  actualPriceUsd: number;
  actualPriceZwg: number;
  description?: string;
  category?: string;
  calculatedQuantity?: number;
  isOverridden?: boolean;
  isEnablementCost?: boolean;
}

export interface MilestoneData {
  id: BoqMilestoneId;
  label?: string;
  items: BOQItem[];
  expanded: boolean;
}

export interface TemporaryWorkSelection {
  id: string;
  label: string;
  description: string;
  unit: string;
  enabled: boolean;
  quantity: string;
  unitPriceUsd: string;
}

export interface GeotechDocumentSummary {
  id: string;
  fileName: string;
  createdAt: string;
}

interface BoqWizardState {
  // Project details
  projectDetails: ProjectDetailsState;
  updateProjectDetails: (updates: Partial<ProjectDetailsState>) => void;

  // Geometry mode
  geometryMode: 'quick' | 'detailed' | 'upload' | null;
  setGeometryMode: (mode: 'quick' | 'detailed' | 'upload' | null) => void;
  detailedRooms: RoomInstance[];
  setDetailedRooms: (rooms: RoomInstance[]) => void;
  totalWindows: number;
  setTotalWindows: (value: number) => void;
  totalDoors: number;
  setTotalDoors: (value: number) => void;

  // Scope
  projectScope: ProjectScope;
  setProjectScope: (scope: ProjectScope) => void;
  selectedStages: string[];
  setSelectedStages: (stages: string[]) => void;
  toggleStage: (stageId: string, included: boolean) => void;

  // Labor
  laborType: LaborPreference;
  setLaborType: (labor: LaborPreference) => void;

  // BOQ data
  milestonesState: MilestoneData[];
  setMilestonesState: (milestones: MilestoneData[]) => void;
  updateMilestoneItemQuantity: (milestoneId: string, itemId: string, quantity: number) => void;
  updateMilestoneItem: (milestoneId: string, itemId: string, updates: Partial<BOQItem>) => void;
  removeMilestoneItem: (milestoneId: string, itemId: string) => void;
  addMilestoneItem: (milestoneId: string, item: BOQItem) => void;
  toggleMilestoneExpanded: (milestoneId: string) => void;

  // Site setup
  temporaryWorksSelections: TemporaryWorkSelection[];
  setTemporaryWorksSelections: (selections: TemporaryWorkSelection[]) => void;
  toggleTemporaryWork: (id: string, enabled: boolean) => void;
  updateTemporaryWorkSelection: (id: string, updates: Partial<TemporaryWorkSelection>) => void;
  includeSepticTank: boolean;
  setIncludeSepticTank: (include: boolean) => void;
  septicDimensions: {
    length: string;
    width: string;
    height: string;
    unitPriceUsd: string;
  };
  updateSepticDimensions: (dimensions: Partial<BoqWizardState['septicDimensions']>) => void;

  // Documents
  geotechDocument: GeotechDocumentSummary | null;
  /** Per-field validation errors from the last blocked step, keyed by field name. */
  validationErrors: Record<string, string>;
  setGeotechDocument: (doc: GeotechDocumentSummary | null) => void;
  setValidationErrors: (errors: Record<string, string>) => void;

  // Compliance
  preConstructionChecks: Record<string, boolean>;
  togglePreConstructionCheck: (ruleId: string) => void;
  certificateTracker: Record<string, CertificateStatus>;
  setCertificateStatus: (certId: string, status: CertificateStatus) => void;

  // Computed selectors
  getVisibleMilestones: () => MilestoneData[];
  getTotalEstimateUSD: () => number;
  getTotalEstimateZWG: (exchangeRate: number) => number;
  getBoqHealth: () => BoqHealthResult;

  // Reset
  resetWizard: () => void;
  reset: () => void;
}

const initialProjectDetails: ProjectDetailsState = {
  projectType: '',
  name: '',
  locationType: '',
  locationCity: '',
  specificLocation: '',
  soilType: '',
  siteSlope: '',
  floorPlanSize: '',
  standSize: '',
  buildingType: '',
  wallHeight: '2.7',
  brickTypes: ['common'],
  cementTypes: ['cement_325'],
  finishLevel: DEFAULT_FINISH_LEVEL,
  roomInputs: { ...DEFAULT_ROOM_INPUTS },
};

const milestoneLabels: Record<BoqMilestoneId, string> = {
  substructure: 'Substructure',
  superstructure: 'Superstructure',
  roofing: 'Roofing',
  finishing: 'Finishing',
  exterior: 'Exterior Works',
  labor: 'Labor',
};

const initialMilestonesState: MilestoneData[] = BOQ_MILESTONE_IDS.map((id) => ({
  id,
  label: milestoneLabels[id],
  items: [],
  expanded: true,
}));

const defaultPreConstructionChecks = LOCATION_PROCEDURE_RULES.reduce<Record<string, boolean>>((acc, rule) => {
  acc[rule.id] = false;
  return acc;
}, {});

const defaultCertificateTracker = STAGE_COMPLIANCE_REQUIREMENTS.reduce<Record<string, CertificateStatus>>((acc, requirement) => {
  acc[requirement.id] = 'pending';
  return acc;
}, {});

function getInitialState(): Omit<BoqWizardState,
  | 'updateProjectDetails'
  | 'setGeometryMode'
  | 'setDetailedRooms'
  | 'setTotalWindows'
  | 'setTotalDoors'
  | 'setProjectScope'
  | 'setSelectedStages'
  | 'toggleStage'
  | 'setLaborType'
  | 'setMilestonesState'
  | 'updateMilestoneItemQuantity'
  | 'updateMilestoneItem'
  | 'removeMilestoneItem'
  | 'addMilestoneItem'
  | 'toggleMilestoneExpanded'
  | 'setTemporaryWorksSelections'
  | 'toggleTemporaryWork'
  | 'updateTemporaryWorkSelection'
  | 'setIncludeSepticTank'
  | 'updateSepticDimensions'
  | 'setGeotechDocument'
  | 'setValidationErrors'
  | 'togglePreConstructionCheck'
  | 'setCertificateStatus'
  | 'getVisibleMilestones'
  | 'getTotalEstimateUSD'
  | 'getTotalEstimateZWG'
  | 'getBoqHealth'
  | 'resetWizard'
  | 'reset'> {
  return {
    projectDetails: { ...initialProjectDetails },
    geometryMode: null,
    detailedRooms: [],
    totalWindows: 0,
    totalDoors: 0,
    projectScope: 'entire',
    selectedStages: ['substructure', 'superstructure'],
    laborType: 'materials_only',
    milestonesState: initialMilestonesState.map((milestone) => ({ ...milestone, items: [] })),
    temporaryWorksSelections: [],
    includeSepticTank: false,
    septicDimensions: {
      length: '3',
      width: '2',
      height: '2',
      unitPriceUsd: '95',
    },
    geotechDocument: null,
    validationErrors: {},
    preConstructionChecks: { ...defaultPreConstructionChecks },
    certificateTracker: { ...defaultCertificateTracker },
  };
}

function calculateVisibleMilestones(state: Pick<BoqWizardState, 'projectScope' | 'selectedStages' | 'laborType' | 'milestonesState'>): MilestoneData[] {
  return state.milestonesState.filter((milestone) => {
    if (milestone.id === 'labor') {
      return state.laborType === 'materials_labor';
    }

    if (state.projectScope === 'stage') {
      return state.selectedStages.includes(milestone.id);
    }

    return true;
  });
}

function totalForMilestones(milestones: MilestoneData[]): number {
  return milestones.reduce((sum, milestone) => {
    const milestoneTotal = milestone.items.reduce((itemSum, item) => {
      const qty = item.quantity ?? 0;
      return itemSum + (qty * item.actualPriceUsd);
    }, 0);

    return sum + milestoneTotal;
  }, 0);
}

export const useBoqWizardStore = create<BoqWizardState>()(
  persist(
    (set, get) => ({
  ...getInitialState(),

  updateProjectDetails: (updates) => set((state) => ({
    projectDetails: { ...state.projectDetails, ...updates },
  })),

  setGeometryMode: (mode) => set({ geometryMode: mode }),
  setDetailedRooms: (rooms) => set({ detailedRooms: rooms }),
  setTotalWindows: (value) => set({ totalWindows: Math.max(0, value) }),
  setTotalDoors: (value) => set({ totalDoors: Math.max(0, value) }),

  setProjectScope: (scope) => set((state) => ({
    projectScope: scope,
    selectedStages: scope === 'entire'
      ? state.selectedStages
      : state.selectedStages.length > 0
        ? state.selectedStages
        : ['substructure'],
  })),

  setSelectedStages: (stages) => set({ selectedStages: Array.from(new Set(stages)) }),

  toggleStage: (stageId, included) => set((state) => ({
    selectedStages: included
      ? Array.from(new Set([...state.selectedStages, stageId]))
      : state.selectedStages.filter((stage) => stage !== stageId),
  })),

  setLaborType: (labor) => set({ laborType: labor }),

  setMilestonesState: (milestones) => set((state) => {
    const existingExpanded = new Map(state.milestonesState.map((m) => [m.id, m.expanded]));
    return {
      milestonesState: milestones.map((milestone) => ({
        ...milestone,
        expanded: existingExpanded.get(milestone.id) ?? milestone.expanded,
      })),
    };
  }),

  updateMilestoneItemQuantity: (milestoneId, itemId, quantity) => set((state) => ({
    milestonesState: state.milestonesState.map((milestone) =>
      milestone.id === milestoneId
        ? {
          ...milestone,
          items: milestone.items.map((item) =>
            item.id === itemId
              ? {
                ...item,
                quantity,
                isOverridden: true,
              }
              : item
          ),
        }
        : milestone
    ),
  })),

  updateMilestoneItem: (milestoneId, itemId, updates) => set((state) => ({
    milestonesState: state.milestonesState.map((milestone) =>
      milestone.id === milestoneId
        ? {
          ...milestone,
          items: milestone.items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
          ),
        }
        : milestone
    ),
  })),

  removeMilestoneItem: (milestoneId, itemId) => set((state) => ({
    milestonesState: state.milestonesState.map((milestone) =>
      milestone.id === milestoneId
        ? {
          ...milestone,
          items: milestone.items.filter((item) => item.id !== itemId),
        }
        : milestone
    ),
  })),

  addMilestoneItem: (milestoneId, newItem) => set((state) => ({
    milestonesState: state.milestonesState.map((milestone) => {
      if (milestone.id !== milestoneId) {
        return milestone;
      }

      const existingItem = milestone.items.find((item) => item.materialId === newItem.materialId);
      if (existingItem) {
        return {
          ...milestone,
          items: milestone.items.map((item) =>
            item.materialId === newItem.materialId
              ? {
                ...item,
                quantity: Number(((item.quantity || 0) + (newItem.quantity || 0)).toFixed(2)),
                isEnablementCost: newItem.isEnablementCost ? true : item.isEnablementCost,
              }
              : item
          ),
        };
      }

      return {
        ...milestone,
        items: [newItem, ...milestone.items],
      };
    }),
  })),

  toggleMilestoneExpanded: (milestoneId) => set((state) => ({
    milestonesState: state.milestonesState.map((milestone) =>
      milestone.id === milestoneId
        ? { ...milestone, expanded: !milestone.expanded }
        : milestone
    ),
  })),

  setTemporaryWorksSelections: (selections) => set({ temporaryWorksSelections: selections }),

  toggleTemporaryWork: (id, enabled) => set((state) => ({
    temporaryWorksSelections: state.temporaryWorksSelections.map((selection) =>
      selection.id === id ? { ...selection, enabled } : selection
    ),
  })),

  updateTemporaryWorkSelection: (id, updates) => set((state) => ({
    temporaryWorksSelections: state.temporaryWorksSelections.map((selection) =>
      selection.id === id ? { ...selection, ...updates } : selection
    ),
  })),

  setIncludeSepticTank: (include) => set({ includeSepticTank: include }),

  updateSepticDimensions: (dimensions) => set((state) => ({
    septicDimensions: { ...state.septicDimensions, ...dimensions },
  })),

  setGeotechDocument: (doc) => set({ geotechDocument: doc }),

  setValidationErrors: (errors) => set({ validationErrors: errors }),

  togglePreConstructionCheck: (ruleId) => set((state) => ({
    preConstructionChecks: {
      ...state.preConstructionChecks,
      [ruleId]: !state.preConstructionChecks[ruleId],
    },
  })),

  setCertificateStatus: (certId, status) => set((state) => ({
    certificateTracker: {
      ...state.certificateTracker,
      [certId]: status,
    },
  })),

  getVisibleMilestones: () => {
    const state = get();
    return calculateVisibleMilestones(state);
  },

  getTotalEstimateUSD: () => {
    const visibleMilestones = calculateVisibleMilestones(get());
    return totalForMilestones(visibleMilestones);
  },

  getTotalEstimateZWG: (exchangeRate) => {
    const totalUsd = totalForMilestones(calculateVisibleMilestones(get()));
    return totalUsd * exchangeRate;
  },

  getBoqHealth: () => {
    const visibleMilestones = calculateVisibleMilestones(get())
      .filter((milestone) => milestone.id !== 'labor');

    const healthInputs = visibleMilestones.map((milestone) => ({
      category: milestone.id,
      itemIdsWithQty: milestone.items
        .filter((item) => (item.quantity || 0) > 0)
        .map((item) => item.materialId),
    })) as BoqHealthCategoryInput[];

    return calculateBoqHealth(healthInputs);
  },

  resetWizard: () => set(getInitialState()),
  reset: () => set(getInitialState()),
    }),
    {
      // The wizard runs to six steps and advertises ~12 minutes. Autosave only
      // covers signed-in users with a project row, so without this an anonymous
      // visitor lost everything to a refresh or a closed tab.
      name: 'zimestimate-boq-wizard',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Rehydrate explicitly on mount so the server-rendered markup and the
      // first client render agree.
      skipHydration: true,
      partialize: (state) => ({
        projectDetails: state.projectDetails,
        geometryMode: state.geometryMode,
        detailedRooms: state.detailedRooms,
        totalWindows: state.totalWindows,
        totalDoors: state.totalDoors,
        projectScope: state.projectScope,
        selectedStages: state.selectedStages,
        laborType: state.laborType,
        milestonesState: state.milestonesState,
        temporaryWorksSelections: state.temporaryWorksSelections,
        includeSepticTank: state.includeSepticTank,
        septicDimensions: state.septicDimensions,
        geotechDocument: state.geotechDocument,
        preConstructionChecks: state.preConstructionChecks,
        certificateTracker: state.certificateTracker,
      }),
    }
  )
);
