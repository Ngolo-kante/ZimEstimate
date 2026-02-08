import React from 'react';
import {
    CaretLeft,
    ArrowCounterClockwise,
    ArrowClockwise,
    MagnifyingGlassPlus,
    MagnifyingGlassMinus,
    GridFour,
    Question,
    FloppyDisk,
    MagicWand,
    Warning,
    CheckCircle,
    List,
} from '@phosphor-icons/react';
import { MIN_ZOOM, MAX_ZOOM } from './types';

interface ToolbarHeaderProps {
    onBack: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    snapToGrid: boolean;
    onToggleSnap: () => void;
    onShowHelp: () => void;
    showHelpModal: boolean;
    loadedFromStorage: boolean;
    onClearSavedData: () => void;
    isMobile: boolean;
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
    // Target area
    targetFloorArea: number;
    currentArea: number;
    areaDiff: number;
    isOverTarget: boolean;
    isUnderTarget: boolean;
    onAutoFit: () => void;
}

export default function ToolbarHeader({
    onBack,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    zoom,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    snapToGrid,
    onToggleSnap,
    onShowHelp,
    showHelpModal,
    loadedFromStorage,
    onClearSavedData,
    isMobile,
    sidebarOpen,
    onToggleSidebar,
    targetFloorArea,
    areaDiff,
    isOverTarget,
    isUnderTarget,
    onAutoFit,
}: ToolbarHeaderProps) {
    const btnStyle = (enabled: boolean): React.CSSProperties => ({
        padding: '6px',
        background: enabled ? '#fff' : '#f3f4f6',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        cursor: enabled ? 'pointer' : 'not-allowed',
        color: enabled ? '#374151' : '#9ca3af',
        display: 'flex',
        alignItems: 'center',
    });

    return (
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
            gap: '12px',
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
                        cursor: 'pointer',
                    }}
                >
                    <CaretLeft size={16} />
                </button>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    STEP 3/5: ROOM DETAILS
                </div>

                {/* Undo / Redo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #e5e7eb', paddingLeft: '12px' }}>
                    <button onClick={onUndo} disabled={!canUndo} style={btnStyle(canUndo)} title="Undo">
                        <ArrowCounterClockwise size={16} />
                    </button>
                    <button onClick={onRedo} disabled={!canRedo} style={btnStyle(canRedo)} title="Redo (Ctrl+Shift+Z)">
                        <ArrowClockwise size={16} />
                    </button>
                </div>

                {/* Zoom Controls (desktop only) */}
                {!isMobile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #e5e7eb', paddingLeft: '12px' }}>
                        <button onClick={onZoomOut} disabled={zoom <= MIN_ZOOM} style={btnStyle(zoom > MIN_ZOOM)} title="Zoom Out (-)">
                            <MagnifyingGlassMinus size={16} />
                        </button>
                        <button
                            onClick={onResetZoom}
                            style={{
                                padding: '4px 8px',
                                background: zoom === 1 ? '#f3f4f6' : '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#374151',
                                minWidth: '48px',
                            }}
                            title="Reset Zoom"
                        >
                            {Math.round(zoom * 100)}%
                        </button>
                        <button onClick={onZoomIn} disabled={zoom >= MAX_ZOOM} style={btnStyle(zoom < MAX_ZOOM)} title="Zoom In (+)">
                            <MagnifyingGlassPlus size={16} />
                        </button>
                        <button
                            onClick={onToggleSnap}
                            style={{
                                padding: '6px',
                                background: snapToGrid ? '#dcfce7' : '#fff',
                                border: `1px solid ${snapToGrid ? '#86efac' : '#e5e7eb'}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: snapToGrid ? '#166534' : '#9ca3af',
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: '4px',
                            }}
                            title={`Grid Snap: ${snapToGrid ? 'ON' : 'OFF'} (G)`}
                        >
                            <GridFour size={16} weight={snapToGrid ? 'fill' : 'regular'} />
                        </button>
                        <button
                            onClick={onShowHelp}
                            style={{
                                padding: '6px',
                                background: showHelpModal ? '#e0f2fe' : '#fff',
                                border: `1px solid ${showHelpModal ? '#3b82f6' : '#e5e7eb'}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: showHelpModal ? '#1d4ed8' : '#374151',
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: '4px',
                            }}
                            title="Keyboard Shortcuts (Shift + ?)"
                        >
                            <Question size={16} weight="bold" />
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
                        color: '#1e40af',
                    }}>
                        <FloppyDisk size={14} weight="fill" />
                        Loaded from saved
                        <button
                            onClick={onClearSavedData}
                            style={{
                                marginLeft: '4px',
                                padding: '2px 6px',
                                background: '#1e40af',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                fontWeight: 600,
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
                border: `1px solid ${isOverTarget ? '#fecaca' : isUnderTarget ? '#fde68a' : '#bbf7d0'}`,
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
                        color: isOverTarget ? '#dc2626' : isUnderTarget ? '#d97706' : '#16a34a',
                    }}>
                        {isOverTarget ? `${Math.abs(areaDiff).toFixed(1)}m² over` :
                            isUnderTarget ? `${areaDiff.toFixed(1)}m² remaining` :
                                'Target met!'}
                    </div>
                </div>
                {isUnderTarget && (
                    <button
                        onClick={onAutoFit}
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
                            cursor: 'pointer',
                        }}
                        title="Auto-adjust room sizes to meet target"
                    >
                        <MagicWand size={14} weight="bold" />
                        Auto-Fit
                    </button>
                )}
            </div>

            {/* Progress dots / mobile sidebar toggle */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {!isMobile && [1, 2, 3, 4, 5].map(step => (
                    <div key={step} style={{
                        width: step === 3 ? '24px' : '8px',
                        height: '4px',
                        borderRadius: '2px',
                        background: step <= 3 ? '#10b981' : '#e5e7eb',
                        transition: 'all 0.3s',
                    }} />
                ))}
                {isMobile && (
                    <button
                        onClick={onToggleSidebar}
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
                            cursor: 'pointer',
                        }}
                    >
                        <List size={16} weight="bold" />
                        {sidebarOpen ? 'Hide Details' : 'Edit Room'}
                    </button>
                )}
            </div>
        </div>
    );
}
