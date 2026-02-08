import { useState, useCallback } from 'react';
import {
    RoomInstance,
    GRID_SNAP_SIZE,
    MIN_ZOOM,
    MAX_ZOOM,
    ZOOM_STEP,
    PIXELS_PER_METER,
} from './types';

export function useCanvasInteraction() {
    const [zoom, setZoom] = useState(1);
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [alignmentGuides, setAlignmentGuides] = useState<{ horizontal: number[]; vertical: number[] }>({
        horizontal: [],
        vertical: [],
    });

    const zoomIn = useCallback(() => {
        setZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
    }, []);

    const zoomOut = useCallback(() => {
        setZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
    }, []);

    const resetZoom = useCallback(() => {
        setZoom(1);
    }, []);

    const snapToGridPosition = useCallback((value: number): number => {
        if (!snapToGrid) return value;
        return Math.round(value / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
    }, [snapToGrid]);

    const calculateAlignmentGuides = useCallback((draggedRoom: RoomInstance, allRooms: RoomInstance[]) => {
        const horizontal: number[] = [];
        const vertical: number[] = [];
        const threshold = 10;

        allRooms.forEach(room => {
            if (room.id === draggedRoom.id) return;

            const roomRight = room.x + room.width * PIXELS_PER_METER;
            const roomBottom = room.y + room.length * PIXELS_PER_METER;
            const draggedRight = draggedRoom.x + draggedRoom.width * PIXELS_PER_METER;
            const draggedBottom = draggedRoom.y + draggedRoom.length * PIXELS_PER_METER;

            if (Math.abs(room.x - draggedRoom.x) < threshold) vertical.push(room.x);
            if (Math.abs(roomRight - draggedRight) < threshold) vertical.push(roomRight);
            if (Math.abs(room.x - draggedRight) < threshold) vertical.push(room.x);
            if (Math.abs(roomRight - draggedRoom.x) < threshold) vertical.push(roomRight);

            if (Math.abs(room.y - draggedRoom.y) < threshold) horizontal.push(room.y);
            if (Math.abs(roomBottom - draggedBottom) < threshold) horizontal.push(roomBottom);
            if (Math.abs(room.y - draggedBottom) < threshold) horizontal.push(room.y);
            if (Math.abs(roomBottom - draggedRoom.y) < threshold) horizontal.push(roomBottom);
        });

        setAlignmentGuides({
            horizontal: [...new Set(horizontal)],
            vertical: [...new Set(vertical)],
        });
    }, []);

    const clearAlignmentGuides = useCallback(() => {
        setAlignmentGuides({ horizontal: [], vertical: [] });
    }, []);

    return {
        zoom,
        setZoom,
        snapToGrid,
        setSnapToGrid,
        alignmentGuides,
        zoomIn,
        zoomOut,
        resetZoom,
        snapToGridPosition,
        calculateAlignmentGuides,
        clearAlignmentGuides,
    };
}
