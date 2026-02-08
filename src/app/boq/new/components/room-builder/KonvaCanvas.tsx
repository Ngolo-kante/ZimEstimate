import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import Konva from 'konva';
import KonvaGridLayer from './KonvaGridLayer';
import KonvaAlignmentGuides from './KonvaAlignmentGuides';
import KonvaRoom from './KonvaRoom';
import { RoomInstance, PIXELS_PER_METER, GRID_SNAP_SIZE } from './types';

interface KonvaCanvasProps {
    rooms: RoomInstance[];
    selectedRoomId: string | null;
    roomCollisions: { [key: string]: boolean };
    zoom: number;
    snapToGrid: boolean;
    alignmentGuides: { horizontal: number[]; vertical: number[] };
    onSelectRoom: (id: string) => void;
    onDeselectRoom: () => void;
    onRoomDragStart: (id: string) => void;
    onRoomDragEnd: (id: string, x: number, y: number) => void;
    onRoomDragMove: (id: string, x: number, y: number) => void;
    onRoomTransformEnd: (id: string, newWidth: number, newLength: number, x: number, y: number) => void;
    onWallClick: (roomId: string, side: 'top' | 'right' | 'bottom' | 'left') => void;
    onZoom: (delta: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function KonvaCanvas({
    rooms,
    selectedRoomId,
    roomCollisions,
    zoom,
    snapToGrid,
    alignmentGuides,
    onSelectRoom,
    onDeselectRoom,
    onRoomDragStart,
    onRoomDragEnd,
    onRoomDragMove,
    onRoomTransformEnd,
    onWallClick,
    onZoom,
}: KonvaCanvasProps) {
    const stageRef = useRef<Konva.Stage>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [containerSize, setContainerSize] = useState({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
    const containerRef = useRef<HTMLDivElement>(null);

    // Resize observer
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerSize({
                    width: entry.contentRect.width,
                    height: Math.max(entry.contentRect.height, 500),
                });
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Handle mouse wheel zoom
    const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
        if (e.evt.ctrlKey || e.evt.metaKey) {
            e.evt.preventDefault();
            onZoom(e.evt.deltaY < 0 ? 1 : -1);
        }
    }, [onZoom]);

    // Click on empty stage to deselect
    const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        // If we clicked on the Stage background (not a shape)
        if (e.target === e.target.getStage()) {
            onDeselectRoom();
            if (transformerRef.current) {
                transformerRef.current.nodes([]);
                transformerRef.current.getLayer()?.batchDraw();
            }
        }
    }, [onDeselectRoom]);

    const handleDragStart = useCallback((id: string) => {
        setDraggingId(id);
        onRoomDragStart(id);
    }, [onRoomDragStart]);

    const handleDragEnd = useCallback((id: string, x: number, y: number) => {
        setDraggingId(null);
        onRoomDragEnd(id, x, y);
    }, [onRoomDragEnd]);

    const handleTransformEnd = useCallback(() => {
        if (!selectedRoomId) return;
        const room = rooms.find(r => r.id === selectedRoomId);
        if (!room) return;

        // Find the group node for the selected room
        const stage = stageRef.current;
        if (!stage) return;

        const groups = stage.find('Group');
        const selectedGroup = groups.find(g => {
            // Match by position approximately
            return Math.abs(g.x() - room.x) < 1 && Math.abs(g.y() - room.y) < 1;
        });

        if (selectedGroup) {
            const scaleX = selectedGroup.scaleX();
            const scaleY = selectedGroup.scaleY();
            selectedGroup.scaleX(1);
            selectedGroup.scaleY(1);

            const newWidth = Math.max(0.5, Number((room.width * scaleX).toFixed(1)));
            const newLength = Math.max(0.5, Number((room.length * scaleY).toFixed(1)));

            onRoomTransformEnd(selectedRoomId, newWidth, newLength, selectedGroup.x(), selectedGroup.y());
        }
    }, [selectedRoomId, rooms, onRoomTransformEnd]);

    return (
        <div
            ref={containerRef}
            style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
                background: '#f0f9ff',
                borderRadius: '8px',
                border: '2px dashed #bfdbfe',
                minHeight: '500px',
            }}
        >
            <Stage
                ref={stageRef}
                width={containerSize.width}
                height={containerSize.height}
                scaleX={zoom}
                scaleY={zoom}
                onClick={handleStageClick}
                onTap={handleStageClick}
                onWheel={handleWheel}
            >
                {/* Grid layer */}
                <KonvaGridLayer
                    width={containerSize.width / zoom + 100}
                    height={containerSize.height / zoom + 100}
                    gridSize={20}
                />

                {/* Rooms layer */}
                <Layer>
                    {rooms.map((room) => (
                        <KonvaRoom
                            key={room.id}
                            room={room}
                            isSelected={room.id === selectedRoomId}
                            isDragging={room.id === draggingId}
                            hasCollision={roomCollisions[room.id] || false}
                            snapToGrid={snapToGrid}
                            onSelect={onSelectRoom}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onDragMove={onRoomDragMove}
                            onWallClick={onWallClick}
                            transformerRef={transformerRef}
                        />
                    ))}

                    {/* Transformer for resize/rotate */}
                    <Transformer
                        ref={transformerRef}
                        rotateEnabled={true}
                        enabledAnchors={[
                            'top-left', 'top-right',
                            'bottom-left', 'bottom-right',
                            'middle-left', 'middle-right',
                            'top-center', 'bottom-center',
                        ]}
                        boundBoxFunc={(oldBox, newBox) => {
                            const minSize = 20;
                            if (newBox.width < minSize || newBox.height < minSize) return oldBox;
                            return newBox;
                        }}
                        onTransformEnd={handleTransformEnd}
                        borderStroke="#22c55e"
                        borderStrokeWidth={2}
                        anchorFill="#22c55e"
                        anchorStroke="#16a34a"
                        anchorSize={8}
                        anchorCornerRadius={2}
                    />
                </Layer>

                {/* Alignment guides layer */}
                <KonvaAlignmentGuides
                    horizontal={alignmentGuides.horizontal}
                    vertical={alignmentGuides.vertical}
                    canvasWidth={containerSize.width / zoom}
                    canvasHeight={containerSize.height / zoom}
                />
            </Stage>

            {/* North indicator overlay */}
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
                zIndex: 5,
                pointerEvents: 'none',
            }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4L16 12H8L12 4Z" fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
                    <path d="M12 12L16 20H8L12 12Z" fill="#f3f4f6" stroke="#6b7280" strokeWidth="1" />
                </svg>
                <div style={{
                    position: 'absolute',
                    top: '2px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#dc2626',
                }}>N</div>
            </div>
        </div>
    );
}
