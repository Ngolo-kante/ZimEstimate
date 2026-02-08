import React from 'react';
import { Layer, Line } from 'react-konva';

interface KonvaAlignmentGuidesProps {
    horizontal: number[];
    vertical: number[];
    canvasWidth: number;
    canvasHeight: number;
}

export default function KonvaAlignmentGuides({ horizontal, vertical, canvasWidth, canvasHeight }: KonvaAlignmentGuidesProps) {
    if (horizontal.length === 0 && vertical.length === 0) return null;

    return (
        <Layer listening={false}>
            {horizontal.map((y, i) => (
                <Line
                    key={`h-${i}`}
                    points={[0, y, canvasWidth, y]}
                    stroke="#f43f5e"
                    strokeWidth={1}
                    dash={[4, 2]}
                />
            ))}
            {vertical.map((x, i) => (
                <Line
                    key={`v-${i}`}
                    points={[x, 0, x, canvasHeight]}
                    stroke="#f43f5e"
                    strokeWidth={1}
                    dash={[4, 2]}
                />
            ))}
        </Layer>
    );
}
