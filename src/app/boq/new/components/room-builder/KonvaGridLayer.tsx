import React, { useMemo } from 'react';
import { Circle, Layer } from 'react-konva';

interface KonvaGridLayerProps {
    width: number;
    height: number;
    gridSize: number;
}

export default function KonvaGridLayer({ width, height, gridSize }: KonvaGridLayerProps) {
    const dots = useMemo(() => {
        const result: { x: number; y: number }[] = [];
        for (let x = 0; x <= width; x += gridSize) {
            for (let y = 0; y <= height; y += gridSize) {
                result.push({ x, y });
            }
        }
        return result;
    }, [width, height, gridSize]);

    return (
        <Layer listening={false}>
            {dots.map((dot, i) => (
                <Circle
                    key={i}
                    x={dot.x}
                    y={dot.y}
                    radius={1}
                    fill="#d1d5db"
                />
            ))}
        </Layer>
    );
}
