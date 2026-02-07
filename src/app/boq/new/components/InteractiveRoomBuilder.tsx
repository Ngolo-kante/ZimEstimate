
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    CaretRight,
    ArrowCounterClockwise,
    ArrowClockwise
} from '@phosphor-icons/react';

// Copy of room inputs for labels/structure
const ROOM_TYPES = [
    { key: 'bedrooms', label: 'Bedroom', defaultDims: { l: 4, w: 3.5 } },
    { key: 'diningRoom', label: 'Dining Room', defaultDims: { l: 5, w: 4 } },
    { key: 'veranda', label: 'Veranda', defaultDims: { l: 4, w: 2 } },
    { key: 'bathrooms', label: 'Bathroom', defaultDims: { l: 2.5, w: 2 } },
    { key: 'kitchen', label: 'Kitchen', defaultDims: { l: 4, w: 3 } },
    { key: 'pantry', label: 'Pantry', defaultDims: { l: 2, w: 1.5 } },
    { key: 'livingRoom', label: 'Living Room', defaultDims: { l: 6, w: 5 } },
    { key: 'garage1', label: 'Single Garage', defaultDims: { l: 6, w: 3 } },
    { key: 'garage2', label: 'Double Garage', defaultDims: { l: 6, w: 6 } },
    { key: 'passage', label: 'Passage', defaultDims: { l: 5, w: 1.2 } },
];

export const BRICK_TYPES = [
    { id: 'brick-common', label: 'Common Bricks', rate: 52, color: '#dc2626' }, // 52 with wastage
    { id: 'block-6inch', label: '6" Hollow Blocks', rate: 13, color: '#64748b' }, // ~12.5 + wastage
    { id: 'brick-face-red', label: 'Face Bricks (Red)', rate: 52, color: '#b91c1c' },
    { id: 'farm-brick', label: 'Farm Bricks', rate: 55, color: '#ea580c' } // Slightly more wastage/smaller
];

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
}

interface InteractiveRoomBuilderProps {
    roomCounts: { [key: string]: number };
    targetFloorArea: number; // From the previous screen
    onContinue: (rooms: RoomInstance[], totals: { area: number, walls: number, bricks: number }) => void;
    onBack: () => void;
}

export function InteractiveRoomBuilder({ roomCounts, targetFloorArea, onContinue, onBack }: InteractiveRoomBuilderProps) {
    const [rooms, setRooms] = useState<RoomInstance[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [showRoomPicker, setShowRoomPicker] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [loadedFromStorage, setLoadedFromStorage] = useState(false);

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
                    const loadedRooms = data.rooms.map((r: any, index: number) => {
                        let update = { ...r };

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
            // eslint-disable-next-line react-hooks/purity
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

    // Remove selected room
    const removeSelectedRoom = () => {
        if (!selectedRoomId) return;
        saveToHistory();
        setRooms(prev => prev.filter(r => r.id !== selectedRoomId));
        setSelectedRoomId(rooms.length > 1 ? rooms[0].id : null);
    };

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
                    let newX = e.clientX - dragOffset.x;
                    let newY = e.clientY - dragOffset.y;

                    // Simple snapping (grid of 20px)
                    newX = Math.round(newX / 20) * 20;
                    newY = Math.round(newY / 20) * 20;

                    return { ...room, x: newX, y: newY };
                }
                return room;
            }));
        } else if (resizingId && resizeStartDims) {
            const dx = e.clientX - resizeStartDims.mouseX;
            const dy = e.clientY - resizeStartDims.mouseY;

            // 40px = 1m. Snap to 0.1m
            const dw = dx / 40;
            const dl = dy / 40;

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
    }, [draggingId, dragOffset, resizingId, resizeStartDims]);

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
    }, [draggingId, dragStartRooms, rooms, resizingId]);

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
                            title="Redo"
                        >
                            <ArrowClockwise size={16} />
                        </button>
                    </div>
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
                <div style={{
                    flex: isMobile && sidebarOpen ? '0 0 auto' : 1,
                    position: 'relative',
                    overflow: 'auto',
                    padding: isMobile ? '20px' : '40px',
                    display: isMobile && sidebarOpen ? 'none' : 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    minHeight: isMobile ? '300px' : 'auto'
                }}>
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
                        height: isMobile ? 'auto' : '600px', // Fixed height for canvas mode
                        background: isMobile ? 'transparent' : '#f0f9ff', // Light blue bg for canvas
                        borderRadius: '12px',
                        border: isMobile ? 'none' : '2px dashed #bfdbfe'
                    }}>
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

                                return (
                                    <div
                                        key={room.id}
                                        onMouseDown={(e) => !isMobile && handleMouseDown(e, room.id)}
                                        onClick={() => handleRoomSelect(room.id)}
                                        style={{
                                            // Layout
                                            position: isMobile ? 'relative' : 'absolute',
                                            left: isMobile ? 'auto' : `${room.x}px`,
                                            top: isMobile ? 'auto' : `${room.y}px`,
                                            zIndex: isDragging ? 10 : (isSelected ? 5 : 1),

                                            // Dimensions
                                            // Dimensions
                                            width: isMobile ? 'auto' : `${room.width * 40}px`,
                                            height: isMobile ? 'auto' : `${room.length * 40}px`,
                                            minWidth: isMobile ? 'auto' : '60px',
                                            minHeight: isMobile ? 'auto' : '60px',

                                            // Visuals
                                            background: isSelected ? '#dcfce7' : '#fff',
                                            border: isDragging ? '2px dashed #22c55e' : (isSelected ? '2px solid #22c55e' : '2px solid #94a3b8'),
                                            borderRadius: '4px',

                                            // Flex content
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',

                                            // Interaction
                                            cursor: isMobile ? 'pointer' : (isDragging ? 'grabbing' : 'grab'),
                                            userSelect: 'none',
                                            boxShadow: isDragging
                                                ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                                                : (isSelected ? '0 10px 15px -3px rgba(34, 197, 94, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'),
                                            transition: isDragging ? 'none' : 'all 0.2s', // Disable transition during drag
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

                    {/* Mini Floor Plan Preview */}
                    {rooms.length > 0 && (
                        <div style={{
                            marginTop: '32px',
                            padding: '20px',
                            background: '#fff',
                            borderRadius: '12px',
                            border: '2px dashed #d1d5db',
                            maxWidth: '500px',
                            width: '100%'
                        }}>
                            <div style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="7" height="7" />
                                    <rect x="14" y="3" width="7" height="7" />
                                    <rect x="14" y="14" width="7" height="7" />
                                    <rect x="3" y="14" width="7" height="7" />
                                </svg>
                                Mini Floor Plan Preview
                            </div>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                padding: '16px',
                                background: '#f9fafb',
                                borderRadius: '8px',
                                minHeight: '200px',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {rooms.map(room => {
                                    const isSelected = room.id === selectedRoomId;
                                    // Scale rooms proportionally (max dimension = 80px)
                                    const maxDim = Math.max(room.length, room.width);
                                    const scale = 80 / maxDim;
                                    const scaledLength = room.length * scale;
                                    const scaledWidth = room.width * scale;

                                    return (
                                        <div
                                            key={room.id}
                                            onClick={() => handleRoomSelect(room.id)}
                                            style={{
                                                width: `${scaledLength}px`,
                                                height: `${scaledWidth}px`,
                                                background: isSelected ? '#dcfce7' : '#fff',
                                                border: isSelected ? '2px solid #22c55e' : '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                position: 'relative',
                                                transition: 'all 0.2s',
                                                fontSize: '9px',
                                                fontWeight: 600,
                                                color: isSelected ? '#166534' : '#6b7280',
                                                textAlign: 'center',
                                                padding: '4px',
                                                overflow: 'hidden',
                                                boxShadow: isSelected ? '0 4px 6px rgba(34, 197, 94, 0.2)' : 'none'
                                            }}
                                            title={`${room.label}: ${room.length}m × ${room.width}m`}
                                        >
                                            {room.label.split(' ')[0]}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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
        </div>
    );
}
