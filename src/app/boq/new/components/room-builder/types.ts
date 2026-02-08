// Room type definitions with colors for visual coding
export const ROOM_TYPES = [
    { key: 'bedrooms', label: 'Bedroom', defaultDims: { l: 4, w: 3.5 }, color: '#3b82f6', bgColor: '#eff6ff' },
    { key: 'diningRoom', label: 'Dining Room', defaultDims: { l: 5, w: 4 }, color: '#8b5cf6', bgColor: '#f5f3ff' },
    { key: 'veranda', label: 'Veranda', defaultDims: { l: 4, w: 2 }, color: '#22c55e', bgColor: '#f0fdf4' },
    { key: 'bathrooms', label: 'Bathroom', defaultDims: { l: 2.5, w: 2 }, color: '#06b6d4', bgColor: '#ecfeff' },
    { key: 'kitchen', label: 'Kitchen', defaultDims: { l: 4, w: 3 }, color: '#f97316', bgColor: '#fff7ed' },
    { key: 'pantry', label: 'Pantry', defaultDims: { l: 2, w: 1.5 }, color: '#eab308', bgColor: '#fefce8' },
    { key: 'livingRoom', label: 'Living Room', defaultDims: { l: 6, w: 5 }, color: '#ec4899', bgColor: '#fdf2f8' },
    { key: 'garage1', label: 'Single Garage', defaultDims: { l: 6, w: 3 }, color: '#64748b', bgColor: '#f8fafc' },
    { key: 'garage2', label: 'Double Garage', defaultDims: { l: 6, w: 6 }, color: '#64748b', bgColor: '#f8fafc' },
    { key: 'passage', label: 'Hallway', defaultDims: { l: 5, w: 1.2 }, color: '#a855f7', bgColor: '#faf5ff' },
];

export const ENSUITE_TYPES = [
    { key: 'ensuite-toilet', label: 'En-suite Toilet', defaultDims: { l: 1.5, w: 1 }, color: '#06b6d4', bgColor: '#ecfeff', icon: 'toilet' as const },
    { key: 'ensuite-bathroom', label: 'En-suite Bath', defaultDims: { l: 2, w: 1.5 }, color: '#06b6d4', bgColor: '#ecfeff', icon: 'bathtub' as const },
    { key: 'walkin-closet', label: 'Walk-in Closet', defaultDims: { l: 2, w: 1.5 }, color: '#a855f7', bgColor: '#faf5ff', icon: 'closet' as const },
];

export const BRICK_TYPES = [
    { id: 'brick-common', label: 'Common Bricks', rate: 52, color: '#dc2626' },
    { id: 'block-6inch', label: '6" Hollow Blocks', rate: 13, color: '#64748b' },
    { id: 'brick-face-red', label: 'Face Bricks (Red)', rate: 52, color: '#b91c1c' },
    { id: 'farm-brick', label: 'Farm Bricks', rate: 55, color: '#ea580c' },
];

export type WallFeature = 'solid' | 'opening' | 'door' | 'window';

export interface RoomWalls {
    top: WallFeature;
    right: WallFeature;
    bottom: WallFeature;
    left: WallFeature;
}

export interface RoomInstance {
    id: string;
    type: string;
    label: string;
    length: number;
    width: number;
    windows: number;
    doors: number;
    x: number;
    y: number;
    materialId: string;
    parentRoomId?: string;
    isEnSuite?: boolean;
    rotation?: number; // degrees: 0, 90, 180, 270
    walls?: RoomWalls;
}

export interface InteractiveRoomBuilderProps {
    roomCounts: { [key: string]: number };
    targetFloorArea: number;
    onContinue: (rooms: RoomInstance[], totals: { area: number; walls: number; bricks: number }) => void;
    onBack: () => void;
}

// Constants
export const GRID_SNAP_SIZE = 20;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
export const ZOOM_STEP = 0.1;
export const PIXELS_PER_METER = 40;
export const WALL_HEIGHT = 2.7;
export const STANDARD_DOOR_AREA = 2.0;
export const STANDARD_WINDOW_AREA = 1.5;

// Helper to get room type color
export const getRoomTypeColor = (typeKey: string): { color: string; bgColor: string } => {
    const roomType = ROOM_TYPES.find(t => t.key === typeKey);
    if (roomType) return { color: roomType.color, bgColor: roomType.bgColor };

    const ensuiteType = ENSUITE_TYPES.find(t => t.key === typeKey);
    if (ensuiteType) return { color: ensuiteType.color, bgColor: ensuiteType.bgColor };

    return { color: '#94a3b8', bgColor: '#f8fafc' };
};
