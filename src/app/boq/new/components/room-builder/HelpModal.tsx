import React from 'react';
import { Keyboard, X } from '@phosphor-icons/react';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SHORTCUTS = [
    { k: 'Click Wall', d: 'Toggle: Door / Window / Open' },
    { k: 'Arrow Keys', d: 'Nudge selected room' },
    { k: 'Delete / Backspace', d: 'Remove selected room' },
    { k: 'Ctrl + C', d: 'Copy room' },
    { k: 'Ctrl + V', d: 'Paste room' },
    { k: 'Ctrl + D', d: 'Duplicate room' },
    { k: 'R', d: 'Rotate room (swap L/W)' },
    { k: 'Ctrl + Z', d: 'Undo' },
    { k: 'Ctrl + Y', d: 'Redo' },
    { k: 'G', d: 'Toggle Grid Snap' },
    { k: '+ / -', d: 'Zoom In / Out' },
    { k: 'Esc', d: 'Deselect / Cancel' },
    { k: 'Shift + ?', d: 'Show this help' },
];

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
                backdropFilter: 'blur(2px)',
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#fff',
                    borderRadius: '16px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                    width: '90%',
                    maxWidth: '500px',
                    maxHeight: '80vh',
                    overflow: 'auto',
                    padding: '24px',
                    position: 'relative',
                }}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9ca3af',
                    }}
                >
                    <X size={20} />
                </button>

                <h3 style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#1f2937',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <Keyboard size={24} weight="fill" color="#3b82f6" />
                    Keyboard Shortcuts
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                    {SHORTCUTS.map((item, i) => (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 0',
                                borderBottom: '1px solid #f3f4f6',
                            }}
                        >
                            <span style={{ fontSize: '14px', color: '#4b5563' }}>{item.d}</span>
                            <span style={{
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#374151',
                                background: '#f3f4f6',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid #e5e7eb',
                            }}>
                                {item.k}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
