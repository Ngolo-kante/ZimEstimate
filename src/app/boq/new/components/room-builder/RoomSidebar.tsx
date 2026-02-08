import React, { useState } from 'react';
import {
    Plus,
    Minus,
    Door,
    FrameCorners,
    FloppyDisk,
    Trash,
    X,
    Toilet,
    Bathtub,
    CheckCircle,
} from '@phosphor-icons/react';
import {
    RoomInstance,
    ENSUITE_TYPES,
    BRICK_TYPES,
    WALL_HEIGHT,
    STANDARD_DOOR_AREA,
    STANDARD_WINDOW_AREA,
    getRoomTypeColor,
} from './types';

interface RoomSidebarProps {
    selectedRoom: RoomInstance | undefined;
    rooms: RoomInstance[];
    isMobile: boolean;
    sidebarOpen: boolean;
    onClose: () => void;
    onUpdateRoom: (updates: Partial<RoomInstance>) => void;
    onRemoveRoom: () => void;
    onAddEnSuite: (typeKey: string) => void;
    onRemoveEnSuite: (roomId: string) => void;
}

export default function RoomSidebar({
    selectedRoom,
    rooms,
    isMobile,
    sidebarOpen,
    onClose,
    onUpdateRoom,
    onRemoveRoom,
    onAddEnSuite,
    onRemoveEnSuite,
}: RoomSidebarProps) {
    const [showEnSuitePicker, setShowEnSuitePicker] = useState(false);

    if (!sidebarOpen) return null;

    return (
        <div style={{
            width: isMobile ? '100%' : '320px',
            background: '#fff',
            borderLeft: isMobile ? 'none' : '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10,
            position: isMobile ? 'absolute' : 'relative',
            top: isMobile ? 0 : 'auto',
            left: isMobile ? 0 : 'auto',
            right: isMobile ? 0 : 'auto',
            bottom: isMobile ? 0 : 'auto',
            boxShadow: isMobile ? '0 -4px 20px rgba(0,0,0,0.1)' : 'none',
            overflowY: 'auto',
        }}>
            {/* Mobile close button */}
            {isMobile && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 20px',
                    borderBottom: '1px solid #e5e7eb',
                    background: '#f9fafb',
                }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>Room Details</span>
                    <button
                        onClick={onClose}
                        style={{
                            width: '32px',
                            height: '32px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            background: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
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
                            <span style={{ width: '4px', height: '24px', background: '#10b981', borderRadius: '0 4px 4px 0' }} />
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: '#1f2937' }}>
                                {selectedRoom.label} Details
                            </h3>
                        </div>
                        <button
                            onClick={onRemoveRoom}
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
                                color: '#dc2626',
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
                                    transition: 'all 0.2s',
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
                                    gap: '8px',
                                }}>
                                    {ENSUITE_TYPES.map(type => (
                                        <button
                                            key={type.key}
                                            onClick={() => { onAddEnSuite(type.key); setShowEnSuitePicker(false); }}
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
                                                transition: 'all 0.2s',
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
                                                fontSize: '12px',
                                            }}
                                        >
                                            <span style={{ fontWeight: 500 }}>{ensuite.label}</span>
                                            <button
                                                onClick={() => onRemoveEnSuite(ensuite.id)}
                                                style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#dc2626' }}
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
                                    onClick={() => onUpdateRoom({ materialId: type.id })}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px',
                                        background: (selectedRoom.materialId || 'brick-common') === type.id ? '#eff6ff' : '#fff',
                                        border: `1px solid ${(selectedRoom.materialId || 'brick-common') === type.id ? '#3b82f6' : '#e5e7eb'}`,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
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
                                        fontWeight: 700,
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
                                        onChange={(e) => onUpdateRoom({ length: parseFloat(e.target.value) || 0 })}
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
                                        onChange={(e) => onUpdateRoom({ width: parseFloat(e.target.value) || 0 })}
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
                                onClick={() => onUpdateRoom({ windows: Math.max(0, selectedRoom.windows - 1) })}
                                style={{ width: '32px', height: '32px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Minus size={14} color="#374151" />
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FrameCorners size={20} color="#374151" />
                                <span style={{ fontSize: '16px', fontWeight: 600 }}>{selectedRoom.windows}</span>
                            </div>
                            <button
                                onClick={() => onUpdateRoom({ windows: selectedRoom.windows + 1 })}
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
                                onClick={() => onUpdateRoom({ doors: Math.max(0, selectedRoom.doors - 1) })}
                                style={{ width: '32px', height: '32px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Minus size={14} color="#374151" />
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Door size={20} color="#374151" />
                                <span style={{ fontSize: '16px', fontWeight: 600 }}>{selectedRoom.doors}</span>
                            </div>
                            <button
                                onClick={() => onUpdateRoom({ doors: selectedRoom.doors + 1 })}
                                style={{ width: '32px', height: '32px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Plus size={14} color="#374151" />
                            </button>
                        </div>
                    </div>

                    {/* Material Estimates */}
                    <div style={{
                        marginBottom: '24px',
                        padding: '16px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                    }}>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#374151',
                            textTransform: 'uppercase',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M3 9h18M9 21V9" />
                            </svg>
                            Material Estimates
                        </div>

                        {(() => {
                            const perimeter = (selectedRoom.length + selectedRoom.width) * 2;
                            const grossWallArea = perimeter * WALL_HEIGHT;
                            const doorDeductions = selectedRoom.doors * STANDARD_DOOR_AREA;
                            const windowDeductions = selectedRoom.windows * STANDARD_WINDOW_AREA;
                            const netWallArea = Math.max(0, grossWallArea - doorDeductions - windowDeductions);
                            const materialDef = BRICK_TYPES.find(b => b.id === (selectedRoom.materialId || 'brick-common')) || BRICK_TYPES[0];
                            const units = Math.ceil(netWallArea * materialDef.rate);
                            const cementBags = Math.ceil(netWallArea * 0.5);
                            const sandCubicMeters = (netWallArea * 0.02).toFixed(2);

                            return (
                                <>
                                    <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '12px' }}>
                                        Wall Area: {grossWallArea.toFixed(1)}m² - {doorDeductions.toFixed(1)}m² (doors) - {windowDeductions.toFixed(1)}m² (windows) = <strong>{netWallArea.toFixed(1)}m²</strong>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <EstimateRow label={materialDef.label} value={units.toLocaleString()} color={materialDef.color} />
                                        <EstimateRow label="Cement" value={`${cementBags} bags`} color="#64748b" />
                                        <EstimateRow label="Sand" value={`${sandCubicMeters} m³`} color="#f59e0b" />
                                    </div>
                                </>
                            );
                        })()}
                    </div>

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
                            gap: '8px',
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
    );
}

function EstimateRow({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            background: '#fff',
            borderRadius: '6px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', background: color, borderRadius: '2px' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{label}</span>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 700, color }}>{value}</span>
        </div>
    );
}
