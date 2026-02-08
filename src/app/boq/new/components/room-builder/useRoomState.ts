import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    RoomInstance,
    ROOM_TYPES,
    ENSUITE_TYPES,
    BRICK_TYPES,
    PIXELS_PER_METER,
    WALL_HEIGHT,
    STANDARD_DOOR_AREA,
    STANDARD_WINDOW_AREA,
    getRoomTypeColor,
} from './types';

interface UseRoomStateOptions {
    roomCounts: { [key: string]: number };
    targetFloorArea: number;
    isMobile: boolean;
}

export function useRoomState({ roomCounts, targetFloorArea, isMobile }: UseRoomStateOptions) {
    const [rooms, setRooms] = useState<RoomInstance[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [loadedFromStorage, setLoadedFromStorage] = useState(false);

    // History state
    const [past, setPast] = useState<RoomInstance[][]>([]);
    const [future, setFuture] = useState<RoomInstance[][]>([]);

    // Clipboard
    const [clipboard, setClipboard] = useState<RoomInstance | null>(null);

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

    // Selected room
    const selectedRoom = useMemo(() =>
        rooms.find(r => r.id === selectedRoomId),
        [rooms, selectedRoomId]
    );

    // Update selected room
    const updateRoom = useCallback((roomId: string, updates: Partial<RoomInstance>) => {
        setRooms(prev => prev.map(r =>
            r.id === roomId ? { ...r, ...updates } : r
        ));
    }, []);

    const updateSelectedRoom = useCallback((updates: Partial<RoomInstance>) => {
        if (!selectedRoomId) return;
        updateRoom(selectedRoomId, updates);
    }, [selectedRoomId, updateRoom]);

    // Add a new room
    const addRoom = useCallback((typeKey: string) => {
        saveToHistory();
        const typeDef = ROOM_TYPES.find(r => r.key === typeKey);
        if (!typeDef) return;

        const existingCount = rooms.filter(r => r.type === typeKey).length;
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
            x, y,
            materialId: 'brick-common',
        };
        setRooms(prev => [...prev, newRoom]);
        setSelectedRoomId(newRoom.id);
        return newRoom;
    }, [rooms, isMobile, saveToHistory]);

    // Add en-suite
    const addEnSuiteRoom = useCallback((ensuiteTypeKey: string) => {
        if (!selectedRoomId) return;
        saveToHistory();
        const typeDef = ENSUITE_TYPES.find(r => r.key === ensuiteTypeKey);
        if (!typeDef) return;

        const parentRoom = rooms.find(r => r.id === selectedRoomId);
        if (!parentRoom) return;

        const existingEnSuites = rooms.filter(r => r.parentRoomId === selectedRoomId).length;
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
            x, y,
            materialId: 'brick-common',
            parentRoomId: selectedRoomId,
            isEnSuite: true,
        };

        setRooms(prev => [...prev, newRoom]);
    }, [selectedRoomId, rooms, saveToHistory]);

    // Remove selected room
    const removeSelectedRoom = useCallback(() => {
        if (!selectedRoomId) return;
        saveToHistory();
        setRooms(prev => prev.filter(r => r.id !== selectedRoomId && r.parentRoomId !== selectedRoomId));
        setSelectedRoomId(rooms.length > 1 ? rooms[0].id : null);
    }, [selectedRoomId, rooms, saveToHistory]);

    // Copy/paste/duplicate
    const copySelectedRoom = useCallback(() => {
        if (!selectedRoomId) return;
        const room = rooms.find(r => r.id === selectedRoomId);
        if (room) setClipboard({ ...room });
    }, [selectedRoomId, rooms]);

    const pasteRoom = useCallback(() => {
        if (!clipboard) return;
        saveToHistory();
        const newRoom: RoomInstance = {
            ...clipboard,
            id: `${clipboard.type}-copy-${Date.now()}`,
            label: `${clipboard.label} (Copy)`,
            x: clipboard.x + 40,
            y: clipboard.y + 40,
            parentRoomId: undefined,
            isEnSuite: false,
        };
        setRooms(prev => [...prev, newRoom]);
        setSelectedRoomId(newRoom.id);
    }, [clipboard, saveToHistory]);

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
            isEnSuite: false,
        };
        setRooms(prev => [...prev, newRoom]);
        setSelectedRoomId(newRoom.id);
    }, [selectedRoomId, rooms, saveToHistory]);

    // Rotate: true angle rotation
    const rotateSelectedRoom = useCallback(() => {
        if (!selectedRoomId) return;
        saveToHistory();
        setRooms(prev => prev.map(room => {
            if (room.id === selectedRoomId) {
                const newRotation = ((room.rotation || 0) + 90) % 360;
                return {
                    ...room,
                    width: room.length,
                    length: room.width,
                    rotation: newRotation,
                    ...(room.walls ? {
                        walls: {
                            top: room.walls.left,
                            right: room.walls.top,
                            bottom: room.walls.right,
                            left: room.walls.bottom,
                        }
                    } : {}),
                };
            }
            return room;
        }));
    }, [selectedRoomId, saveToHistory]);

    // Toggle wall feature
    const toggleWallFeature = useCallback((roomId: string, side: 'top' | 'right' | 'bottom' | 'left') => {
        saveToHistory();
        setRooms(prev => prev.map(room => {
            if (room.id !== roomId) return room;
            const currentWalls = room.walls || { top: 'solid', right: 'solid', bottom: 'solid', left: 'solid' };
            const cycle = ['solid', 'opening', 'door', 'window'] as const;
            const currentIndex = cycle.indexOf(currentWalls[side]);
            const nextIndex = (currentIndex + 1) % cycle.length;
            return {
                ...room,
                walls: { ...currentWalls, [side]: cycle[nextIndex] },
            };
        }));
        setSelectedRoomId(roomId);
    }, [saveToHistory]);

    // Auto-adjust
    const autoAdjustRooms = useCallback(() => {
        saveToHistory();
        const currentTotalArea = rooms.reduce((acc, r) => acc + (r.length * r.width), 0);
        if (currentTotalArea === 0) return;
        const sqrtScale = Math.sqrt(targetFloorArea / currentTotalArea);
        setRooms(prev => prev.map(room => ({
            ...room,
            length: Math.round(room.length * sqrtScale * 10) / 10,
            width: Math.round(room.width * sqrtScale * 10) / 10,
        })));
    }, [rooms, targetFloorArea, saveToHistory]);

    // Totals
    const totals = useMemo(() => {
        return rooms.reduce((acc, room) => {
            const floorArea = room.length * room.width;
            const perimeter = (room.length + room.width) * 2;
            const grossWallArea = perimeter * WALL_HEIGHT;
            const doorDeductions = room.doors * STANDARD_DOOR_AREA;
            const windowDeductions = room.windows * STANDARD_WINDOW_AREA;
            const netWallArea = Math.max(0, grossWallArea - doorDeductions - windowDeductions);
            const materialDef = BRICK_TYPES.find(b => b.id === (room.materialId || 'brick-common')) || BRICK_TYPES[0];
            const bricksNeeded = netWallArea * materialDef.rate;

            return {
                area: acc.area + floorArea,
                walls: acc.walls + netWallArea,
                bricks: acc.bricks + bricksNeeded,
            };
        }, { area: 0, walls: 0, bricks: 0 });
    }, [rooms]);

    // Collision detection
    const roomCollisions = useMemo(() => {
        const collisions: { [key: string]: boolean } = {};
        rooms.forEach(roomA => {
            collisions[roomA.id] = rooms.some(roomB => {
                if (roomA.id === roomB.id) return false;
                const aRight = roomA.x + roomA.width * PIXELS_PER_METER;
                const aBottom = roomA.y + roomA.length * PIXELS_PER_METER;
                const bRight = roomB.x + roomB.width * PIXELS_PER_METER;
                const bBottom = roomB.y + roomB.length * PIXELS_PER_METER;
                const margin = 4;
                return !(aRight <= roomB.x + margin || roomA.x >= bRight - margin ||
                    aBottom <= roomB.y + margin || roomA.y >= bBottom - margin);
            });
        });
        return collisions;
    }, [rooms]);

    // localStorage persistence
    useEffect(() => {
        if (rooms.length > 0) {
            try {
                localStorage.setItem('zimestimate_room_builder', JSON.stringify({
                    rooms, targetFloorArea, timestamp: Date.now(),
                }));
            } catch {}
        }
    }, [rooms, targetFloorArea]);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('zimestimate_room_builder');
            if (saved) {
                const data = JSON.parse(saved);
                const isRecent = Date.now() - data.timestamp < 24 * 60 * 60 * 1000;
                const matchesTarget = data.targetFloorArea === targetFloorArea;
                if (isRecent && matchesTarget && data.rooms?.length > 0) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const loadedRooms = data.rooms.map((r: any, index: number) => {
                        const update = { ...r };
                        if (update.x === undefined || update.y === undefined) {
                            const GRID_SIZE = 160;
                            const COLS = isMobile ? 2 : 4;
                            update.x = 20 + ((index % COLS) * GRID_SIZE);
                            update.y = 20 + (Math.floor(index / COLS) * 140);
                        }
                        if (!update.materialId) update.materialId = 'brick-common';
                        return update;
                    });
                    setRooms(loadedRooms as RoomInstance[]);
                    setLoadedFromStorage(true);
                    return;
                }
            }
        } catch {}

        // Initialize from roomCounts
        if (rooms.length === 0) {
            const initialRooms: RoomInstance[] = [];
            let currentX = 20;
            let currentY = 20;
            const GRID_SIZE = 160;
            const COLS = isMobile ? 2 : 4;

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
                            materialId: 'brick-common',
                        });
                        currentX += GRID_SIZE;
                        if (currentX > (GRID_SIZE * COLS)) {
                            currentX = 20;
                            currentY += 140;
                        }
                    }
                }
            });
            setRooms(initialRooms);
            if (initialRooms.length > 0) setSelectedRoomId(initialRooms[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomCounts, isMobile]);

    const clearSavedData = useCallback(() => {
        try {
            localStorage.removeItem('zimestimate_room_builder');
            setLoadedFromStorage(false);
            window.location.reload();
        } catch {}
    }, []);

    return {
        rooms,
        setRooms,
        selectedRoomId,
        setSelectedRoomId,
        selectedRoom,
        updateRoom,
        updateSelectedRoom,
        addRoom,
        addEnSuiteRoom,
        removeSelectedRoom,
        copySelectedRoom,
        pasteRoom,
        duplicateSelectedRoom,
        rotateSelectedRoom,
        toggleWallFeature,
        autoAdjustRooms,
        totals,
        roomCollisions,
        past,
        future,
        saveToHistory,
        undo,
        redo,
        clipboard,
        loadedFromStorage,
        clearSavedData,
        getRoomTypeColor,
    };
}
