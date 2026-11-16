'use client';

import { useId } from 'react';

import { Field, FieldGroup, FieldLabel } from '@/components/shadcn/field';
import { Input } from '@/components/shadcn/input';
import { NativeSelect } from '@/components/shadcn/native-select';


import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs';
import type { RefObject } from 'react';
import { COLUMN_LABELS, type ColumnKey } from './boqColumns';
import { CaretDown } from '@phosphor-icons/react';

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
    const controlId = useId();
    return (
            <div className="table-toolbar">
                <FieldGroup className="!grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field><FieldLabel htmlFor={`${controlId}-1`} className="sr-only">Search items</FieldLabel>

                        <Input id={`${controlId}-1`} className="!h-11 bg-sc-background text-sc-foreground transition-none"
                            type="text"
                            aria-label="Search items" placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </Field>
                    <Field><FieldLabel htmlFor={`${controlId}-2`} className="sr-only">Filter BOQ status</FieldLabel>

                        <NativeSelect id={`${controlId}-2`} className="w-full [&_select]:!h-11 [&_select]:bg-sc-background [&_select]:text-base [&_select]:transition-none"
                            aria-label="Filter BOQ status" value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'in_progress' | 'purchased' | 'over_purchased')}
                        >
                            <option value="all">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In progress</option>
                            <option value="purchased">Purchased</option>
                            <option value="over_purchased">Over-purchased</option>
                        </NativeSelect>

                    </Field>
                </FieldGroup>
                <div className="toolbar-right">
                    <Tabs value={viewPreset} onValueChange={value => applyPreset(value as 'simple' | 'detailed')}>
                        <TabsList aria-label="BOQ detail" className="!h-auto">
                            <TabsTrigger className="min-h-11 text-sc-muted-foreground transition-none" value="simple">Simple</TabsTrigger>
                            <TabsTrigger className="min-h-11 text-sc-muted-foreground transition-none" value="detailed">Detailed</TabsTrigger>
                        </TabsList>
                    </Tabs>
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
