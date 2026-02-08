import React from 'react';
import { Line, Rect, Arc } from 'react-konva';
import { WallFeature } from './types';

interface KonvaWallSegmentProps {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    type: WallFeature;
    color: string;
    isVertical?: boolean;
    onClick: () => void;
}

export default function KonvaWallSegment({
    x1, y1, x2, y2,
    type,
    color,
    isVertical,
    onClick,
}: KonvaWallSegmentProps) {
    const totalLength = Math.abs(isVertical ? y2 - y1 : x2 - x1);
    const featureSize = Math.min(totalLength * 0.6, 60);
    const half = featureSize / 2;

    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    const gapStart = isVertical ? { x: x1, y: cy - half } : { x: cx - half, y: y1 };
    const gapEnd = isVertical ? { x: x2, y: cy + half } : { x: cx + half, y: y2 };

    return (
        <>
            {/* Invisible hit area for easier clicking */}
            <Line
                points={[x1, y1, x2, y2]}
                stroke="transparent"
                strokeWidth={20}
                onClick={onClick}
                onTap={onClick}
            />

            {/* Wall start segment */}
            <Line
                points={type === 'solid'
                    ? [x1, y1, x2, y2]
                    : [x1, y1, gapStart.x, gapStart.y]
                }
                stroke={color}
                strokeWidth={4}
                lineCap="round"
                onClick={onClick}
                onTap={onClick}
            />

            {/* Wall end segment (only for non-solid) */}
            {type !== 'solid' && (
                <Line
                    points={[gapEnd.x, gapEnd.y, x2, y2]}
                    stroke={color}
                    strokeWidth={4}
                    lineCap="round"
                    onClick={onClick}
                    onTap={onClick}
                />
            )}

            {/* Window: blue rect */}
            {type === 'window' && (
                <Rect
                    x={isVertical ? x1 - 4 : gapStart.x}
                    y={isVertical ? gapStart.y : y1 - 4}
                    width={isVertical ? 8 : featureSize}
                    height={isVertical ? featureSize : 8}
                    fill="#bfdbfe"
                    stroke="#3b82f6"
                    strokeWidth={1}
                    cornerRadius={1}
                    onClick={onClick}
                    onTap={onClick}
                />
            )}

            {/* Door: arc */}
            {type === 'door' && (
                <Arc
                    x={isVertical ? x1 : gapStart.x}
                    y={isVertical ? gapStart.y : y1}
                    innerRadius={0}
                    outerRadius={featureSize * 0.8}
                    angle={90}
                    rotation={isVertical ? 0 : 0}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={1.5}
                    dash={[3, 3]}
                    onClick={onClick}
                    onTap={onClick}
                />
            )}

            {/* Opening: dashed line */}
            {type === 'opening' && (
                <Line
                    points={[gapStart.x, gapStart.y, gapEnd.x, gapEnd.y]}
                    stroke={color}
                    strokeWidth={1.5}
                    dash={[4, 4]}
                    opacity={0.6}
                    onClick={onClick}
                    onTap={onClick}
                />
            )}
        </>
    );
}
