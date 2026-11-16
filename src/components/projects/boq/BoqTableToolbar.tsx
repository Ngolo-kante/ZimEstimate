'use client';

import type { RefObject } from 'react';
import { COLUMN_LABELS, type ColumnKey } from './boqColumns';
import { CaretDown, Funnel, MagnifyingGlass } from '@phosphor-icons/react';

export type StatusFilterValue = 'all' | 'pending' | 'in_progress' | 'purchased' | 'over_purchased';

export interface BoqTableToolbarProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: StatusFilterValue;
    setStatusFilter: (filter: StatusFilterValue) => void;
    viewPreset: 'simple' | 'detailed' | 'custom';
    applyPreset: (preset: 'simple' | 'detailed') => void;
    columnsMenuRef: RefObject<HTMLDivElement | null>;
    isColumnsOpen: boolean;
    setIsColumnsOpen: (update: (open: boolean) => boolean) => void;
    visibleColumns: Record<ColumnKey, boolean>;
    toggleColumn: (key: ColumnKey) => void;
    usageTrackingEnabled: boolean;
}

/** Search, status filter, simple or detailed view, and column choice. */
export default function BoqTableToolbar({
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    viewPreset,
    applyPreset,
    columnsMenuRef,
    isColumnsOpen,
    setIsColumnsOpen,
    visibleColumns,
    toggleColumn,
    usageTrackingEnabled,
}: BoqTableToolbarProps) {
    return (
            <div className="table-toolbar">
                <div className="toolbar-left">
                    <div className="search-input">
                        <MagnifyingGlass size={14} />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="select-wrapper filter-select">
                        <Funnel size={14} className="filter-icon" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'in_progress' | 'purchased' | 'over_purchased')}
                        >
                            <option value="all">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In progress</option>
                            <option value="purchased">Purchased</option>
                            <option value="over_purchased">Over-purchased</option>
                        </select>
                        <CaretDown size={14} className="select-arrow" />
                    </div>
                </div>
                <div className="toolbar-right">
                    <div className="view-toggle">
                        <button
                            type="button"
                            className={`simple-btn ${viewPreset === 'simple' ? 'active' : ''}`}
                            onClick={() => applyPreset('simple')}
                        >
                            Simple
                        </button>
                        <button
                            type="button"
                            className={`detailed-btn ${viewPreset === 'detailed' ? 'active' : ''}`}
                            onClick={() => applyPreset('detailed')}
                        >
                            Detailed
                        </button>
                    </div>
                    <div className="columns-dropdown" ref={columnsMenuRef}>
                        <button
                            type="button"
                            className="columns-btn"
                            onClick={() => setIsColumnsOpen(prev => !prev)}
                        >
                            Columns
                            <CaretDown size={12} />
                        </button>
                        {isColumnsOpen && (
                            <div className="columns-menu">
                                {Object.keys(COLUMN_LABELS).map((key) => {
                                    const columnKey = key as ColumnKey;
                                    const isLocked = columnKey === 'item';
                                    return (
                                        <label
                                            key={columnKey}
                                            className={`column-option ${isLocked ? 'locked' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns[columnKey]}
                                                onChange={() => toggleColumn(columnKey)}
                                                disabled={isLocked}
                                            />
                                            <span>{COLUMN_LABELS[columnKey]}</span>
                                        </label>
                                    );
                                })}
                                {!usageTrackingEnabled && (
                                    <div className="column-hint">
                                        Enable usage tracking to populate the Usage column.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
    );
}
