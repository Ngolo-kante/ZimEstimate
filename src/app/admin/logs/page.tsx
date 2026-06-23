'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getAuditLogs } from '@/lib/services/admin-analytics';
import { ArrowLeft, ClockCountdown } from '@phosphor-icons/react';

interface LogRow {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  profiles?: { email: string; full_name: string | null } | null;
}

export default function AdminLogsPage() {
  const { adminId, checking } = useAdminAuth();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [resourceType, setResourceType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const result = await getAuditLogs({
      resourceType: resourceType || undefined,
      fromDate: fromDate || undefined,
      page,
      pageSize: 25,
    });
    setLogs(result.logs as LogRow[]);
    setTotal(result.total);
    setLoading(false);
  }, [resourceType, fromDate, page]);

  useEffect(() => {
    if (!adminId) return;
    void Promise.resolve().then(loadLogs);
  }, [adminId, loadLogs]);

  const totalPages = Math.ceil(total / 25);

  if (checking) return <div className="admin-loading">Loading...</div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <Link href="/admin/suppliers" className="back-link">
          <ArrowLeft size={18} /> Admin
        </Link>
        <h1>System Audit Logs</h1>
        <p className="header-sub">{total.toLocaleString()} total entries</p>
      </div>

      <div className="filters-row">
        <select
          value={resourceType}
          onChange={(e) => { setResourceType(e.target.value); setPage(1); }}
          className="filter-select"
        >
          <option value="">All resource types</option>
          <option value="profile">Profile</option>
          <option value="supplier_subscription">Subscription</option>
          <option value="supplier">Supplier</option>
          <option value="support_ticket">Support Ticket</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          className="filter-date"
        />
        <Button size="sm" variant="secondary" onClick={loadLogs}>Apply</Button>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <div className="table-loading">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">No audit logs found.</div>
          ) : (
            <div className="logs-list">
              {logs.map((log) => (
                <div key={log.id} className="log-entry">
                  <div
                    className="log-row"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <div className="log-time">
                      <ClockCountdown size={13} />
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    <div className="log-action">
                      <span className="action-chip">{log.action}</span>
                    </div>
                    <div className="log-resource">
                      {log.resource_type}
                      {log.resource_id && (
                        <span className="resource-id">:{log.resource_id.slice(0, 8)}</span>
                      )}
                    </div>
                    <div className="log-user">
                      {log.profiles?.email ?? log.user_id?.slice(0, 8) ?? 'System'}
                    </div>
                  </div>
                  {expandedId === log.id && (
                    <div className="log-meta">
                      <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                      {log.ip_address && <div className="log-ip">IP: {log.ip_address}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <span className="page-info">Page {page} of {totalPages}</span>
              <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <style jsx>{`
        .admin-page { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
        .admin-loading { text-align: center; padding: 60px; color: #64748b; }
        .admin-header { margin-bottom: 24px; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; color: #64748b; font-size: 14px; text-decoration: none; margin-bottom: 10px; }
        .back-link:hover { color: #1e40af; }
        h1 { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .header-sub { font-size: 14px; color: #94a3b8; margin: 0; }
        .filters-row { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; }
        .filter-select, .filter-date { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; }
        .table-loading, .empty-state { text-align: center; padding: 40px; color: #94a3b8; }
        .logs-list { display: flex; flex-direction: column; }
        .log-entry { border-bottom: 1px solid #f1f5f9; }
        .log-entry:last-child { border-bottom: none; }
        .log-row {
          display: grid; grid-template-columns: 180px 1fr 1fr 1fr;
          padding: 12px; cursor: pointer; font-size: 13px; color: #334155;
          align-items: center; gap: 8px;
        }
        .log-row:hover { background: #f8fafc; }
        .log-time { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #94a3b8; }
        .action-chip {
          display: inline-block; padding: 2px 8px; background: #f1f5f9;
          border-radius: 6px; font-size: 12px; font-weight: 600; color: #475569; font-family: monospace;
        }
        .log-resource { font-size: 12px; color: #64748b; font-family: monospace; }
        .resource-id { color: #94a3b8; }
        .log-user { font-size: 12px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .log-meta {
          padding: 12px 16px; background: #f8fafc; border-top: 1px solid #f1f5f9;
        }
        .log-meta pre { font-size: 12px; color: #475569; margin: 0; white-space: pre-wrap; word-break: break-all; }
        .log-ip { font-size: 12px; color: #94a3b8; margin-top: 8px; }
        .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px 0 0; }
        .page-info { font-size: 13px; color: #64748b; }
        @media (max-width: 600px) {
          .log-row { grid-template-columns: 1fr 1fr; }
          .log-row > *:nth-child(3), .log-row > *:nth-child(4) { display: none; }
        }
      `}</style>
    </div>
  );
}
