'use client';

import { Input } from '@/components/shadcn/input';
import { NativeSelect } from '@/components/shadcn/native-select';
import Button from '@/components/ui/Button';
import type { GroupByOption, StatusFilter } from '@/lib/projects/procurement';
import { DownloadSimple, MagnifyingGlass } from '@phosphor-icons/react';

export interface ProcurementToolbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  groupBy: GroupByOption;
  setGroupBy: (groupBy: GroupByOption) => void;
  onExportCsv: () => void;
}

/** Search, filter, grouping and CSV export. */
export default function ProcurementToolbar({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  groupBy,
  setGroupBy,
  onExportCsv,
}: ProcurementToolbarProps) {
  return (
    <div className="procurement-toolbar !rounded-lg">
      <div className="toolbar-left">
        <div className="search-box">
          <MagnifyingGlass className="search-icon" size={16} />
          <Input
            type="text"
            aria-label="Search procurement materials"
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input !h-11"
          />
        </div>
        <NativeSelect
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="status-filter [&_select]:h-11"
        >
          <option value="all">All status</option>
          <option value="outstanding">Needs purchasing</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="purchased">Purchased</option>
          <option value="over_purchased">Over-purchased</option>
        </NativeSelect>
      </div>

      <div className="toolbar-right">
        <div className="group-toggle">
          <NativeSelect
            aria-label="Group by"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
            className="group-select [&_select]:h-11"
          >
            <option value="stage">By stage</option>
            <option value="category">By category</option>
            <option value="none">No grouping</option>
          </NativeSelect>
        </div>
        <Button className="min-h-11" variant="ghost" icon={<DownloadSimple size={16} />} onClick={onExportCsv} aria-label="Export purchases as CSV">
          <span className="btn-text-desktop">Export CSV</span>
        </Button>
      </div>
    </div>
  );
}
