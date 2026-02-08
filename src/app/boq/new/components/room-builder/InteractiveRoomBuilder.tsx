'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { InteractiveRoomBuilderProps, RoomInstance, GRID_SNAP_SIZE, getRoomTypeColor } from './types';
import { useRoomState } from './useRoomState';
import { useCanvasInteraction } from './useCanvasInteraction';
import ToolbarHeader from './ToolbarHeader';
import StatusBar from './StatusBar';
import RoomSidebar from './RoomSidebar';
import RoomPickerDropdown from './RoomPickerDropdown';
import HelpModal from './HelpModal';
import { Door, FrameCorners, Square } from '@phosphor-icons/react';

// Dynamic import of KonvaCanvas (SSR: false - Konva needs DOM)
const KonvaCanvas = dynamic(() => import('./KonvaCanvas'), {
    ssr: false,
    loading: () => (
        <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f0f9ff',
            borderRadius: '8px',
            border: '2px dashed #bfdbfe',
            minHeight: '500px',
            color: '#94a3b8',
            fontSize: '14px',
        }}>
            Loading canvas...
        </div>
    ),
});

export function InteractiveRoomBuilder({ roomCounts, targetFloorArea, onContinue, onBack }: InteractiveRoomBuilderProps) {
    const [isMobile, setIsMobile] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showRoomPicker, setShowRoomPicker] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

    // Mobile detection
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            setSidebarOpen(!mobile);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const roomState = useRoomState({ roomCounts, targetFloorArea, isMobile });
    const canvas = useCanvasInteraction();

    const {
        rooms, selectedRoomId, selectedRoom, setSelectedRoomId,
        updateRoom, updateSelectedRoom,
        addRoom, addEnSuiteRoom,
        removeSelectedRoom,
        copySelectedRoom, pasteRoom, duplicateSelectedRoom,
        rotateSelectedRoom, toggleWallFeature,
        autoAdjustRooms,
        totals, roomCollisions,
        past, future,
        saveToHistory, undo, redo,
        loadedFromStorage, clearSavedData, setRooms,
    } = roomState;

    const {
        zoom, snapToGrid, alignmentGuides,
        zoomIn, zoomOut, resetZoom,
        setSnapToGrid,
        calculateAlignmentGuides, clearAlignmentGuides,
    } = canvas;

    // Target area calculations
    const areaDiff = targetFloorArea - totals.area;
    const isOverTarget = areaDiff < 0;
    const isUnderTarget = areaDiff > 1;

    // Select room handler (open sidebar on mobile)
    const handleRoomSelect = useCallback((roomId: string) => {
        setSelectedRoomId(roomId);
        if (isMobile) setSidebarOpen(true);
    }, [isMobile, setSelectedRoomId]);

    // Handle add room from picker
    const handleAddRoom = useCallback((typeKey: string) => {
        addRoom(typeKey);
        setShowRoomPicker(false);
    }, [addRoom]);

    // Handle en-suite removal
    const handleRemoveEnSuite = useCallback((roomId: string) => {
        saveToHistory();
        setRooms((prev: RoomInstance[]) => prev.filter((r: RoomInstance) => r.id !== roomId));
    }, [saveToHistory, setRooms]);

    // Konva canvas callbacks
    const handleRoomDragStart = useCallback((id: string) => {
        saveToHistory();
        handleRoomSelect(id);
    }, [saveToHistory, handleRoomSelect]);

    const handleRoomDragEnd = useCallback((id: string, x: number, y: number) => {
        updateRoom(id, { x, y });
        clearAlignmentGuides();
    }, [updateRoom, clearAlignmentGuides]);

    const handleRoomDragMove = useCallback((id: string, x: number, y: number) => {
        const room = rooms.find(r => r.id === id);
        if (room) {
            calculateAlignmentGuides({ ...room, x, y }, rooms);
        }
    }, [rooms, calculateAlignmentGuides]);

    const handleRoomTransformEnd = useCallback((id: string, newWidth: number, newLength: number, x: number, y: number) => {
        updateRoom(id, { width: newWidth, length: newLength, x, y });
    }, [updateRoom]);

    const handleWallClick = useCallback((roomId: string, side: 'top' | 'right' | 'bottom' | 'left') => {
        toggleWallFeature(roomId, side);
    }, [toggleWallFeature]);

    const handleZoom = useCallback((delta: number) => {
        if (delta > 0) zoomIn();
        else zoomOut();
    }, [zoomIn, zoomOut]);

    // Move selected room with arrow keys
    const moveSelectedRoom = useCallback((dx: number, dy: number) => {
        if (!selectedRoomId) return;
        saveToHistory();
        const step = snapToGrid ? GRID_SNAP_SIZE : 5;
        setRooms((prev: RoomInstance[]) => prev.map((room: RoomInstance) => {
            if (room.id === selectedRoomId) {
                return { ...room, x: Math.max(0, room.x + dx * step), y: Math.max(0, room.y + dy * step) };
            }
            return room;
        }));
    }, [selectedRoomId, saveToHistory, snapToGrid, setRooms]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedRoomId) { e.preventDefault(); copySelectedRoom(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); pasteRoom(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedRoomId) { e.preventDefault(); duplicateSelectedRoom(); return; }
            if ((e.key === 'r' || e.key === 'R') && selectedRoomId) { e.preventDefault(); rotateSelectedRoom(); return; }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRoomId) { e.preventDefault(); removeSelectedRoom(); return; }

            if (selectedRoomId) {
                switch (e.key) {
                    case 'ArrowUp': e.preventDefault(); moveSelectedRoom(0, -1); break;
                    case 'ArrowDown': e.preventDefault(); moveSelectedRoom(0, 1); break;
                    case 'ArrowLeft': e.preventDefault(); moveSelectedRoom(-1, 0); break;
                    case 'ArrowRight': e.preventDefault(); moveSelectedRoom(1, 0); break;
                }
            }

            if (e.key === 'Escape') { setSelectedRoomId(null); setShowRoomPicker(false); setShowHelpModal(false); }
            if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
            if (e.key === '-') { e.preventDefault(); zoomOut(); }
            if (e.key === 'g' || e.key === 'G') { setSnapToGrid((prev: boolean) => !prev); }
            if (e.key === '?' && e.shiftKey) { e.preventDefault(); setShowHelpModal(prev => !prev); }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, selectedRoomId, moveSelectedRoom, zoomIn, zoomOut, copySelectedRoom, pasteRoom, duplicateSelectedRoom, rotateSelectedRoom, removeSelectedRoom, setSelectedRoomId, setSnapToGrid]);

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
            width: '100%',
        }}>
            {/* Toolbar Header */}
            <ToolbarHeader
                onBack={onBack}
                canUndo={past.length > 0}
                canRedo={future.length > 0}
                onUndo={undo}
                onRedo={redo}
                zoom={zoom}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onResetZoom={resetZoom}
                snapToGrid={snapToGrid}
                onToggleSnap={() => setSnapToGrid((prev: boolean) => !prev)}
                onShowHelp={() => setShowHelpModal(true)}
                showHelpModal={showHelpModal}
                loadedFromStorage={loadedFromStorage}
                onClearSavedData={clearSavedData}
                isMobile={isMobile}
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                targetFloorArea={targetFloorArea}
                currentArea={totals.area}
                areaDiff={areaDiff}
                isOverTarget={isOverTarget}
                isUnderTarget={isUnderTarget}
                onAutoFit={autoAdjustRooms}
            />

            <div style={{
                display: 'flex',
                flex: 1,
                overflow: 'hidden',
                minHeight: 0,
                flexDirection: isMobile ? 'column' : 'row',
                position: 'relative',
            }}>
                {/* Canvas Area */}
                <div style={{
                    flex: isMobile && sidebarOpen ? '0 0 auto' : 1,
                    display: isMobile && sidebarOpen ? 'none' : 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: isMobile ? '20px' : '40px',
                    overflow: 'auto',
                    minHeight: isMobile ? '300px' : 'auto',
                }}>
                    {/* Room picker button */}
                    <RoomPickerDropdown
                        isOpen={showRoomPicker}
                        onToggle={() => setShowRoomPicker(!showRoomPicker)}
                        onAddRoom={handleAddRoom}
                    />

                    {/* Konva Canvas (desktop) / Mobile grid fallback */}
                    {isMobile ? (
                        <MobileRoomGrid
                            rooms={rooms}
                            selectedRoomId={selectedRoomId}
                            roomCollisions={roomCollisions}
                            onSelectRoom={handleRoomSelect}
                        />
                    ) : (
                        <KonvaCanvas
                            rooms={rooms}
                            selectedRoomId={selectedRoomId}
                            roomCollisions={roomCollisions}
                            zoom={zoom}
                            snapToGrid={snapToGrid}
                            alignmentGuides={alignmentGuides}
                            onSelectRoom={handleRoomSelect}
                            onDeselectRoom={() => setSelectedRoomId(null)}
                            onRoomDragStart={handleRoomDragStart}
                            onRoomDragEnd={handleRoomDragEnd}
                            onRoomDragMove={handleRoomDragMove}
                            onRoomTransformEnd={handleRoomTransformEnd}
                            onWallClick={handleWallClick}
                            onZoom={handleZoom}
                        />
                    )}
                </div>

                {/* Right Sidebar */}
                <RoomSidebar
                    selectedRoom={selectedRoom}
                    rooms={rooms}
                    isMobile={isMobile}
                    sidebarOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    onUpdateRoom={updateSelectedRoom}
                    onRemoveRoom={removeSelectedRoom}
                    onAddEnSuite={addEnSuiteRoom}
                    onRemoveEnSuite={handleRemoveEnSuite}
                />
            </div>

            {/* Status Bar */}
            <StatusBar
                totals={totals}
                isOverTarget={isOverTarget}
                isMobile={isMobile}
                onContinue={onContinue}
                rooms={rooms}
            />

            {/* Help Modal */}
            <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
        </div>
    );
}

// Mobile fallback: grid layout (existing mobile behavior)
function MobileRoomGrid({
    rooms,
    selectedRoomId,
    roomCollisions,
    onSelectRoom,
}: {
    rooms: RoomInstance[];
    selectedRoomId: string | null;
    roomCollisions: { [key: string]: boolean };
    onSelectRoom: (id: string) => void;
}) {

    if (rooms.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                color: '#9ca3af',
                marginTop: '40px',
                width: '100%',
            }}>
                <Square size={48} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
                <p>No rooms added yet. Click &quot;Add Room&quot; above.</p>
            </div>
        );
    }

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            width: '100%',
        }}>
            {rooms.map((room) => {
                const isSelected = room.id === selectedRoomId;
                const hasOverlap = roomCollisions[room.id] || false;
                const colors = getRoomTypeColor(room.type);

                let bgColor = colors.bgColor;
                let boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                if (hasOverlap) {
                    bgColor = '#fef2f2';
                    boxShadow = '0 0 0 3px #ef4444';
                } else if (isSelected) {
                    bgColor = '#dcfce7';
                    boxShadow = '0 0 0 2px #22c55e';
                }

                return (
                    <div
                        key={room.id}
                        onClick={() => onSelectRoom(room.id)}
                        style={{
                            position: 'relative',
                            background: bgColor,
                            boxShadow,
                            borderRadius: '2px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'transform 0.2s, background-color 0.2s',
                            transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                            padding: '12px',
                        }}
                    >
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
                                textTransform: 'uppercase',
                            }}>
                                En-suite
                            </div>
                        )}
                        <span style={{ fontSize: '11px', fontWeight: 700, color: isSelected ? '#166534' : '#475569', textTransform: 'uppercase', textAlign: 'center', marginBottom: '4px' }}>
                            {room.label}
                        </span>
                        <span style={{ fontSize: '10px', color: isSelected ? '#166534' : '#94a3b8', marginBottom: '8px' }}>
                            {room.length}m × {room.width}m
                        </span>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: 'auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: isSelected ? '#bbf7d0' : '#f1f5f9', borderRadius: '4px' }}>
                                <FrameCorners size={14} color={isSelected ? '#166534' : '#64748b'} />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? '#166534' : '#64748b' }}>{room.windows}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: isSelected ? '#bbf7d0' : '#f1f5f9', borderRadius: '4px' }}>
                                <Door size={14} color={isSelected ? '#166534' : '#64748b'} />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? '#166534' : '#64748b' }}>{room.doors}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
