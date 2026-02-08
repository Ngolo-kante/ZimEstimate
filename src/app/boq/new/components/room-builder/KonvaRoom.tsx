import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';
import KonvaWallSegment from './KonvaWallSegment';
import { RoomInstance, PIXELS_PER_METER, GRID_SNAP_SIZE, getRoomTypeColor } from './types';

interface KonvaRoomProps {
    room: RoomInstance;
    isSelected: boolean;
    isDragging: boolean;
    hasCollision: boolean;
    snapToGrid: boolean;
    onSelect: (id: string) => void;
    onDragStart: (id: string) => void;
    onDragEnd: (id: string, x: number, y: number) => void;
    onDragMove: (id: string, x: number, y: number) => void;
    onWallClick: (roomId: string, side: 'top' | 'right' | 'bottom' | 'left') => void;
    transformerRef: React.RefObject<Konva.Transformer | null>;
}

export default function KonvaRoom({
    room,
    isSelected,
    isDragging,
    hasCollision,
    snapToGrid,
    onSelect,
    onDragStart,
    onDragEnd,
    onDragMove,
    onWallClick,
    transformerRef,
}: KonvaRoomProps) {
    const groupRef = useRef<Konva.Group>(null);
    const roomColors = getRoomTypeColor(room.type);
    const widthPx = room.width * PIXELS_PER_METER;
    const lengthPx = room.length * PIXELS_PER_METER;

    const walls = room.walls || { top: 'solid', right: 'solid', bottom: 'solid', left: 'solid' };

    // Attach transformer when selected
    useEffect(() => {
        if (isSelected && transformerRef.current && groupRef.current) {
            transformerRef.current.nodes([groupRef.current]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [isSelected, transformerRef]);

    let fillColor = roomColors.bgColor;
    let strokeColor = roomColors.color;
    let strokeWidth = 0;

    if (hasCollision) {
        fillColor = '#fef2f2';
        strokeColor = '#ef4444';
        strokeWidth = 3;
    } else if (isDragging) {
        strokeColor = '#22c55e';
        strokeWidth = 3;
    } else if (isSelected) {
        fillColor = '#dcfce7';
        strokeColor = '#22c55e';
        strokeWidth = 2;
    }

    const snapPosition = (val: number) => {
        if (!snapToGrid) return val;
        return Math.round(val / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
    };

    return (
        <Group
            ref={groupRef}
            x={room.x}
            y={room.y}
            draggable
            onClick={() => onSelect(room.id)}
            onTap={() => onSelect(room.id)}
            onDragStart={() => onDragStart(room.id)}
            onDragMove={(e) => {
                const node = e.target;
                const newX = snapPosition(node.x());
                const newY = snapPosition(Math.max(0, node.y()));
                node.x(Math.max(0, newX));
                node.y(newY);
                onDragMove(room.id, node.x(), node.y());
            }}
            onDragEnd={(e) => {
                const node = e.target;
                onDragEnd(room.id, node.x(), node.y());
            }}
            onTransformEnd={() => {
                // Read the new scale from the group and apply to dimensions
                const node = groupRef.current;
                if (!node) return;
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                // Reset scale to 1 and update room dimensions
                node.scaleX(1);
                node.scaleY(1);

                const newWidth = Math.max(0.5, Number((room.width * scaleX).toFixed(1)));
                const newLength = Math.max(0.5, Number((room.length * scaleY).toFixed(1)));

                onDragEnd(room.id, node.x(), node.y());
                // The parent will handle updating dimensions via the callback
                // We fire a custom-like approach: store in a data attribute pattern
                // Actually, we handle it through onTransformEnd in the canvas
            }}
        >
            {/* Room fill */}
            <Rect
                width={widthPx}
                height={lengthPx}
                fill={fillColor}
                stroke={strokeWidth > 0 ? strokeColor : undefined}
                strokeWidth={strokeWidth}
                cornerRadius={2}
                shadowColor="rgba(0,0,0,0.1)"
                shadowBlur={isDragging ? 10 : 3}
                shadowOffsetY={isDragging ? 5 : 1}
            />

            {/* Wall segments */}
            <KonvaWallSegment x1={0} y1={0} x2={widthPx} y2={0} type={walls.top} color={roomColors.color} onClick={() => onWallClick(room.id, 'top')} />
            <KonvaWallSegment x1={widthPx} y1={0} x2={widthPx} y2={lengthPx} type={walls.right} color={roomColors.color} isVertical onClick={() => onWallClick(room.id, 'right')} />
            <KonvaWallSegment x1={widthPx} y1={lengthPx} x2={0} y2={lengthPx} type={walls.bottom} color={roomColors.color} onClick={() => onWallClick(room.id, 'bottom')} />
            <KonvaWallSegment x1={0} y1={lengthPx} x2={0} y2={0} type={walls.left} color={roomColors.color} isVertical onClick={() => onWallClick(room.id, 'left')} />

            {/* En-suite badge */}
            {room.isEnSuite && (
                <>
                    <Rect
                        x={4}
                        y={4}
                        width={46}
                        height={14}
                        fill="#a855f7"
                        cornerRadius={3}
                    />
                    <Text
                        x={6}
                        y={5}
                        text="En-suite"
                        fontSize={7}
                        fontStyle="bold"
                        fill="#fff"
                    />
                </>
            )}

            {/* Room label */}
            <Text
                x={0}
                y={lengthPx / 2 - 14}
                width={widthPx}
                text={room.label}
                fontSize={11}
                fontStyle="bold"
                fill={isSelected ? '#166534' : '#475569'}
                align="center"
            />

            {/* Dimensions */}
            <Text
                x={0}
                y={lengthPx / 2 + 2}
                width={widthPx}
                text={`${room.length}m × ${room.width}m`}
                fontSize={10}
                fill={isSelected ? '#166534' : '#94a3b8'}
                align="center"
            />

            {/* Width dimension label (top) */}
            <Rect
                x={widthPx / 2 - 16}
                y={-18}
                width={32}
                height={14}
                fill={roomColors.color}
                cornerRadius={3}
            />
            <Text
                x={widthPx / 2 - 16}
                y={-16}
                width={32}
                text={`${room.width}m`}
                fontSize={9}
                fontStyle="bold"
                fill="#fff"
                align="center"
            />

            {/* Length dimension label (right) */}
            <Rect
                x={widthPx + 4}
                y={lengthPx / 2 - 7}
                width={32}
                height={14}
                fill={roomColors.color}
                cornerRadius={3}
            />
            <Text
                x={widthPx + 4}
                y={lengthPx / 2 - 5}
                width={32}
                text={`${room.length}m`}
                fontSize={9}
                fontStyle="bold"
                fill="#fff"
                align="center"
            />
        </Group>
    );
}
