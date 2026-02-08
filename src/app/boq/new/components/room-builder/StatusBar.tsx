import React from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { RoomInstance } from './types';

interface StatusBarProps {
    totals: { area: number; walls: number; bricks: number };
    isOverTarget: boolean;
    isMobile: boolean;
    onContinue: (rooms: RoomInstance[], totals: { area: number; walls: number; bricks: number }) => void;
    rooms: RoomInstance[];
}

export default function StatusBar({ totals, isOverTarget, isMobile, onContinue, rooms }: StatusBarProps) {
    return (
        <div style={{
            background: '#fff',
            borderTop: '1px solid #e5e7eb',
            padding: isMobile ? '12px 16px' : '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            position: 'sticky',
            bottom: 0,
            zIndex: 20,
            flexWrap: 'wrap',
            gap: isMobile ? '12px' : '16px',
        }}>
            <div style={{ display: 'flex', gap: isMobile ? '16px' : '40px', flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Total Area</div>
                    <div style={{
                        fontSize: isMobile ? '16px' : '18px',
                        fontWeight: 700,
                        color: isOverTarget ? '#dc2626' : '#10b981',
                    }}>
                        {totals.area.toFixed(1)}m²
                    </div>
                </div>
                {!isMobile && (
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Wall Area</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>{totals.walls.toFixed(1)}m²</div>
                    </div>
                )}
                <div>
                    <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Brick Count</div>
                    <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: '#10b981' }}>~{Math.ceil(totals.bricks).toLocaleString()}</div>
                </div>
            </div>

            <button
                onClick={() => onContinue(rooms, totals)}
                style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)',
                }}
            >
                CONTINUE TO SCOPE
                <ArrowRight size={18} weight="bold" />
            </button>
        </div>
    );
}
