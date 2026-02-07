'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { X, Plus, Minus, Door, WindowsLogo } from '@phosphor-icons/react';

// ============ TYPES ============
interface RoomConfig {
    id: string;
    typeId: string;
    name: string;
    width: number;
    length: number;
    windows: number;
    doors: number;
    color: string;
    x: number;
    y: number;
}

interface RoomTypeConfig {
    id: string;
    name: string;
    defaultWidth: number;
    defaultLength: number;
    color: string;
}

export interface FloorPlanData {
    rooms: RoomConfig[];
    wastagePercent: number;
}

export interface FloorPlanRendererProps {
    roomCounts: Record<string, number>;
    totalArea: number;
    wastagePercent?: number;
    onRoomUpdate?: (roomId: string, updates: Partial<RoomConfig>) => void;
    onWastageChange?: (percent: number) => void;
    onDataChange?: (data: FloorPlanData) => void;
    scale?: number;
    editable?: boolean;
}

// ============ CONSTANTS ============
const ROOM_TYPES: Record<string, RoomTypeConfig> = {
    bedroom: { id: 'bedroom', name: 'Bedroom', defaultWidth: 3.5, defaultLength: 3.5, color: '#dbeafe' },
    bathroom: { id: 'bathroom', name: 'Bath', defaultWidth: 2.5, defaultLength: 2.0, color: '#a5f3fc' },
    kitchen: { id: 'kitchen', name: 'Kitchen', defaultWidth: 3.0, defaultLength: 4.0, color: '#fed7aa' },
    lounge: { id: 'lounge', name: 'Lounge', defaultWidth: 4.5, defaultLength: 4.5, color: '#fef08a' },
    dining: { id: 'dining', name: 'Dining', defaultWidth: 3.5, defaultLength: 3.5, color: '#fbcfe8' },
    garage: { id: 'garage', name: 'Garage', defaultWidth: 6.0, defaultLength: 6.0, color: '#e2e8f0' },
    pantry: { id: 'pantry', name: 'Pantry', defaultWidth: 1.5, defaultLength: 2.0, color: '#ccfbf1' },
    veranda: { id: 'veranda', name: 'Veranda', defaultWidth: 4.0, defaultLength: 2.0, color: '#dcfce7' },
    ensuite: { id: 'ensuite', name: 'En-suite', defaultWidth: 2.0, defaultLength: 2.0, color: '#bbf7d0' },
};

const WINDOW_SIZE = 1.44; // 1.2m x 1.2m average
const DOOR_SIZE = 1.89;   // 0.9m x 2.1m average
const BRICKS_PER_SQM = 50;

// ============ COMPONENT ============
export default function FloorPlanRenderer({
    roomCounts,
    totalArea,
    wastagePercent = 10,
    onDataChange,
    scale = 28,
    editable = true,
}: FloorPlanRendererProps) {
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [localWastage, setLocalWastage] = useState(wastagePercent);
    const [roomOverrides, setRoomOverrides] = useState<Record<string, Partial<RoomConfig>>>({});

    // Generate rooms from counts with overrides applied
    const { rooms, viewBoxWidth, viewBoxHeight } = useMemo(() => {
        const generatedRooms: RoomConfig[] = [];
        let currentX = 0;
        let currentY = 0;
        let maxHeightInRow = 0;
        const rowWidthLimit = 14;

        Object.entries(roomCounts).forEach(([typeId, count]) => {
            if (!count || count <= 0) return;

            const config = ROOM_TYPES[typeId] || {
                id: typeId,
                name: typeId.charAt(0).toUpperCase() + typeId.slice(1),
                defaultWidth: 3,
                defaultLength: 3,
                color: '#f3f4f6',
            };

            for (let i = 0; i < count; i++) {
                const roomId = `${typeId}-${i}`;
                const overrides = roomOverrides[roomId] || {};

                const width = overrides.width ?? config.defaultWidth;
                const length = overrides.length ?? config.defaultLength;

                if (currentX + width > rowWidthLimit) {
                    currentX = 0;
                    currentY += maxHeightInRow + 0.3;
                    maxHeightInRow = 0;
                }

                generatedRooms.push({
                    id: roomId,
                    typeId,
                    name: count > 1 ? `${config.name} ${i + 1}` : config.name,
                    width,
                    length,
                    windows: overrides.windows ?? (typeId === 'bathroom' ? 1 : 2),
                    doors: overrides.doors ?? 1,
                    color: config.color,
                    x: currentX,
                    y: currentY,
                });

                currentX += width + 0.2;
                maxHeightInRow = Math.max(maxHeightInRow, length);
            }
        });

        const finalWidth = Math.max(rowWidthLimit, ...generatedRooms.map((r) => r.x + r.width)) + 0.5;
        const finalHeight = currentY + maxHeightInRow + 0.5;

        return {
            rooms: generatedRooms,
            viewBoxWidth: finalWidth * scale,
            viewBoxHeight: Math.max(finalHeight * scale, 200),
        };
    }, [roomCounts, roomOverrides, scale]);

    // Calculate materials
    const calculations = useMemo(() => {
        const totalRoomArea = rooms.reduce((sum, r) => sum + r.width * r.length, 0);
        const totalWindows = rooms.reduce((sum, r) => sum + r.windows, 0);
        const totalDoors = rooms.reduce((sum, r) => sum + r.doors, 0);

        // Estimate perimeter from total area (1.4:1 aspect ratio)
        const estimatedLength = Math.sqrt((totalArea || totalRoomArea) * 1.4);
        const estimatedWidth = (totalArea || totalRoomArea) / estimatedLength;
        const externalPerimeter = 2 * (estimatedLength + estimatedWidth);

        // Internal walls: roughly 4m per room
        const internalWallLength = Math.max(0, (rooms.length - 1)) * 4;
        const wallHeight = 2.7;

        // Total wall area
        const grossWallArea = (externalPerimeter + internalWallLength) * wallHeight;
        const openingsArea = (totalWindows * WINDOW_SIZE) + (totalDoors * DOOR_SIZE);
        const netWallArea = Math.max(0, grossWallArea - openingsArea);

        // Bricks
        const bricksRaw = netWallArea * BRICKS_PER_SQM;
        const bricksWithWastage = Math.ceil(bricksRaw * (1 + localWastage / 100));

        // Cement (approx 8 bags per 1000 bricks for mortar)
        const cementBags = Math.ceil(bricksWithWastage / 1000 * 8);

        // Sand (approx 0.5 cube per 1000 bricks)
        const sandCubes = Math.ceil(bricksWithWastage / 1000 * 0.5);

        return {
            totalArea: totalArea || totalRoomArea,
            totalWindows,
            totalDoors,
            grossWallArea: Math.round(grossWallArea),
            openingsArea: Math.round(openingsArea * 10) / 10,
            netWallArea: Math.round(netWallArea),
            bricks: bricksWithWastage,
            cement: cementBags,
            sand: sandCubes,
        };
    }, [rooms, totalArea, localWastage]);

    // Emit data changes
    const emitChanges = useCallback(() => {
        if (onDataChange) {
            onDataChange({
                rooms,
                wastagePercent: localWastage,
            });
        }
    }, [rooms, localWastage, onDataChange]);

    // Handle room updates
    const updateRoom = (roomId: string, field: keyof RoomConfig, value: number) => {
        setRoomOverrides((prev) => ({
            ...prev,
            [roomId]: {
                ...prev[roomId],
                [field]: value,
            },
        }));
    };

    const selectedRoomData = rooms.find((r) => r.id === selectedRoom);

    // Empty state
    if (rooms.length === 0) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '280px',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: '16px',
                    border: '2px dashed #cbd5e1',
                    color: '#64748b',
                    padding: '32px',
                }}
            >
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                </svg>
                <p style={{ marginTop: '16px', fontWeight: 500 }}>Add rooms to see your floor plan</p>
                <p style={{ fontSize: '14px', opacity: 0.7 }}>Use the controls above to add bedrooms, kitchen, etc.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Wastage Toggle */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                }}
            >
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>Wastage Allowance</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {[5, 10, 15].map((pct) => (
                        <button
                            key={pct}
                            onClick={() => setLocalWastage(pct)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                background: localWastage === pct ? '#3b82f6' : '#fff',
                                color: localWastage === pct ? '#fff' : '#64748b',
                                boxShadow: localWastage === pct ? '0 2px 8px rgba(59,130,246,0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {pct}%
                        </button>
                    ))}
                </div>
            </div>

            {/* Floor Plan SVG */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    overflow: 'hidden',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
            >
                <svg
                    width="100%"
                    viewBox={`-30 -30 ${viewBoxWidth + 60} ${viewBoxHeight + 60}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ minHeight: '260px', maxHeight: '380px', display: 'block' }}
                >
                    {/* Grid Pattern */}
                    <defs>
                        <pattern id="floorGrid" width={scale} height={scale} patternUnits="userSpaceOnUse">
                            <path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="#f1f5f9" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect x={-100} y={-100} width={viewBoxWidth + 200} height={viewBoxHeight + 200} fill="url(#floorGrid)" />

                    {/* Rooms */}
                    {rooms.map((room) => {
                        const isSelected = selectedRoom === room.id;
                        return (
                            <g
                                key={room.id}
                                transform={`translate(${room.x * scale}, ${room.y * scale})`}
                                onClick={() => editable && setSelectedRoom(isSelected ? null : room.id)}
                                style={{ cursor: editable ? 'pointer' : 'default' }}
                            >
                                {/* Room Rectangle */}
                                <rect
                                    width={room.width * scale}
                                    height={room.length * scale}
                                    fill={room.color}
                                    stroke={isSelected ? '#3b82f6' : '#64748b'}
                                    strokeWidth={isSelected ? 3 : 1.5}
                                    rx="4"
                                    style={{ transition: 'all 0.2s' }}
                                />

                                {/* Selection highlight */}
                                {isSelected && (
                                    <rect
                                        width={room.width * scale}
                                        height={room.length * scale}
                                        fill="none"
                                        stroke="#3b82f6"
                                        strokeWidth="3"
                                        strokeDasharray="8 4"
                                        rx="4"
                                    />
                                )}

                                {/* Room Name */}
                                <text
                                    x={(room.width * scale) / 2}
                                    y={(room.length * scale) / 2 - 8}
                                    textAnchor="middle"
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        fill: '#334155',
                                        fontFamily: 'system-ui, sans-serif',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    {room.name}
                                </text>

                                {/* Dimensions */}
                                <text
                                    x={(room.width * scale) / 2}
                                    y={(room.length * scale) / 2 + 6}
                                    textAnchor="middle"
                                    style={{
                                        fontSize: '9px',
                                        fill: '#64748b',
                                        fontFamily: 'system-ui, sans-serif',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    {room.width}m × {room.length}m
                                </text>

                                {/* Window/Door indicators */}
                                <text
                                    x={(room.width * scale) / 2}
                                    y={(room.length * scale) / 2 + 20}
                                    textAnchor="middle"
                                    style={{
                                        fontSize: '9px',
                                        fill: '#94a3b8',
                                        fontFamily: 'system-ui, sans-serif',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    🪟{room.windows} 🚪{room.doors}
                                </text>

                                {/* Tap to edit hint */}
                                {editable && isSelected && (
                                    <text
                                        x={(room.width * scale) / 2}
                                        y={room.length * scale + 14}
                                        textAnchor="middle"
                                        style={{
                                            fontSize: '9px',
                                            fill: '#3b82f6',
                                            fontWeight: 600,
                                            fontFamily: 'system-ui, sans-serif',
                                        }}
                                    >
                                        ✏️ Tap panel below to edit
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Dimension labels */}
                    <text
                        x={viewBoxWidth / 2}
                        y={-12}
                        textAnchor="middle"
                        style={{ fontSize: '10px', fontWeight: 600, fill: '#94a3b8', fontFamily: 'system-ui' }}
                    >
                        {((viewBoxWidth - 30) / scale).toFixed(1)}m
                    </text>
                </svg>

                {/* Room Edit Panel (Slide-up on mobile) */}
                {editable && selectedRoomData && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: '#fff',
                            borderTop: '1px solid #e2e8f0',
                            padding: '16px',
                            boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                            animation: 'slideUp 0.2s ease-out',
                        }}
                    >
                        <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}</style>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{selectedRoomData.name}</span>
                            <button
                                onClick={() => setSelectedRoom(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                }}
                            >
                                <X size={20} weight="bold" color="#64748b" />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            {/* Width */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                                    Width (m)
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <button
                                        onClick={() => updateRoom(selectedRoomData.id, 'width', Math.max(1.5, selectedRoomData.width - 0.5))}
                                        style={stepperBtnStyle}
                                    >
                                        <Minus size={16} weight="bold" />
                                    </button>
                                    <span style={{ fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>{selectedRoomData.width}</span>
                                    <button
                                        onClick={() => updateRoom(selectedRoomData.id, 'width', selectedRoomData.width + 0.5)}
                                        style={stepperBtnStyle}
                                    >
                                        <Plus size={16} weight="bold" />
                                    </button>
                                </div>
                            </div>

                            {/* Length */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                                    Length (m)
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <button
                                        onClick={() => updateRoom(selectedRoomData.id, 'length', Math.max(1.5, selectedRoomData.length - 0.5))}
                                        style={stepperBtnStyle}
                                    >
                                        <Minus size={16} weight="bold" />
                                    </button>
                                    <span style={{ fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>{selectedRoomData.length}</span>
                                    <button
                                        onClick={() => updateRoom(selectedRoomData.id, 'length', selectedRoomData.length + 0.5)}
                                        style={stepperBtnStyle}
                                    >
                                        <Plus size={16} weight="bold" />
                                    </button>
                                </div>
                            </div>

                            {/* Windows */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                                    🪟 Windows
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <button
                                        onClick={() => updateRoom(selectedRoomData.id, 'windows', Math.max(0, selectedRoomData.windows - 1))}
                                        style={stepperBtnStyle}
                                    >
                                        <Minus size={16} weight="bold" />
                                    </button>
                                    <span style={{ fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>{selectedRoomData.windows}</span>
                                    <button
                                        onClick={() => updateRoom(selectedRoomData.id, 'windows', selectedRoomData.windows + 1)}
                                        style={stepperBtnStyle}
                                    >
                                        <Plus size={16} weight="bold" />
                                    </button>
                                </div>
                            </div>

                            {/* Doors */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                                    🚪 Doors
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <button
                                        onClick={() => updateRoom(selectedRoomData.id, 'doors', Math.max(0, selectedRoomData.doors - 1))}
                                        style={stepperBtnStyle}
                                    >
                                        <Minus size={16} weight="bold" />
                                    </button>
                                    <span style={{ fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>{selectedRoomData.doors}</span>
                                    <button
                                        onClick={() => updateRoom(selectedRoomData.id, 'doors', selectedRoomData.doors + 1)}
                                        style={stepperBtnStyle}
                                    >
                                        <Plus size={16} weight="bold" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Live Calculations Dock */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                }}
            >
                <CalcCard label="Wall Area" value={`${calculations.netWallArea}m²`} subtext={`-${calculations.openingsArea}m² openings`} />
                <CalcCard label="Bricks" value={calculations.bricks.toLocaleString()} subtext={`+${localWastage}% wastage`} highlight />
                <CalcCard label="Cement" value={`${calculations.cement} bags`} subtext="For mortar" />
            </div>

            {/* Hint */}
            <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', margin: 0 }}>
                Tap any room to adjust dimensions, windows & doors
            </p>
        </div>
    );
}

// ============ HELPER COMPONENTS ============
const stepperBtnStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#475569',
};

function CalcCard({ label, value, subtext, highlight }: { label: string; value: string; subtext: string; highlight?: boolean }) {
    return (
        <div
            style={{
                padding: '12px',
                borderRadius: '12px',
                background: highlight ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#f8fafc',
                border: highlight ? 'none' : '1px solid #e2e8f0',
                textAlign: 'center',
            }}
        >
            <div style={{ fontSize: '10px', fontWeight: 600, color: highlight ? 'rgba(255,255,255,0.8)' : '#94a3b8', textTransform: 'uppercase' }}>
                {label}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: highlight ? '#fff' : '#1e293b', margin: '2px 0' }}>
                {value}
            </div>
            <div style={{ fontSize: '10px', color: highlight ? 'rgba(255,255,255,0.7)' : '#94a3b8' }}>
                {subtext}
            </div>
        </div>
    );
}
