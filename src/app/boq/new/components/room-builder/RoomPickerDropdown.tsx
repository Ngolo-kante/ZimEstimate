import React from 'react';
import { Plus, X } from '@phosphor-icons/react';
import { ROOM_TYPES } from './types';

interface RoomPickerDropdownProps {
    isOpen: boolean;
    onToggle: () => void;
    onAddRoom: (typeKey: string) => void;
}

export default function RoomPickerDropdown({ isOpen, onToggle, onAddRoom }: RoomPickerDropdownProps) {
    return (
        <div style={{ marginBottom: '24px', position: 'relative' }}>
            <button
                onClick={onToggle}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: isOpen ? 'var(--pw-fill-e5e7eb)' : 'var(--pw-fill-ffffff)',
                    border: '2px dashed var(--pw-line-9ca3af)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--pw-ink-374151)',
                    cursor: 'pointer',
                    transition: 'none',
                }}
            >
                {isOpen ? <X size={18} /> : <Plus size={18} />}
                {isOpen ? 'Close' : 'Add Room'}
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '8px',
                    background: 'var(--pw-fill-ffffff)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    border: '1px solid var(--pw-line-e5e7eb)',
                    padding: '8px',
                    zIndex: 100,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '4px',
                    minWidth: '280px',
                }}>
                    {ROOM_TYPES.map(type => (
                        <button
                            key={type.key}
                            onClick={() => onAddRoom(type.key)}
                            style={{
                                padding: '10px 14px',
                                background: 'var(--pw-fill-f9fafb)',
                                border: '1px solid var(--pw-line-e5e7eb)',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 500,
                                color: 'var(--pw-ink-374151)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'none',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#eff6ff';
                                e.currentTarget.style.borderColor = '#3b82f6';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f9fafb';
                                e.currentTarget.style.borderColor = '#e5e7eb';
                            }}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
