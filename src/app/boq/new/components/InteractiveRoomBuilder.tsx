
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Plus,
    Minus,
    Door,
    FrameCorners, // Window icon
    CaretLeft,
    ArrowRight,
    FloppyDisk,
    Square,
    MagicWand,
    Warning,
    CheckCircle,
    X,
    Trash,
    List,
    ArrowCounterClockwise,
    ArrowClockwise,
    MagnifyingGlassPlus,
    MagnifyingGlassMinus,
    GridFour,
    LinkSimple,
    Toilet,
    Bathtub,
    Keyboard,
    Copy,
    ClipboardText,
    ArrowsClockwise,
    Question,
    Command
} from '@phosphor-icons/react';

// Room type definitions with colors for visual coding
const ROOM_TYPES = [
    { key: 'bedrooms', label: 'Bedroom', defaultDims: { l: 4, w: 3.5 }, color: '#3b82f6', bgColor: '#eff6ff' }, // Blue
    { key: 'diningRoom', label: 'Dining Room', defaultDims: { l: 5, w: 4 }, color: '#8b5cf6', bgColor: '#f5f3ff' }, // Purple
    { key: 'veranda', label: 'Veranda', defaultDims: { l: 4, w: 2 }, color: '#22c55e', bgColor: '#f0fdf4' }, // Green
    { key: 'bathrooms', label: 'Bathroom', defaultDims: { l: 2.5, w: 2 }, color: '#06b6d4', bgColor: '#ecfeff' }, // Cyan
    { key: 'kitchen', label: 'Kitchen', defaultDims: { l: 4, w: 3 }, color: '#f97316', bgColor: '#fff7ed' }, // Orange
    { key: 'pantry', label: 'Pantry', defaultDims: { l: 2, w: 1.5 }, color: '#eab308', bgColor: '#fefce8' }, // Yellow
    { key: 'livingRoom', label: 'Living Room', defaultDims: { l: 6, w: 5 }, color: '#ec4899', bgColor: '#fdf2f8' }, // Pink
    { key: 'garage1', label: 'Single Garage', defaultDims: { l: 6, w: 3 }, color: '#64748b', bgColor: '#f8fafc' }, // Slate
    { key: 'garage2', label: 'Double Garage', defaultDims: { l: 6, w: 6 }, color: '#64748b', bgColor: '#f8fafc' }, // Slate
    { key: 'passage', label: 'Passage', defaultDims: { l: 5, w: 1.2 }, color: '#a855f7', bgColor: '#faf5ff' }, // Violet
];

// En-suite / Sub-room types (can be added within larger rooms)
const ENSUITE_TYPES = [
    { key: 'ensuite-toilet', label: 'En-suite Toilet', defaultDims: { l: 1.5, w: 1 }, color: '#06b6d4', bgColor: '#ecfeff', icon: 'toilet' },
    { key: 'ensuite-bathroom', label: 'En-suite Bath', defaultDims: { l: 2, w: 1.5 }, color: '#06b6d4', bgColor: '#ecfeff', icon: 'bathtub' },
    { key: 'walkin-closet', label: 'Walk-in Closet', defaultDims: { l: 2, w: 1.5 }, color: '#a855f7', bgColor: '#faf5ff', icon: 'closet' },
];

export const BRICK_TYPES = [
    { id: 'brick-common', label: 'Common Bricks', rate: 52, color: '#dc2626' },
    { id: 'block-6inch', label: '6" Hollow Blocks', rate: 13, color: '#64748b' },
    { id: 'brick-face-red', label: 'Face Bricks (Red)', rate: 52, color: '#b91c1c' },
    { id: 'farm-brick', label: 'Farm Bricks', rate: 55, color: '#ea580c' }
];

// Connection between rooms (for passages)
interface RoomConnection {
    id: string;
    fromRoomId: string;
    toRoomId: string;
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
    parentRoomId?: string; // For en-suite rooms attached to a parent
    isEnSuite?: boolean;   // Flag for en-suite/sub-rooms
}

interface InteractiveRoomBuilderProps {
    roomCounts: { [key: string]: number };
    targetFloorArea: number; // From the previous screen
    onContinue: (rooms: RoomInstance[], totals: { area: number, walls: number, bricks: number }) => void;
    onBack: () => void;
}

// Grid and Zoom Constants
const GRID_SNAP_SIZE = 20; // Pixels to snap to
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const PIXELS_PER_METER = 40; // 40px = 1m

// Helper to get room type color
const getRoomTypeColor = (typeKey: string): { color: string; bgColor: string } => {
    const roomType = ROOM_TYPES.find(t => t.key === typeKey);
    if (roomType) return { color: roomType.color, bgColor: roomType.bgColor };

    const ensuiteType = ENSUITE_TYPES.find(t => t.key === typeKey);
    if (ensuiteType) return { color: ensuiteType.color, bgColor: ensuiteType.bgColor };

    return { color: '#94a3b8', bgColor: '#f8fafc' }; // Default slate
};

export function InteractiveRoomBuilder({ roomCounts, targetFloorArea, onContinue, onBack }: InteractiveRoomBuilderProps) {
    const [rooms, setRooms] = useState<RoomInstance[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [showRoomPicker, setShowRoomPicker] = useState(false);
    const [showEnSuitePicker, setShowEnSuitePicker] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [loadedFromStorage, setLoadedFromStorage] = useState(false);

    // Canvas ref for keyboard focus
    const canvasRef = useRef<HTMLDivElement>(null);

    // Zoom state
    const [zoom, setZoom] = useState(1);
    const [snapToGrid, setSnapToGrid] = useState(true);

    // Room connections (passages between rooms)
    const [connections, setConnections] = useState<RoomConnection[]>([]);
    const [connectionMode, setConnectionMode] = useState<'none' | 'selecting-first' | 'selecting-second'>('none');
    const [connectionFirstRoom, setConnectionFirstRoom] = useState<string | null>(null);

    // Drag state
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [dragStartRooms, setDragStartRooms] = useState<RoomInstance[] | null>(null);

    // Resize state
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [resizeStartDims, setResizeStartDims] = useState<{ w: number, l: number, mouseX: number, mouseY: number } | null>(null);

    // History state
    const [past, setPast] = useState<RoomInstance[][]>([]);
    const [future, setFuture] = useState<RoomInstance[][]>([]);

    // Phase 3: Help modal, clipboard, alignment guides
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [clipboard, setClipboard] = useState<RoomInstance | null>(null);
    const [alignmentGuides, setAlignmentGuides] = useState<{ horizontal: number[]; vertical: number[] }>({ horizontal: [], vertical: [] });

    // History helpers
    const saveToHistory = useCallback(() => {
        setPast(prev => [...prev, rooms]);
        setFuture([]);
    }, [rooms]);

    const undo = useCallback(() => {
        if (past.length === 0) return;
        const previous = past[past.length - 1];
        setFuture(prev => [rooms, ...prev]);
        setPast(prev => prev.slice(0, prev.length - 1));
        setRooms(previous);
    }, [past, rooms]);

    const redo = useCallback(() => {
        if (future.length === 0) return;
        const next = future[0];
        setPast(prev => [...prev, rooms]);
        setFuture(prev => prev.slice(1));
        setRooms(next);
    }, [future, rooms]);

    // Zoom controls
    const zoomIn = useCallback(() => {
        setZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
    }, []);

    const zoomOut = useCallback(() => {
        setZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
    }, []);

    const resetZoom = useCallback(() => {
        setZoom(1);
    }, []);

    // Collision detection helper
    const checkCollision = useCallback((roomA: RoomInstance, roomB: RoomInstance): boolean => {
        if (roomA.id === roomB.id) return false;

        const aLeft = roomA.x;
        const aRight = roomA.x + roomA.width * PIXELS_PER_METER;
        const aTop = roomA.y;
        const aBottom = roomA.y + roomA.length * PIXELS_PER_METER;

        const bLeft = roomB.x;
        const bRight = roomB.x + roomB.width * PIXELS_PER_METER;
        const bTop = roomB.y;
        const bBottom = roomB.y + roomB.length * PIXELS_PER_METER;

        // Check if they overlap with a small margin for visual clarity
        const margin = 4;
        return !(aRight <= bLeft + margin ||
            aLeft >= bRight - margin ||
            aBottom <= bTop + margin ||
            aTop >= bBottom - margin);
    }, []);

    // Check if a room collides with any other room
    const hasCollision = useCallback((room: RoomInstance, allRooms: RoomInstance[]): boolean => {
        return allRooms.some(other => checkCollision(room, other));
    }, [checkCollision]);

    // Get collision status for visual feedback
    const roomCollisions = useMemo(() => {
        const collisions: { [key: string]: boolean } = {};
        rooms.forEach(room => {
            collisions[room.id] = hasCollision(room, rooms);
        });
        return collisions;
    }, [rooms, hasCollision]);

    // Snap position to grid
    const snapToGridPosition = useCallback((value: number): number => {
        if (!snapToGrid) return value;
        return Math.round(value / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
    }, [snapToGrid]);

    // Move selected room with arrow keys
    const moveSelectedRoom = useCallback((dx: number, dy: number) => {
        if (!selectedRoomId) return;

        saveToHistory();
        setRooms(prev => prev.map(room => {
            if (room.id === selectedRoomId) {
                const step = snapToGrid ? GRID_SNAP_SIZE : 5;
                return {
                    ...room,
                    x: Math.max(0, room.x + dx * step),
                    y: Math.max(0, room.y + dy * step)
                };
            }
            return room;
        }));
    }, [selectedRoomId, saveToHistory, snapToGrid]);



    // Mouse wheel zoom handler
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                zoomIn();
            } else {
                zoomOut();
            }
        }
    }, [zoomIn, zoomOut]);

    // Clear saved room data
    const clearSavedData = () => {
        try {
            localStorage.removeItem('zimestimate_room_builder');
            setLoadedFromStorage(false);
            // Reset to initial state
            window.location.reload();
        } catch (error) {
            console.error('Failed to clear saved data:', error);
        }
    };

    // Detect mobile screen size
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // Auto-hide sidebar on mobile
            if (mobile) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Open sidebar when a room is selected on mobile
    const handleRoomSelect = useCallback((roomId: string) => {
        setSelectedRoomId(roomId);
        if (isMobile) {
            setSidebarOpen(true);
        }
    }, [isMobile]);

    // Save rooms to localStorage whenever they change
    useEffect(() => {
        if (rooms.length > 0) {
            try {
                localStorage.setItem('zimestimate_room_builder', JSON.stringify({
                    rooms,
                    targetFloorArea,
                    timestamp: Date.now()
                }));
            } catch (error) {
                console.error('Failed to save rooms to localStorage:', error);
            }
        }
    }, [rooms, targetFloorArea]);

    // Load rooms from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('zimestimate_room_builder');
            if (saved) {
                const data = JSON.parse(saved);
                // Check if data is recent (within 24 hours) and matches target area
                const isRecent = Date.now() - data.timestamp < 24 * 60 * 60 * 1000;
                const matchesTarget = data.targetFloorArea === targetFloorArea;

                if (isRecent && matchesTarget && data.rooms.length > 0) {
                    // Migrate old data
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const loadedRooms = data.rooms.map((r: any, index: number) => {
                        const update = { ...r };

                        // Check x,y
                        if (update.x === undefined || update.y === undefined) {
                            const GRID_SIZE = 160;
                            const COLS = isMobile ? 2 : 4;
                            const row = Math.floor(index / COLS);
                            const col = index % COLS;
                            update.x = 20 + (col * GRID_SIZE);
                            update.y = 20 + (row * 140);
                        }

                        // Check materialId
                        if (!update.materialId) {
                            update.materialId = 'brick-common';
                        }

                        return update;
                    });
                    setRooms(loadedRooms as RoomInstance[]);
                    setLoadedFromStorage(true);
                    return; // Skip initialization below
                }
            }
        } catch (error) {
            console.error('Failed to load rooms from localStorage:', error);
        }

        // Initialize rooms based on the simplified counts (only if not loaded from storage)
        if (rooms.length === 0) {
            const initialRooms: RoomInstance[] = [];
            let currentX = 20;
            let currentY = 20;
            const GRID_SIZE = 160; // Size of grid cell
            const COLS = isMobile ? 2 : 4; // Columns before wrapping

            Object.entries(roomCounts).forEach(([key, count]) => {
                const typeDef = ROOM_TYPES.find(r => r.key === key);
                if (typeDef && count > 0) {
                    for (let i = 0; i < count; i++) {
                        initialRooms.push({
                            id: `${key}-${i}-${Date.now()}`,
                            type: key,
                            label: count > 1 ? `${typeDef.label} ${i + 1}` : typeDef.label,
                            length: typeDef.defaultDims.l,
                            width: typeDef.defaultDims.w,
                            windows: 1,
                            doors: 1,
                            x: currentX,
                            y: currentY,
                            materialId: 'brick-common'
                        });

                        // Update grid position
                        currentX += GRID_SIZE;
                        if (currentX > (GRID_SIZE * COLS)) {
                            currentX = 20;
                            currentY += 140;
                        }
                    }
                }
            });
            setRooms(initialRooms);
            // Select the first room by default
            if (initialRooms.length > 0) {
                setSelectedRoomId(initialRooms[0].id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomCounts, isMobile]);

    const selectedRoom = useMemo(() =>
        rooms.find(r => r.id === selectedRoomId),
        [rooms, selectedRoomId]
    );

    const updateSelectedRoom = (updates: Partial<RoomInstance>) => {
        if (!selectedRoomId) return;
        setRooms(prev => prev.map(r =>
            r.id === selectedRoomId ? { ...r, ...updates } : r
        ));
    };

    // Standard opening sizes (for deductions)
    const STANDARD_DOOR_AREA = 2.0; // 1m width × 2m height (m²)
    const STANDARD_WINDOW_AREA = 1.5; // 1m width × 1.5m height (m²)
    const WALL_HEIGHT = 2.7; // Standard wall height in meters

    const totals = useMemo(() => {
        return rooms.reduce((acc, room) => {
            const floorArea = room.length * room.width;
            const perimeter = (room.length + room.width) * 2;
            const grossWallArea = perimeter * WALL_HEIGHT;

            // Deduct openings from wall area
            const doorDeductions = room.doors * STANDARD_DOOR_AREA;
            const windowDeductions = room.windows * STANDARD_WINDOW_AREA;
            const netWallArea = Math.max(0, grossWallArea - doorDeductions - windowDeductions);

            // Calculate bricks based on net wall area (using room's material rate)
            const materialDef = BRICK_TYPES.find(b => b.id === (room.materialId || 'brick-common')) || BRICK_TYPES[0];
            const bricksNeeded = netWallArea * materialDef.rate;

            return {
                area: acc.area + floorArea,
                walls: acc.walls + netWallArea,
                bricks: acc.bricks + bricksNeeded
            };
        }, { area: 0, walls: 0, bricks: 0 });
    }, [rooms]);

    // Floor area comparison
    const areaDiff = targetFloorArea - totals.area;
    const isOverTarget = areaDiff < 0;
    const isUnderTarget = areaDiff > 1; // Allow 1m² tolerance

    // Add a new room
    const addRoom = (typeKey: string) => {
        saveToHistory();
        const typeDef = ROOM_TYPES.find(r => r.key === typeKey);
        if (!typeDef) return;

        const existingCount = rooms.filter(r => r.type === typeKey).length;

        // Calculate position based on grid
        const totalRooms = rooms.length;
        const GRID_SIZE = 160;
        const COLS = isMobile ? 2 : 4;
        const row = Math.floor(totalRooms / COLS);
        const col = totalRooms % COLS;
        const x = 20 + (col * GRID_SIZE);
        const y = 20 + (row * 140);

        const newRoom: RoomInstance = {
            id: `${typeKey}-${existingCount}-${Date.now()}`,
            type: typeKey,
            label: `${typeDef.label} ${existingCount + 1}`,
            length: typeDef.defaultDims.l,
            width: typeDef.defaultDims.w,
            windows: 1,
            doors: 1,
            x,
            y,
            materialId: 'brick-common'
        };
        setRooms(prev => [...prev, newRoom]);
        setSelectedRoomId(newRoom.id);
        setShowRoomPicker(false);
    };

    // Add an en-suite/sub-room attached to a parent room
    const addEnSuiteRoom = (ensuiteTypeKey: string) => {
        if (!selectedRoomId) return;

        saveToHistory();
        const typeDef = ENSUITE_TYPES.find(r => r.key === ensuiteTypeKey);
        if (!typeDef) return;

        const parentRoom = rooms.find(r => r.id === selectedRoomId);
        if (!parentRoom) return;

        const existingEnSuites = rooms.filter(r => r.parentRoomId === selectedRoomId).length;

        // Position the en-suite inside or adjacent to the parent room
        const x = parentRoom.x + (parentRoom.width * PIXELS_PER_METER) - (typeDef.defaultDims.w * PIXELS_PER_METER) - 10;
        const y = parentRoom.y + 10 + (existingEnSuites * (typeDef.defaultDims.l * PIXELS_PER_METER + 10));

        const newRoom: RoomInstance = {
            id: `${ensuiteTypeKey}-${Date.now()}`,
            type: ensuiteTypeKey,
            label: typeDef.label,
            length: typeDef.defaultDims.l,
            width: typeDef.defaultDims.w,
            windows: 0,
            doors: 1,
            x,
            y,
            materialId: 'brick-common',
            parentRoomId: selectedRoomId,
            isEnSuite: true
        };

        setRooms(prev => [...prev, newRoom]);
        setShowEnSuitePicker(false);

        // Auto-create a connection between parent and en-suite
        const newConnection: RoomConnection = {
            id: `conn-${Date.now()}`,
            fromRoomId: selectedRoomId,
            toRoomId: newRoom.id
        };
        setConnections(prev => [...prev, newConnection]);
    };

    // Start connection mode
    const startConnectionMode = () => {
        setConnectionMode('selecting-first');
        setConnectionFirstRoom(null);
    };

    // Cancel connection mode
    const cancelConnectionMode = () => {
        setConnectionMode('none');
        setConnectionFirstRoom(null);
    };

    // Handle room click during connection mode
    const handleConnectionClick = (roomId: string) => {
        if (connectionMode === 'selecting-first') {
            setConnectionFirstRoom(roomId);
            setConnectionMode('selecting-second');
        } else if (connectionMode === 'selecting-second' && connectionFirstRoom) {
            if (roomId === connectionFirstRoom) {
                // Can't connect to self
                return;
            }

            // Check if connection already exists
            const exists = connections.some(c =>
                (c.fromRoomId === connectionFirstRoom && c.toRoomId === roomId) ||
                (c.fromRoomId === roomId && c.toRoomId === connectionFirstRoom)
            );

            if (!exists) {
                const newConnection: RoomConnection = {
                    id: `conn-${Date.now()}`,
                    fromRoomId: connectionFirstRoom,
                    toRoomId: roomId
                };
                setConnections(prev => [...prev, newConnection]);
            }

            cancelConnectionMode();
        }
    };

    // Remove a connection
    const removeConnection = (connectionId: string) => {
        setConnections(prev => prev.filter(c => c.id !== connectionId));
    };

    // Get connection line coordinates between two rooms
    const getConnectionLine = (conn: RoomConnection) => {
        const fromRoom = rooms.find(r => r.id === conn.fromRoomId);
        const toRoom = rooms.find(r => r.id === conn.toRoomId);

        if (!fromRoom || !toRoom) return null;

        // Calculate center points of each room
        const fromCenterX = fromRoom.x + (fromRoom.width * PIXELS_PER_METER) / 2;
        const fromCenterY = fromRoom.y + (fromRoom.length * PIXELS_PER_METER) / 2;
        const toCenterX = toRoom.x + (toRoom.width * PIXELS_PER_METER) / 2;
        const toCenterY = toRoom.y + (toRoom.length * PIXELS_PER_METER) / 2;

        return { x1: fromCenterX, y1: fromCenterY, x2: toCenterX, y2: toCenterY };
    };

    // Remove selected room
    const removeSelectedRoom = () => {
        if (!selectedRoomId) return;
        saveToHistory();

        // Also remove connections involving this room
        setConnections(prev => prev.filter(c =>
            c.fromRoomId !== selectedRoomId && c.toRoomId !== selectedRoomId
        ));

        // Also remove any en-suite rooms attached to this room
        setRooms(prev => prev.filter(r => r.id !== selectedRoomId && r.parentRoomId !== selectedRoomId));
        setSelectedRoomId(rooms.length > 1 ? rooms[0].id : null);
    };

    // Copy selected room to clipboard
    const copySelectedRoom = useCallback(() => {
        if (!selectedRoomId) return;
        const room = rooms.find(r => r.id === selectedRoomId);
        if (room) {
            setClipboard({ ...room });
        }
    }, [selectedRoomId, rooms]);

    // Paste room from clipboard
    const pasteRoom = useCallback(() => {
        if (!clipboard) return;

        saveToHistory();
        const newRoom: RoomInstance = {
            ...clipboard,
            id: `${clipboard.type}-copy-${Date.now()}`,
            label: `${clipboard.label} (Copy)`,
            x: clipboard.x + 40,
            y: clipboard.y + 40,
            parentRoomId: undefined, // Don't inherit parent relationship
            isEnSuite: false
        };

        setRooms(prev => [...prev, newRoom]);
        setSelectedRoomId(newRoom.id);
    }, [clipboard, saveToHistory]);

    // Duplicate selected room (copy + paste in one action)
    const duplicateSelectedRoom = useCallback(() => {
        if (!selectedRoomId) return;
        const room = rooms.find(r => r.id === selectedRoomId);
        if (!room) return;

        saveToHistory();
        const newRoom: RoomInstance = {
            ...room,
            id: `${room.type}-dup-${Date.now()}`,
            label: `${room.label} (Copy)`,
            x: room.x + 40,
            y: room.y + 40,
            parentRoomId: undefined,
            isEnSuite: false
        };

        setRooms(prev => [...prev, newRoom]);
        setSelectedRoomId(newRoom.id);
    }, [selectedRoomId, rooms, saveToHistory]);

    // Rotate selected room (swap width and length)
    const rotateSelectedRoom = useCallback(() => {
        if (!selectedRoomId) return;

        saveToHistory();
        setRooms(prev => prev.map(room => {
            if (room.id === selectedRoomId) {
                return {
                    ...room,
                    width: room.length,
                    length: room.width
                };
            }
            return room;
        }));
    }, [selectedRoomId, saveToHistory]);

    // Calculate alignment guides when dragging
    const calculateAlignmentGuides = useCallback((draggedRoom: RoomInstance) => {
        const horizontal: number[] = [];
        const vertical: number[] = [];
        const threshold = 10; // Pixels tolerance for snapping

        rooms.forEach(room => {
            if (room.id === draggedRoom.id) return;

            const roomRight = room.x + room.width * PIXELS_PER_METER;
            const roomBottom = room.y + room.length * PIXELS_PER_METER;
            const draggedRight = draggedRoom.x + draggedRoom.width * PIXELS_PER_METER;
            const draggedBottom = draggedRoom.y + draggedRoom.length * PIXELS_PER_METER;

            // Check vertical alignment (left edges, right edges, centers)
            if (Math.abs(room.x - draggedRoom.x) < threshold) vertical.push(room.x);
            if (Math.abs(roomRight - draggedRight) < threshold) vertical.push(roomRight);
            if (Math.abs(room.x - draggedRight) < threshold) vertical.push(room.x);
            if (Math.abs(roomRight - draggedRoom.x) < threshold) vertical.push(roomRight);

            // Check horizontal alignment (top edges, bottom edges, centers)
            if (Math.abs(room.y - draggedRoom.y) < threshold) horizontal.push(room.y);
            if (Math.abs(roomBottom - draggedBottom) < threshold) horizontal.push(roomBottom);
            if (Math.abs(room.y - draggedBottom) < threshold) horizontal.push(room.y);
            if (Math.abs(roomBottom - draggedRoom.y) < threshold) horizontal.push(roomBottom);
        });

        setAlignmentGuides({ horizontal: [...new Set(horizontal)], vertical: [...new Set(vertical)] });
    }, [rooms]);

    // Resize handlers
    const handleResizeStart = (e: React.MouseEvent, roomId: string) => {
        e.stopPropagation();
        e.preventDefault();

        const room = rooms.find(r => r.id === roomId);
        if (!room) return;

        saveToHistory();
        handleRoomSelect(roomId);

        setResizingId(roomId);
        setResizeStartDims({
            w: room.width,
            l: room.length,
            mouseX: e.clientX,
            mouseY: e.clientY
        });
    };

    // Drag handlers
    const handleMouseDown = (e: React.MouseEvent, roomId: string) => {
        e.stopPropagation();
        handleRoomSelect(roomId);

        const room = rooms.find(r => r.id === roomId);
        if (!room) return;

        setDragStartRooms(rooms);
        setDraggingId(roomId);
        setDragOffset({
            x: e.clientX - room.x,
            y: e.clientY - room.y
        });
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (draggingId) {
            setRooms(prev => prev.map(room => {
                if (room.id === draggingId) {
                    // Account for zoom level in position calculation
                    let newX = (e.clientX - dragOffset.x) / zoom;
                    let newY = (e.clientY - dragOffset.y) / zoom;

                    // Apply grid snapping
                    if (snapToGrid) {
                        newX = snapToGridPosition(newX);
                        newY = snapToGridPosition(newY);
                    }

                    // Keep rooms in bounds
                    newX = Math.max(0, newX);
                    newY = Math.max(0, newY);

                    // Future: Alignment guides logic here

                    return { ...room, x: newX, y: newY };
                }
                return room;
            }));

            // Calculate alignment guides for visual feedback
            if (draggingId) {
                const room = rooms.find(r => r.id === draggingId);
                if (room) {
                    // We need the *new* position here for guides, but we only have current.
                    // The effect will be slightly lagged or we calculate guides based on current drag pos.
                    // For now, let's just trigger guide calc based on drag.
                    const draggedRoom = {
                        ...room,
                        x: (e.clientX - dragOffset.x) / zoom,
                        y: (e.clientY - dragOffset.y) / zoom
                    };
                    calculateAlignmentGuides(draggedRoom);
                }
            }

        } else if (resizingId && resizeStartDims) {
            const dx = e.clientX - resizeStartDims.mouseX;
            const dy = e.clientY - resizeStartDims.mouseY;

            // Snap to 0.1m increments
            const dw = dx / PIXELS_PER_METER;
            const dl = dy / PIXELS_PER_METER;

            setRooms(prev => prev.map(room => {
                if (room.id === resizingId) {
                    return {
                        ...room,
                        width: Math.max(0.5, Number((resizeStartDims.w + dw).toFixed(1))),
                        length: Math.max(0.5, Number((resizeStartDims.l + dl).toFixed(1)))
                    };
                }
                return room;
            }));
        }
    }, [draggingId, dragOffset, resizingId, resizeStartDims, zoom, snapToGridPosition, snapToGrid, rooms, calculateAlignmentGuides]);

    // Keyboard shortcuts handler (Moved from top to access all functions)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't handle if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Undo: Ctrl/Cmd + Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
                return;
            }

            // Copy: Ctrl/Cmd + C
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedRoomId) {
                e.preventDefault();
                copySelectedRoom();
                return;
            }

            // Paste: Ctrl/Cmd + V
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                pasteRoom();
                return;
            }

            // Duplicate: Ctrl/Cmd + D
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedRoomId) {
                e.preventDefault();
                duplicateSelectedRoom();
                return;
            }

            // Rotate: R
            if ((e.key === 'r' || e.key === 'R') && selectedRoomId) {
                e.preventDefault();
                rotateSelectedRoom();
                return;
            }

            // Delete selected room
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRoomId) {
                e.preventDefault();
                removeSelectedRoom();
                return;
            }

            // Arrow keys to move selected room
            if (selectedRoomId) {
                switch (e.key) {
                    case 'ArrowUp':
                        e.preventDefault();
                        moveSelectedRoom(0, -1);
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        moveSelectedRoom(0, 1);
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        moveSelectedRoom(-1, 0);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        moveSelectedRoom(1, 0);
                        break;
                }
            }

            // Escape to deselect
            if (e.key === 'Escape') {
                setSelectedRoomId(null);
                setShowRoomPicker(false);
                cancelConnectionMode();
            }

            // + and - for zoom
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                zoomIn();
            }
            if (e.key === '-') {
                e.preventDefault();
                zoomOut();
            }

            // G to toggle grid snap
            if (e.key === 'g' || e.key === 'G') {
                setSnapToGrid(prev => !prev);
            }

            // ? for help
            if (e.key === '?' && e.shiftKey) {
                e.preventDefault();
                setShowHelpModal(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        undo,
        redo,
        selectedRoomId,
        moveSelectedRoom,
        zoomIn,
        zoomOut,
        copySelectedRoom,
        pasteRoom,
        duplicateSelectedRoom,
        rotateSelectedRoom,
        removeSelectedRoom
    ]);

    const handleMouseUp = useCallback(() => {
        if (draggingId && dragStartRooms) {
            // Check if room moved
            const currentRoom = rooms.find(r => r.id === draggingId);
            const startRoom = dragStartRooms.find(r => r.id === draggingId);

            if (currentRoom && startRoom && (currentRoom.x !== startRoom.x || currentRoom.y !== startRoom.y)) {
                // Room moved! Push OLD state (dragStartRooms) to past
                setPast(prev => [...prev, dragStartRooms]);
                setFuture([]);
            }
        }
        setDraggingId(null);
        setDragStartRooms(null);
        setResizingId(null);
        setResizeStartDims(null);
    }, [draggingId, dragStartRooms, rooms]);

    // Global event listeners for drag
    useEffect(() => {
        if (draggingId || resizingId) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingId, resizingId, handleMouseMove, handleMouseUp]);

    // Auto-adjust room sizes to meet target floor area
    const autoAdjustRooms = () => {
        saveToHistory();

        const currentTotalArea = rooms.reduce((acc, r) => acc + (r.length * r.width), 0);
        if (currentTotalArea === 0) return;

        const scaleFactor = targetFloorArea / currentTotalArea;
        const sqrtScale = Math.sqrt(scaleFactor); // Scale both dimensions proportionally

        setRooms(prev => prev.map(room => ({
            ...room,
            length: Math.round(room.length * sqrtScale * 10) / 10, // Round to 1 decimal
            width: Math.round(room.width * sqrtScale * 10) / 10
        })));
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '600px',
            height: 'auto',
            maxHeight: 'calc(100vh - 80px)',
            background: '#f3f4f6',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            margin: '0 auto',
            width: '100%'
        }}>

            {/* Header Bar - Always Visible */}
            <div style={{
                background: '#fff',
                padding: '16px 24px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                zIndex: 20,
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={onBack}
                        style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        <CaretLeft size={16} />
                    </button>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        STEP 3/5: ROOM DETAILS
                    </div>

                    {/* Undo / Redo Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #e5e7eb', paddingLeft: '12px' }}>
                        <button
                            onClick={undo}
                            disabled={past.length === 0}
                            style={{
                                padding: '6px',
                                background: past.length > 0 ? '#fff' : '#f3f4f6',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: past.length > 0 ? 'pointer' : 'not-allowed',
                                color: past.length > 0 ? '#374151' : '#9ca3af',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title="Undo"
                        >
                            <ArrowCounterClockwise size={16} />
                        </button>
                        <button
                            onClick={redo}
                            disabled={future.length === 0}
                            style={{
                                padding: '6px',
                                background: future.length > 0 ? '#fff' : '#f3f4f6',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: future.length > 0 ? 'pointer' : 'not-allowed',
                                color: future.length > 0 ? '#374151' : '#9ca3af',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title="Redo (Ctrl+Shift+Z)"
                        >
                            <ArrowClockwise size={16} />
                        </button>
                    </div>

                    {/* Zoom Controls */}
                    {!isMobile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #e5e7eb', paddingLeft: '12px' }}>
                            <button
                                onClick={zoomOut}
                                disabled={zoom <= MIN_ZOOM}
                                style={{
                                    padding: '6px',
                                    background: zoom > MIN_ZOOM ? '#fff' : '#f3f4f6',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    cursor: zoom > MIN_ZOOM ? 'pointer' : 'not-allowed',
                                    color: zoom > MIN_ZOOM ? '#374151' : '#9ca3af',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title="Zoom Out (-)"
                            >
                                <MagnifyingGlassMinus size={16} />
                            </button>
                            <button
                                onClick={resetZoom}
                                style={{
                                    padding: '4px 8px',
                                    background: zoom === 1 ? '#f3f4f6' : '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#374151',
                                    minWidth: '48px'
                                }}
                                title="Reset Zoom"
                            >
                                {Math.round(zoom * 100)}%
                            </button>
                            <button
                                onClick={zoomIn}
                                disabled={zoom >= MAX_ZOOM}
                                style={{
                                    padding: '6px',
                                    background: zoom < MAX_ZOOM ? '#fff' : '#f3f4f6',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    cursor: zoom < MAX_ZOOM ? 'pointer' : 'not-allowed',
                                    color: zoom < MAX_ZOOM ? '#374151' : '#9ca3af',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title="Zoom In (+)"
                            >
                                <MagnifyingGlassPlus size={16} />
                            </button>
                            <button
                                onClick={() => setSnapToGrid(!snapToGrid)}
                                style={{
                                    padding: '6px',
                                    background: snapToGrid ? '#dcfce7' : '#fff',
                                    border: `1px solid ${snapToGrid ? '#86efac' : '#e5e7eb'}`,
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    color: snapToGrid ? '#166534' : '#9ca3af',
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginLeft: '4px'
                                }}
                                title={`Grid Snap: ${snapToGrid ? 'ON' : 'OFF'} (G)`}
                            >
                                <GridFour size={16} weight={snapToGrid ? 'fill' : 'regular'} />
                            </button>
                            <button
                                onClick={() => setShowHelpModal(true)}
                                style={{
                                    padding: '6px',
                                    background: showHelpModal ? '#e0f2fe' : '#fff',
                                    border: `1px solid ${showHelpModal ? '#3b82f6' : '#e5e7eb'}`,
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    color: showHelpModal ? '#1d4ed8' : '#374151',
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginLeft: '4px'
                                }}
                                title="Keyboard Shortcuts (Shift + ?)"
                            >
                                <Question size={16} weight="bold" />
                            </button>

                            {/* Connection Mode Button */}
                            <button
                                onClick={connectionMode === 'none' ? startConnectionMode : cancelConnectionMode}
                                style={{
                                    padding: '6px 10px',
                                    background: connectionMode !== 'none' ? '#fef3c7' : '#fff',
                                    border: `1px solid ${connectionMode !== 'none' ? '#fcd34d' : '#e5e7eb'}`,
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    color: connectionMode !== 'none' ? '#92400e' : '#374151',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600
                                }}
                                title="Add passage between rooms"
                            >
                                <LinkSimple size={14} weight={connectionMode !== 'none' ? 'fill' : 'regular'} />
                                {connectionMode === 'none'
                                    ? 'Passage'
                                    : connectionMode === 'selecting-first'
                                        ? 'Select 1st room...'
                                        : 'Select 2nd room...'}
                            </button>
                        </div>
                    )}
                    {loadedFromStorage && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '4px 10px',
                            background: '#dbeafe',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#1e40af'
                        }}>
                            <FloppyDisk size={14} weight="fill" />
                            Loaded from saved
                            <button
                                onClick={clearSavedData}
                                style={{
                                    marginLeft: '4px',
                                    padding: '2px 6px',
                                    background: '#1e40af',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                                title="Clear saved data and start fresh"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>

                {/* Target Area Indicator */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '8px' : '16px',
                    background: isOverTarget ? '#fef2f2' : isUnderTarget ? '#fffbeb' : '#f0fdf4',
                    padding: isMobile ? '6px 10px' : '8px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${isOverTarget ? '#fecaca' : isUnderTarget ? '#fde68a' : '#bbf7d0'}`
                }}>
                    {isOverTarget ? (
                        <Warning size={isMobile ? 16 : 18} color="#dc2626" weight="fill" />
                    ) : isUnderTarget ? (
                        <Warning size={isMobile ? 16 : 18} color="#d97706" weight="fill" />
                    ) : (
                        <CheckCircle size={isMobile ? 16 : 18} color="#16a34a" weight="fill" />
                    )}
                    <div>
                        <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                            Target: {targetFloorArea}m²
                        </div>
                        <div style={{
                            fontSize: isMobile ? '12px' : '13px',
                            fontWeight: 700,
                            color: isOverTarget ? '#dc2626' : isUnderTarget ? '#d97706' : '#16a34a'
                        }}>
                            {isOverTarget ? `${Math.abs(areaDiff).toFixed(1)}m² over` :
                                isUnderTarget ? `${areaDiff.toFixed(1)}m² remaining` :
                                    'Target met!'}
                        </div>
                    </div>
                    {isUnderTarget && (
                        <button
                            onClick={autoAdjustRooms}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: isMobile ? '4px 8px' : '6px 12px',
                                background: '#fbbf24',
                                color: '#1f2937',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: isMobile ? '11px' : '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            title="Auto-adjust room sizes to meet target"
                        >
                            <MagicWand size={14} weight="bold" />
                            Auto-Fit
                        </button>
                    )}
                </div>

                {/* Progress Dots */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {!isMobile && [1, 2, 3, 4, 5].map(step => (
                        <div key={step} style={{
                            width: step === 3 ? '24px' : '8px',
                            height: '4px',
                            borderRadius: '2px',
                            background: step <= 3 ? '#10b981' : '#e5e7eb',
                            transition: 'all 0.3s'
                        }} />
                    ))}
                    {/* Mobile sidebar toggle */}
                    {isMobile && (
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 12px',
                                background: sidebarOpen ? '#10b981' : '#f3f4f6',
                                color: sidebarOpen ? '#fff' : '#374151',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <List size={16} weight="bold" />
                            {sidebarOpen ? 'Hide Details' : 'Edit Room'}
                        </button>
                    )}
                </div>
            </div>

            <div style={{
                display: 'flex',
                flex: 1,
                overflow: 'hidden',
                minHeight: 0,
                flexDirection: isMobile ? 'column' : 'row',
                position: 'relative'
            }}>

                {/* Left: Canvas Area */}
                <div
                    ref={canvasRef}
                    onWheel={handleWheel}
                    tabIndex={0}
                    style={{
                        flex: isMobile && sidebarOpen ? '0 0 auto' : 1,
                        position: 'relative',
                        overflow: 'auto',
                        padding: isMobile ? '20px' : '40px',
                        display: isMobile && sidebarOpen ? 'none' : 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundImage: `radial-gradient(#d1d5db 1px, transparent 1px)`,
                        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                        minHeight: isMobile ? '300px' : 'auto',
                        outline: 'none'
                    }}
                >
                    {/* Compass / North Indicator */}
                    <div style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        width: '48px',
                        height: '48px',
                        background: 'white',
                        borderRadius: '50%',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #e5e7eb',
                        zIndex: 5
                    }}>
                        {/* North arrow */}
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {/* Arrow pointing up (North) */}
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute' }}>
                                <path
                                    d="M12 4L16 12H8L12 4Z"
                                    fill="#dc2626"
                                    stroke="#991b1b"
                                    strokeWidth="1"
                                />
                                <path
                                    d="M12 12L16 20H8L12 12Z"
                                    fill="#f3f4f6"
                                    stroke="#6b7280"
                                    strokeWidth="1"
                                />
                            </svg>
                            {/* N label */}
                            <div style={{
                                position: 'absolute',
                                top: '2px',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#dc2626'
                            }}>
                                N
                            </div>
                        </div>
                    </div>

                    {/* Add Room Button */}
                    <div style={{ marginBottom: '24px', position: 'relative' }}>
                        <button
                            onClick={() => setShowRoomPicker(!showRoomPicker)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                background: showRoomPicker ? '#e5e7eb' : '#fff',
                                border: '2px dashed #9ca3af',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#374151',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {showRoomPicker ? <X size={18} /> : <Plus size={18} />}
                            {showRoomPicker ? 'Close' : 'Add Room'}
                        </button>

                        {/* Room Picker Dropdown */}
                        {showRoomPicker && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                marginTop: '8px',
                                background: '#fff',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                border: '1px solid #e5e7eb',
                                padding: '8px',
                                zIndex: 100,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '4px',
                                minWidth: '280px'
                            }}>
                                {ROOM_TYPES.map(type => (
                                    <button
                                        key={type.key}
                                        onClick={() => addRoom(type.key)}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#f9fafb',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            color: '#374151',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#eff6ff';
                                            e.currentTarget.style.borderColor = '#3b82f6';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#f9fafb';
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                        }}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/** Visual Room Layout Grid / Canvas */}
                    <div style={{
                        display: isMobile ? 'grid' : 'block',
                        gridTemplateColumns: isMobile
                            ? 'repeat(auto-fit, minmax(120px, 1fr))'
                            : 'none',
                        gap: isMobile ? '12px' : '0',
                        width: '100%',
                        maxWidth: '700px',
                        perspective: '1000px',
                        position: 'relative',
                        height: isMobile ? 'auto' : '600px',
                        background: isMobile ? 'transparent' : '#f0f9ff',
                        borderRadius: '12px',
                        border: isMobile ? 'none' : '2px dashed #bfdbfe',
                        transform: isMobile ? 'none' : `scale(${zoom})`,
                        transformOrigin: 'top left',
                        transition: 'transform 0.15s ease-out'
                    }}>
                        {/* Connection Lines SVG Overlay */}
                        {!isMobile && connections.length > 0 && (
                            <svg
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: 'none',
                                    zIndex: 0
                                }}
                            >
                                <defs>
                                    <marker
                                        id="passage-dot"
                                        viewBox="0 0 10 10"
                                        refX="5"
                                        refY="5"
                                        markerWidth="6"
                                        markerHeight="6"
                                    >
                                        <circle cx="5" cy="5" r="4" fill="#a855f7" />
                                    </marker>
                                </defs>
                                {connections.map(conn => {
                                    const line = getConnectionLine(conn);
                                    if (!line) return null;

                                    return (
                                        <g key={conn.id}>
                                            <line
                                                x1={line.x1}
                                                y1={line.y1}
                                                x2={line.x2}
                                                y2={line.y2}
                                                stroke="#a855f7"
                                                strokeWidth="3"
                                                strokeDasharray="8 4"
                                                markerStart="url(#passage-dot)"
                                                markerEnd="url(#passage-dot)"
                                            />
                                            {/* Connection label with icon */}
                                            <g
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => removeConnection(conn.id)}
                                            >
                                                <rect
                                                    x={(line.x1 + line.x2) / 2 - 32}
                                                    y={(line.y1 + line.y2) / 2 - 18}
                                                    width="64"
                                                    height="16"
                                                    rx="4"
                                                    fill="#f5f3ff"
                                                    stroke="#a855f7"
                                                    strokeWidth="1"
                                                    style={{ pointerEvents: 'auto' }}
                                                />
                                                {/* Door icon path */}
                                                <path
                                                    d={`M${(line.x1 + line.x2) / 2 - 26} ${(line.y1 + line.y2) / 2 - 14} h8 v10 h-8 z`}
                                                    fill="none"
                                                    stroke="#7c3aed"
                                                    strokeWidth="1.5"
                                                />
                                                <circle
                                                    cx={(line.x1 + line.x2) / 2 - 20}
                                                    cy={(line.y1 + line.y2) / 2 - 9}
                                                    r="1"
                                                    fill="#7c3aed"
                                                />
                                                <text
                                                    x={(line.x1 + line.x2) / 2 + 4}
                                                    y={(line.y1 + line.y2) / 2 - 7}
                                                    textAnchor="middle"
                                                    fill="#7c3aed"
                                                    fontSize="9"
                                                    fontWeight="600"
                                                    style={{ pointerEvents: 'none' }}
                                                >
                                                    Passage
                                                </text>
                                            </g>
                                        </g>
                                    );
                                })}
                            </svg>
                        )}
                        {/* Alignment Guides Overlay */}
                        {(alignmentGuides.horizontal.length > 0 || alignmentGuides.vertical.length > 0) && (
                            <svg
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: 'none',
                                    zIndex: 10
                                }}
                            >
                                {alignmentGuides.horizontal.map((y, i) => (
                                    <line
                                        key={`h-${i}`}
                                        x1={0}
                                        y1={y * PIXELS_PER_METER}
                                        x2="100%"
                                        y2={y * PIXELS_PER_METER}
                                        stroke="#f43f5e"
                                        strokeWidth="1"
                                        strokeDasharray="4 2"
                                    />
                                ))}
                                {alignmentGuides.vertical.map((x, i) => (
                                    <line
                                        key={`v-${i}`}
                                        x1={x * PIXELS_PER_METER}
                                        y1={0}
                                        x2={x * PIXELS_PER_METER}
                                        y2="100%"
                                        stroke="#f43f5e"
                                        strokeWidth="1"
                                        strokeDasharray="4 2"
                                    />
                                ))}
                            </svg>
                        )}
                        {rooms.length === 0 ? (
                            <div style={{
                                gridColumn: '1/-1',
                                textAlign: 'center',
                                color: '#9ca3af',
                                marginTop: '40px',
                                position: isMobile ? 'static' : 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: isMobile ? 'none' : 'translate(-50%, -50%)',
                                width: '100%'
                            }}>
                                <Square size={48} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
                                <p>No rooms added yet. Click &quot;Add Room&quot; above.</p>
                            </div>
                        ) : (
                            rooms.map((room) => {
                                const isSelected = room.id === selectedRoomId;
                                const isDragging = room.id === draggingId;
                                const hasOverlap = roomCollisions[room.id] || false;
                                const roomColors = getRoomTypeColor(room.type);
                                const isConnectionTarget = connectionMode !== 'none';
                                const isFirstSelected = connectionFirstRoom === room.id;

                                // Determine border color based on state
                                let borderStyle = `2px solid ${roomColors.color}`;
                                if (hasOverlap) {
                                    borderStyle = '2px solid #ef4444'; // Red for collision
                                } else if (isDragging) {
                                    borderStyle = '2px dashed #22c55e';
                                } else if (isSelected) {
                                    borderStyle = '2px solid #22c55e';
                                } else if (isFirstSelected) {
                                    borderStyle = '3px solid #f59e0b'; // Amber for first connection selection
                                } else if (isConnectionTarget) {
                                    borderStyle = `2px dashed ${roomColors.color}`;
                                }

                                // Determine background based on state
                                let bgColor = roomColors.bgColor;
                                if (hasOverlap) {
                                    bgColor = '#fef2f2'; // Light red for collision
                                } else if (isSelected) {
                                    bgColor = '#dcfce7';
                                } else if (isFirstSelected) {
                                    bgColor = '#fef3c7'; // Amber bg for first selection
                                }

                                // Handle click based on mode
                                const handleClick = () => {
                                    if (connectionMode !== 'none') {
                                        handleConnectionClick(room.id);
                                    } else {
                                        handleRoomSelect(room.id);
                                    }
                                };

                                return (
                                    <div
                                        key={room.id}
                                        onMouseDown={(e) => !isMobile && connectionMode === 'none' && handleMouseDown(e, room.id)}
                                        onClick={handleClick}
                                        style={{
                                            // Layout
                                            position: isMobile ? 'relative' : 'absolute',
                                            left: isMobile ? 'auto' : `${room.x}px`,
                                            top: isMobile ? 'auto' : `${room.y}px`,
                                            zIndex: isDragging ? 10 : (isSelected ? 5 : 1),

                                            // Dimensions
                                            width: isMobile ? 'auto' : `${room.width * PIXELS_PER_METER}px`,
                                            height: isMobile ? 'auto' : `${room.length * PIXELS_PER_METER}px`,
                                            minWidth: isMobile ? 'auto' : '60px',
                                            minHeight: isMobile ? 'auto' : '60px',

                                            // Visuals
                                            background: bgColor,
                                            border: borderStyle,
                                            borderRadius: '4px',

                                            // Flex content
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',

                                            // Interaction
                                            cursor: isMobile ? 'pointer' : (isDragging ? 'grabbing' : 'grab'),
                                            userSelect: 'none',
                                            boxShadow: hasOverlap
                                                ? '0 0 0 3px rgba(239, 68, 68, 0.3)'
                                                : isDragging
                                                    ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                                                    : (isSelected ? '0 10px 15px -3px rgba(34, 197, 94, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'),
                                            transition: isDragging ? 'none' : 'all 0.2s',
                                            transform: isMobile ? (isSelected ? 'scale(1.05)' : 'scale(1)') : 'none',
                                            padding: '12px'
                                        }}
                                    >
                                        {isSelected && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '-12px',
                                                background: '#1f2937',
                                                color: '#fff',
                                                fontSize: '10px',
                                                padding: '4px 8px',
                                                borderRadius: '12px',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                            }}>
                                                Click to Edit
                                            </div>
                                        )}

                                        {/* Live Dimension Labels on Edges */}
                                        {!isMobile && (
                                            <>
                                                {/* Width label (top) */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '-20px',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    background: roomColors.color,
                                                    color: '#fff',
                                                    fontSize: '9px',
                                                    fontWeight: 700,
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    whiteSpace: 'nowrap',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                                }}>
                                                    {room.width}m
                                                </div>

                                                {/* Length label (right) */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    right: '-22px',
                                                    transform: 'translateY(-50%) rotate(90deg)',
                                                    background: roomColors.color,
                                                    color: '#fff',
                                                    fontSize: '9px',
                                                    fontWeight: 700,
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    whiteSpace: 'nowrap',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                                }}>
                                                    {room.length}m
                                                </div>
                                            </>
                                        )}

                                        {/* En-suite indicator badge */}
                                        {room.isEnSuite && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '4px',
                                                left: '4px',
                                                background: '#a855f7',
                                                color: '#fff',
                                                fontSize: '7px',
                                                fontWeight: 700,
                                                padding: '2px 4px',
                                                borderRadius: '3px',
                                                textTransform: 'uppercase'
                                            }}>
                                                En-suite
                                            </div>
                                        )}

                                        {/* Door Edge Indicators - Bottom edge */}
                                        {Array.from({ length: room.doors }).map((_, i) => (
                                            <div
                                                key={`door-${i}`}
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '-2px',
                                                    left: `${20 + i * 25}%`,
                                                    width: '20%',
                                                    maxWidth: '40px',
                                                    height: '6px',
                                                    background: '#a16207',
                                                    borderRadius: '0 0 3px 3px',
                                                    border: '1px solid #854d0e',
                                                    borderTop: 'none',
                                                    zIndex: 2
                                                }}
                                                title={`Door ${i + 1}`}
                                            />
                                        ))}

                                        {/* Window Edge Indicators - Left edge */}
                                        {Array.from({ length: room.windows }).map((_, i) => (
                                            <div
                                                key={`window-${i}`}
                                                style={{
                                                    position: 'absolute',
                                                    left: '-2px',
                                                    top: `${20 + i * 25}%`,
                                                    width: '6px',
                                                    height: '18%',
                                                    maxHeight: '30px',
                                                    background: 'linear-gradient(135deg, #93c5fd, #3b82f6)',
                                                    borderRadius: '3px 0 0 3px',
                                                    border: '1px solid #2563eb',
                                                    borderRight: 'none',
                                                    zIndex: 2
                                                }}
                                                title={`Window ${i + 1}`}
                                            />
                                        ))}

                                        {/* Room Label */}
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            color: isSelected ? '#166534' : '#475569',
                                            textTransform: 'uppercase',
                                            textAlign: 'center',
                                            marginBottom: '4px'
                                        }}>
                                            {room.label}
                                        </span>

                                        {/* Dimensions */}
                                        <span style={{
                                            fontSize: '10px',
                                            color: isSelected ? '#166534' : '#94a3b8',
                                            marginBottom: '8px'
                                        }}>
                                            {room.length}m × {room.width}m
                                        </span>

                                        {/* Door & Window Icons */}
                                        <div style={{
                                            display: 'flex',
                                            gap: '12px',
                                            alignItems: 'center',
                                            marginTop: 'auto'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 8px',
                                                background: isSelected ? '#bbf7d0' : '#f1f5f9',
                                                borderRadius: '4px'
                                            }}>
                                                <FrameCorners size={14} color={isSelected ? '#166534' : '#64748b'} />
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    color: isSelected ? '#166534' : '#64748b'
                                                }}>
                                                    {room.windows}
                                                </span>
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 8px',
                                                background: isSelected ? '#bbf7d0' : '#f1f5f9',
                                                borderRadius: '4px'
                                            }}>
                                                <Door size={14} color={isSelected ? '#166534' : '#64748b'} />
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    color: isSelected ? '#166534' : '#64748b'
                                                }}>
                                                    {room.doors}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Resize Handle (Bottom Right) */}
                                        {!isMobile && isSelected && (
                                            <div
                                                onMouseDown={(e) => handleResizeStart(e, room.id)}
                                                style={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    right: 0,
                                                    width: '24px',
                                                    height: '24px',
                                                    cursor: 'nwse-resize',
                                                    zIndex: 20,
                                                    display: 'flex',
                                                    alignItems: 'end',
                                                    justifyContent: 'end',
                                                    padding: '4px'
                                                }}
                                            >
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round">
                                                    <path d="M22 22L10 10" />
                                                    <path d="M22 15L15 22" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>


                </div>

                {/* Right: Sidebar Panel */}
                <div style={{
                    width: isMobile ? '100%' : '320px',
                    background: '#fff',
                    borderLeft: isMobile ? 'none' : '1px solid #e5e7eb',
                    display: sidebarOpen ? 'flex' : 'none',
                    flexDirection: 'column',
                    zIndex: 10,
                    position: isMobile ? 'absolute' : 'relative',
                    top: isMobile ? 0 : 'auto',
                    left: isMobile ? 0 : 'auto',
                    right: isMobile ? 0 : 'auto',
                    bottom: isMobile ? 0 : 'auto',
                    boxShadow: isMobile ? '0 -4px 20px rgba(0,0,0,0.1)' : 'none',
                    overflowY: 'auto'
                }}>
                    {/* Mobile close button */}
                    {isMobile && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '16px 20px',
                            borderBottom: '1px solid #e5e7eb',
                            background: '#f9fafb'
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>
                                Room Details
                            </span>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    background: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}
                    {selectedRoom ? (
                        <div style={{ padding: isMobile ? '20px' : '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                        width: '4px',
                                        height: '24px',
                                        background: '#10b981',
                                        borderRadius: '0 4px 4px 0'
                                    }} />
                                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: '#1f2937' }}>
                                        {selectedRoom.label} Details
                                    </h3>
                                </div>
                                <button
                                    onClick={removeSelectedRoom}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        border: '1px solid #fecaca',
                                        borderRadius: '6px',
                                        background: '#fef2f2',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: '#dc2626'
                                    }}
                                    title="Remove this room"
                                >
                                    <Trash size={16} />
                                </button>
                            </div>

                            {/* Add En-suite Section */}
                            {!selectedRoom.isEnSuite && (
                                <div style={{ marginBottom: '20px', position: 'relative' }}>
                                    <button
                                        onClick={() => setShowEnSuitePicker(!showEnSuitePicker)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '10px',
                                            width: '100%',
                                            background: showEnSuitePicker ? '#ecfeff' : '#f0f9ff',
                                            border: `1px dashed ${showEnSuitePicker ? '#06b6d4' : '#3b82f6'}`,
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            color: showEnSuitePicker ? '#0891b2' : '#2563eb',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Plus size={14} weight="bold" />
                                        Add En-suite / Sub-room
                                    </button>

                                    {showEnSuitePicker && (
                                        <div style={{
                                            marginTop: '8px',
                                            padding: '12px',
                                            background: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            display: 'grid',
                                            gridTemplateColumns: '1fr',
                                            gap: '8px'
                                        }}>
                                            {ENSUITE_TYPES.map(type => (
                                                <button
                                                    key={type.key}
                                                    onClick={() => addEnSuiteRoom(type.key)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        padding: '10px 12px',
                                                        background: type.bgColor,
                                                        border: `1px solid ${type.color}40`,
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        color: '#1f2937',
                                                        cursor: 'pointer',
                                                        textAlign: 'left',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {type.icon === 'toilet' && <Toilet size={18} color={type.color} weight="fill" />}
                                                    {type.icon === 'bathtub' && <Bathtub size={18} color={type.color} weight="fill" />}
                                                    {type.icon === 'closet' && <Door size={18} color={type.color} weight="fill" />}
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{type.label}</div>
                                                        <div style={{ fontSize: '10px', color: '#6b7280' }}>
                                                            {type.defaultDims.l}m × {type.defaultDims.w}m
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Show existing en-suites */}
                                    {rooms.filter(r => r.parentRoomId === selectedRoom.id).length > 0 && (
                                        <div style={{ marginTop: '12px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                Attached Rooms:
                                            </div>
                                            {rooms.filter(r => r.parentRoomId === selectedRoom.id).map(ensuite => (
                                                <div
                                                    key={ensuite.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '8px 10px',
                                                        background: getRoomTypeColor(ensuite.type).bgColor,
                                                        border: `1px solid ${getRoomTypeColor(ensuite.type).color}40`,
                                                        borderRadius: '6px',
                                                        marginBottom: '6px',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 500 }}>{ensuite.label}</span>
                                                    <button
                                                        onClick={() => {
                                                            saveToHistory();
                                                            setConnections(prev => prev.filter(c => c.fromRoomId !== ensuite.id && c.toRoomId !== ensuite.id));
                                                            setRooms(prev => prev.filter(r => r.id !== ensuite.id));
                                                        }}
                                                        style={{
                                                            padding: '4px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: '#dc2626'
                                                        }}
                                                        title="Remove"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Wall Material */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                                    Wall Material:
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {BRICK_TYPES.map(type => (
                                        <div
                                            key={type.id}
                                            onClick={() => updateSelectedRoom({ materialId: type.id })}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '10px',
                                                background: (selectedRoom.materialId || 'brick-common') === type.id ? '#eff6ff' : '#fff',
                                                border: `1px solid ${(selectedRoom.materialId || 'brick-common') === type.id ? '#3b82f6' : '#e5e7eb'}`,
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '4px',
                                                background: type.color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff',
                                                fontSize: '10px',
                                                fontWeight: 700
                                            }}>
                                                {type.label.charAt(0)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{type.label}</div>
                                                <div style={{ fontSize: '11px', color: '#6b7280' }}>~{type.rate} units per m²</div>
                                            </div>
                                            {(selectedRoom.materialId || 'brick-common') === type.id && (
                                                <CheckCircle size={18} weight="fill" color="#3b82f6" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Dimensions */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                                    Dimensions (m):
                                </label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' }}>
                                            <span style={{ padding: '8px 12px', background: '#f3f4f6', borderRight: '1px solid #d1d5db', fontSize: '13px', fontWeight: 600, color: '#374151' }}>L</span>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={selectedRoom.length}
                                                onChange={(e) => updateSelectedRoom({ length: parseFloat(e.target.value) || 0 })}
                                                style={{ width: '100%', border: 'none', padding: '8px', fontSize: '14px', outline: 'none', background: 'transparent' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' }}>
                                            <span style={{ padding: '8px 12px', background: '#f3f4f6', borderRight: '1px solid #d1d5db', fontSize: '13px', fontWeight: 600, color: '#374151' }}>W</span>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={selectedRoom.width}
                                                onChange={(e) => updateSelectedRoom({ width: parseFloat(e.target.value) || 0 })}
                                                style={{ width: '100%', border: 'none', padding: '8px', fontSize: '14px', outline: 'none', background: 'transparent' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>
                                    Area: {(selectedRoom.length * selectedRoom.width).toFixed(1)}m²
                                </div>
                            </div>

                            {/* Window Count */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                                    Window Count:
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px' }}>
                                    <button
                                        onClick={() => updateSelectedRoom({ windows: Math.max(0, selectedRoom.windows - 1) })}
                                        style={{ width: '32px', height: '32px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Minus size={14} color="#374151" />
                                    </button>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <FrameCorners size={20} color="#374151" />
                                        <span style={{ fontSize: '16px', fontWeight: 600 }}>{selectedRoom.windows}</span>
                                    </div>
                                    <button
                                        onClick={() => updateSelectedRoom({ windows: selectedRoom.windows + 1 })}
                                        style={{ width: '32px', height: '32px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Plus size={14} color="#374151" />
                                    </button>
                                </div>
                            </div>

                            {/* Door Count */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                                    Door Count:
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px' }}>
                                    <button
                                        onClick={() => updateSelectedRoom({ doors: Math.max(0, selectedRoom.doors - 1) })}
                                        style={{ width: '32px', height: '32px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Minus size={14} color="#374151" />
                                    </button>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Door size={20} color="#374151" />
                                        <span style={{ fontSize: '16px', fontWeight: 600 }}>{selectedRoom.doors}</span>
                                    </div>
                                    <button
                                        onClick={() => updateSelectedRoom({ doors: selectedRoom.doors + 1 })}
                                        style={{ width: '32px', height: '32px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Plus size={14} color="#374151" />
                                    </button>
                                </div>
                            </div>

                            {/* Material Estimates Section */}
                            <div style={{
                                marginBottom: '24px',
                                padding: '16px',
                                background: '#f9fafb',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb'
                            }}>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: '#374151',
                                    textTransform: 'uppercase',
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <path d="M3 9h18M9 21V9" />
                                    </svg>
                                    Material Estimates
                                </div>

                                {(() => {
                                    // Calculate for this specific room
                                    const perimeter = (selectedRoom.length + selectedRoom.width) * 2;
                                    const grossWallArea = perimeter * WALL_HEIGHT;
                                    const doorDeductions = selectedRoom.doors * STANDARD_DOOR_AREA;
                                    const windowDeductions = selectedRoom.windows * STANDARD_WINDOW_AREA;
                                    const netWallArea = Math.max(0, grossWallArea - doorDeductions - windowDeductions);

                                    const materialDef = BRICK_TYPES.find(b => b.id === (selectedRoom.materialId || 'brick-common')) || BRICK_TYPES[0];
                                    const units = Math.ceil(netWallArea * materialDef.rate);
                                    const cementBags = Math.ceil(netWallArea * 0.5); // 0.5 bags per m²
                                    const sandCubicMeters = (netWallArea * 0.02).toFixed(2); // 0.02 m³ per m²

                                    return (
                                        <>
                                            <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '12px' }}>
                                                Wall Area: {grossWallArea.toFixed(1)}m² - {doorDeductions.toFixed(1)}m² (doors) - {windowDeductions.toFixed(1)}m² (windows) = <strong>{netWallArea.toFixed(1)}m²</strong>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {/* Wall Units */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '8px 12px',
                                                    background: '#fff',
                                                    borderRadius: '6px'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            background: materialDef.color,
                                                            borderRadius: '2px'
                                                        }} />
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{materialDef.label}</span>
                                                    </div>
                                                    <span style={{ fontSize: '14px', fontWeight: 700, color: materialDef.color }}>
                                                        {units.toLocaleString()}
                                                    </span>
                                                </div>

                                                {/* Cement */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '8px 12px',
                                                    background: '#fff',
                                                    borderRadius: '6px'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            background: '#64748b',
                                                            borderRadius: '2px'
                                                        }} />
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Cement</span>
                                                    </div>
                                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#64748b' }}>
                                                        {cementBags} bags
                                                    </span>
                                                </div>

                                                {/* Sand */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '8px 12px',
                                                    background: '#fff',
                                                    borderRadius: '6px'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            background: '#f59e0b',
                                                            borderRadius: '2px'
                                                        }} />
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Sand</span>
                                                    </div>
                                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>
                                                        {sandCubicMeters} m³
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Save Button (Visual only, state is always live) */}
                            <button
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#1f2937',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    marginTop: 'auto',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <FloppyDisk size={18} />
                                SAVE CHANGES
                            </button>

                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '14px', padding: '40px', textAlign: 'center' }}>
                            Select a room from the plan to edit details
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Status Bar - Always Visible */}
            <div style={{
                background: '#fff',
                borderTop: '1px solid #e5e7eb',
                padding: isMobile ? '12px 16px' : '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                position: 'sticky',
                bottom: 0,
                zIndex: 20,
                flexWrap: 'wrap',
                gap: isMobile ? '12px' : '16px'
            }}>
                <div style={{ display: 'flex', gap: isMobile ? '16px' : '40px', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Total Area</div>
                        <div style={{
                            fontSize: isMobile ? '16px' : '18px',
                            fontWeight: 700,
                            color: isOverTarget ? '#dc2626' : '#10b981'
                        }}>
                            {totals.area.toFixed(1)}m²
                        </div>
                    </div>
                    {!isMobile && (
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Wall Area</div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>{totals.walls.toFixed(1)}m²</div>
                        </div>
                    )}
                    <div>
                        <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Brick Count</div>
                        <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: '#10b981' }}>~{Math.ceil(totals.bricks).toLocaleString()}</div>
                    </div>
                </div>

                <button
                    onClick={() => onContinue(rooms, totals)}
                    style={{
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)'
                    }}
                >
                    CONTINUE TO SCOPE
                    <ArrowRight size={18} weight="bold" />
                </button>
            </div>

            {/* Help Modal */}
            {showHelpModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(2px)'
                }} onClick={() => setShowHelpModal(false)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#fff',
                            borderRadius: '16px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            width: '90%',
                            maxWidth: '500px',
                            maxHeight: '80vh',
                            overflow: 'auto',
                            padding: '24px',
                            position: 'relative'
                        }}
                    >
                        <button
                            onClick={() => setShowHelpModal(false)}
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#9ca3af'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Keyboard size={24} weight="fill" color="#3b82f6" />
                            Keyboard Shortcuts
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                            {[
                                { k: 'Arrow Keys', d: 'Nudge selected room' },
                                { k: 'Delete / Backspace', d: 'Remove selected room' },
                                { k: 'Ctrl + C', d: 'Copy room' },
                                { k: 'Ctrl + V', d: 'Paste room' },
                                { k: 'Ctrl + D', d: 'Duplicate room' },
                                { k: 'R', d: 'Rotate room (swap L/W)' },
                                { k: 'Ctrl + Z', d: 'Undo' },
                                { k: 'Ctrl + Y', d: 'Redo' },
                                { k: 'G', d: 'Toggle Grid Snap' },
                                { k: '+ / -', d: 'Zoom In / Out' },
                                { k: 'Esc', d: 'Deselect / Cancel' },
                                { k: 'Shift + ?', d: 'Show this help' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: '14px', color: '#4b5563' }}>{item.d}</span>
                                    <span style={{
                                        fontFamily: 'monospace',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: '#374151',
                                        background: '#f3f4f6',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid #e5e7eb'
                                    }}>
                                        {item.k}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
