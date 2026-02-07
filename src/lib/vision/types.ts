// Vision Takeoff Types
// TypeScript interfaces for floor plan analysis and BOQ generation

// ============================================
// ANALYSIS RESULT TYPES
// ============================================

export interface DetectedRoom {
  id: string;
  name: string;
  dimensions: {
    width: number;  // meters
    length: number; // meters
  };
  area: number; // square meters
  position: {
    x: number;      // percentage of image (0-100)
    y: number;
    width: number;
    height: number;
  };
  wallType: 'external' | 'internal';
  isEdited: boolean;
}

export interface DetectedWall {
  id: string;
  startPoint: { x: number; y: number }; // percentage
  endPoint: { x: number; y: number };
  length: number; // meters
  height: number; // meters (default 2.7)
  thickness: number; // mm
  type: 'external' | 'internal';
}

export interface VisionAnalysisResult {
  rooms: DetectedRoom[];
  walls: DetectedWall[];
  totalArea: number;
  doors: number;
  windows: number;
  confidence: number; // 0-100
  imageWidth: number;
  imageHeight: number;
  rawResponse?: string; // For debugging
}

// ============================================
// CONFIGURATION TYPES
// ============================================

export type ProjectScope =
  | 'full_house'
  | 'substructure'
  | 'superstructure'
  | 'roofing'
  | 'finishing'
  | 'exterior';

export type BrickType =
  | 'common'
  | 'farm'
  | 'semi_common'
  | 'blocks_6inch'
  | 'blocks_8inch'
  | 'face_brick';

export type CementType = 'cement_325' | 'cement_425';

export interface VisionConfig {
  scope: ProjectScope | ProjectScope[]; // Can be single or multi-select
  brickType: BrickType | BrickType[]; // Can be single or multi-select
  cementType: CementType | CementType[]; // Can be single or multi-select
  includeLabor: boolean;
  wallHeight: number; // default 2.7m
  foundationDepth: number; // default 0.6m
}

export const DEFAULT_CONFIG: VisionConfig = {
  scope: 'full_house',
  brickType: 'common',
  cementType: 'cement_325',
  includeLabor: true,
  wallHeight: 2.7,
  foundationDepth: 0.6,
};

// Helper to normalize config values to arrays
export function normalizeConfigToArrays(config: VisionConfig): {
  scopes: ProjectScope[];
  brickTypes: BrickType[];
  cementTypes: CementType[];
} {
  return {
    scopes: Array.isArray(config.scope) ? config.scope : [config.scope],
    brickTypes: Array.isArray(config.brickType) ? config.brickType : [config.brickType],
    cementTypes: Array.isArray(config.cementType) ? config.cementType : [config.cementType],
  };
}

// ============================================
// BOQ GENERATION TYPES
// ============================================

export interface GeneratedBOQItem {
  id: string;
  materialId: string;
  materialName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPriceUsd: number;
  unitPriceZwg: number;
  totalUsd: number;
  totalZwg: number;
  calculationNote: string; // e.g., "External walls: 45m x 2.7m height"
  isEdited: boolean;
}

// ============================================
// WIZARD STATE TYPES
// ============================================

export type WizardStep =
  | 'upload'
  | 'analyzing'
  | 'warning'
  | 'editing'
  | 'project_info'
  | 'config'
  | 'calculating'
  | 'results';

export interface ProjectInfo {
  name: string;
  location: string;
}

export interface VisionTakeoffState {
  step: WizardStep;
  uploadedFile: File | null;
  previewUrl: string | null;
  analysisResult: VisionAnalysisResult | null;
  editedRooms: DetectedRoom[];
  editedWalls: DetectedWall[];
  projectInfo: ProjectInfo;
  config: VisionConfig;
  generatedBOQ: GeneratedBOQItem[];
  error: string | null;
  isProcessing: boolean;
}

export const INITIAL_STATE: VisionTakeoffState = {
  step: 'upload',
  uploadedFile: null,
  previewUrl: null,
  analysisResult: null,
  editedRooms: [],
  editedWalls: [],
  projectInfo: { name: '', location: '' },
  config: DEFAULT_CONFIG,
  generatedBOQ: [],
  error: null,
  isProcessing: false,
};

export interface DetailedRoom {
  id: string;
  label: string;
  length: number;
  width: number;
  windows: number;
  doors: number;
  materialId: string;
}

// ============================================
// BRICK & MATERIAL CONSTANTS
// ============================================

export const BRICK_INFO: Record<BrickType, {
  name: string;
  materialId: string;
  bricksPerSqm: number;
  description: string;
}> = {
  common: {
    name: 'Red Common Brick',
    materialId: 'brick-common',
    bricksPerSqm: 50,
    description: 'Standard fired clay bricks, most popular in Zimbabwe',
  },
  farm: {
    name: 'Farm Brick',
    materialId: 'farm-brick',
    bricksPerSqm: 55,
    description: 'Locally made bricks, budget-friendly option',
  },
  semi_common: {
    name: 'Semi-Common Brick',
    materialId: 'brick-semi',
    bricksPerSqm: 50,
    description: 'Higher quality fired bricks for exposed work',
  },
  blocks_6inch: {
    name: '6" Cement Block',
    materialId: 'block-6inch',
    bricksPerSqm: 12,
    description: '150mm hollow concrete blocks, faster construction',
  },
  blocks_8inch: {
    name: '8" Cement Block',
    materialId: 'block-8inch',
    bricksPerSqm: 10,
    description: '200mm hollow blocks for external walls, best insulation',
  },
  face_brick: {
    name: 'Face Brick',
    materialId: 'brick-face-red',
    bricksPerSqm: 48,
    description: 'Decorative face bricks, no plastering needed',
  },
};


export const CEMENT_INFO: Record<CementType, {
  name: string;
  materialId: string;
  bagsPerM3Mortar: number;
  description: string;
}> = {
  cement_325: {
    name: 'Standard Cement 32.5N',
    materialId: 'cement-325',
    bagsPerM3Mortar: 8,
    description: 'Standard strength for general building',
  },
  cement_425: {
    name: 'Rapid Cement 42.5R',
    materialId: 'cement-425',
    bagsPerM3Mortar: 7,
    description: 'High strength, faster setting',
  },
};

export const SCOPE_INFO: Record<ProjectScope, {
  name: string;
  description: string;
  milestones: string[];
}> = {
  full_house: {
    name: 'Full House',
    description: 'Complete construction from foundation to finishing',
    milestones: ['substructure', 'superstructure', 'roofing', 'finishing', 'exterior'],
  },
  substructure: {
    name: 'Substructure Only',
    description: 'Foundation, DPC, and walls to window level',
    milestones: ['substructure'],
  },
  superstructure: {
    name: 'Superstructure Only',
    description: 'Walls from window level to roof plate',
    milestones: ['superstructure'],
  },
  roofing: {
    name: 'Roofing Only',
    description: 'Roof structure, sheets, and accessories',
    milestones: ['roofing'],
  },
  finishing: {
    name: 'Finishing Only',
    description: 'Plastering, painting, tiling, and fittings',
    milestones: ['finishing'],
  },
  exterior: {
    name: 'Exterior Only',
    description: 'Boundary walls, gates, and outdoor work',
    milestones: ['exterior'],
  },
};
