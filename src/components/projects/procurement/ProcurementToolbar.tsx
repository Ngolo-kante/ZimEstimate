'use client';

import Button from '@/components/ui/Button';
import type { GroupByOption, StatusFilter } from '@/lib/projects/procurement';
import { DownloadSimple, Funnel, MagnifyingGlass } from '@phosphor-icons/react';

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
          <input
            type="text"
            aria-label="Search procurement materials"
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input !h-11"
          />
        </div>
        <select
          aria-label="Filter materials by purchase status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="status-filter !h-11"
        >
          <option value="all">All Status</option>
          <option value="outstanding">Needs Purchasing</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="purchased">Purchased</option>
          <option value="over_purchased">Over Purchased</option>
        </select>
      </div>

      <div className="toolbar-right">
        <div className="group-toggle">
          <Funnel size={14} />
          <span className="group-label">Group:</span>
          <select
            aria-label="Group procurement materials"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
            className="group-select !h-11"
          >
            <option value="stage">By Stage</option>
            <option value="category">By Category</option>
            <option value="none">No Grouping</option>
          </select>
        </div>
        <Button className="min-h-11" variant="ghost" icon={<DownloadSimple size={16} />} onClick={onExportCsv} aria-label="Export purchases as CSV">
          <span className="btn-text-desktop">Export CSV</span>
        </Button>
      </div>
    </div>
  );
}
