'use client';

import UsageCompactRow from './UsageCompactRow';
import { formatQuantity } from '@/lib/format';

import { formatUsageDate } from '@/lib/projects/usageStats';

import type { MaterialUsage } from '@/lib/database.types';
import type { MaterialUsageStat } from '@/lib/projects/usageStats';
import { Package, CaretDown, CaretUp } from '@phosphor-icons/react';

export interface UsageMaterialsTabProps {
  usageStats: MaterialUsageStat[];
  usageByMaterial: Record<string, MaterialUsage[]>;
  expandedMaterials: Set<string>;
  toggleMaterialExpanded: (itemId: string) => void;
}

/** Each material's usage, opening to its history. */
export default function UsageMaterialsTab({
  usageStats,
  usageByMaterial,
  expandedMaterials,
  toggleMaterialExpanded,
}: UsageMaterialsTabProps) {
  return (
    <div className="materials-tab">
      <div className="materials-header">
        <h3>Material usage history</h3>
        <p>Click on a material to see its usage history.</p>
      </div>
      <div className="materials-list">
        {usageStats.map((stat) => {
          const isExpanded = expandedMaterials.has(stat.item.id);
          const materialHistory = usageByMaterial[stat.item.id] || [];
          const hasHistory = materialHistory.length > 0;

          return (
            <div key={stat.item.id}>
              <div className="usage-mobile-list"><UsageCompactRow name={stat.item.material_name} fact={!Number(stat.item.unit_price_usd) ? 'No price yet' : `${formatQuantity(stat.remainingQty)} ${stat.item.unit} left`} percent={stat.usagePercent}>
                <dl><div><dt>Available</dt><dd>{formatQuantity(stat.availableQty)} {stat.item.unit}</dd></div><div><dt>Used</dt><dd>{formatQuantity(stat.usedQty)} {stat.item.unit}</dd></div><div><dt>Remaining</dt><dd>{formatQuantity(stat.remainingQty)} {stat.item.unit}</dd></div></dl>
                {materialHistory.map(usage => <p key={usage.id}>{formatUsageDate(usage.usage_date, { day: '2-digit', month: 'short', year: 'numeric' })} · {formatQuantity(usage.quantity_used)} {stat.item.unit}{usage.notes && ` · ${usage.notes}`}</p>)}
              </UsageCompactRow></div>
            <div className={`usage-desktop-list material-card ${isExpanded ? 'expanded' : ''}`}>
              <div
                className="material-header"
                onClick={() => hasHistory && toggleMaterialExpanded(stat.item.id)}
                onKeyDown={(event) => { if (hasHistory && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); toggleMaterialExpanded(stat.item.id); } }}
                aria-expanded={hasHistory ? isExpanded : undefined}
                role={hasHistory ? 'button' : undefined}
                tabIndex={hasHistory ? 0 : undefined}
              >
                <div className="material-expand">
                  {hasHistory ? (
                    isExpanded ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />
                  ) : (
                    <span className="expand-placeholder" />
                  )}
                </div>
                <div className="material-info">
                  <span className="material-name" title={stat.item.material_name}>{stat.item.material_name}</span>{!Number(stat.item.unit_price_usd) && <span className="muted">No price yet</span>}
                  <span className="material-unit">{stat.item.unit}</span>
                </div>
                <div className="material-stats">
                  <div className="stat-group">
                    <span className="stat-label">Available</span>
                    <span className="stat-value">{formatQuantity(stat.availableQty)}</span>
                  </div>
                  <div className="stat-group">
                    <span className="stat-label">Used</span>
                    <span className="stat-value used">{formatQuantity(stat.usedQty)}</span>
                  </div>
                  <div className="stat-group">
                    <span className="stat-label">Remaining</span>
                    <span className={`stat-value ${stat.remainingQty <= 0 ? 'depleted' : ''}`}>
                      {formatQuantity(stat.remainingQty)}
                    </span>
                  </div>
                </div>
                <div className="material-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(stat.usagePercent, 100)}%` }}
                    />
                  </div>
                  <span className="progress-text">{stat.usagePercent.toFixed(0)}%</span>
                </div>
                {hasHistory && (
                  <span className="history-count">{materialHistory.length} log{materialHistory.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {isExpanded && hasHistory && (
                <div className="material-history">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th className="col-date">Date</th>
                        <th className="col-qty">Quantity</th>
                        <th className="col-notes">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialHistory.map((usage) => (
                        <tr key={usage.id}>
                          <td className="col-date">
                            {formatUsageDate(usage.usage_date, {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="col-qty">{formatQuantity(usage.quantity_used)} {stat.item.unit}</td>
                          <td className="col-notes">{usage.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="footer-label">Total used</td>
                        <td className="col-qty bold">{formatQuantity(stat.usedQty)} {stat.item.unit}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div></div>
          );
        })}
        {usageStats.length === 0 && (
          <div className="empty-materials">
            <Package size={32} />
            <p>No materials to track.</p>
          </div>
        )}
      </div>
    </div>
  );
}
