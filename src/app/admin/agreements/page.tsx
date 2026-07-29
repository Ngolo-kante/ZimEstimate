'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getAllAgreements } from '@/lib/services/admin-analytics';
import { ArrowLeft, FileText, CheckCircle } from '@phosphor-icons/react';

interface Agreement {
  id: string;
  supplier_id: string;
  agreement_type: string;
  version: string;
  accepted_at: string;
  ip_address: string | null;
  suppliers?: { name: string; contact_email: string | null } | null;
}

export default function AdminAgreementsPage() {
  const { adminId, checking } = useAdminAuth();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllAgreements({ page });
      setAgreements(result.agreements as Agreement[]);
      setTotal(result.total);
    } finally {
      // Guarantees the spinner clears even if a query rejects.
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!adminId) return;
    void Promise.resolve().then(load);
  }, [adminId, load]);

  const totalPages = Math.ceil(total / 25);

  if (checking) return <div className="admin-loading">Loading...</div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <Link href="/admin/suppliers" className="back-link">
          <ArrowLeft size={18} /> Admin
        </Link>
        <h1>Supplier Agreements</h1>
        <p className="header-sub">{total} acceptance records</p>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <div className="table-loading">Loading agreements...</div>
          ) : agreements.length === 0 ? (
            <div className="empty-state">
              <FileText size={40} />
              <p>No agreements recorded yet.</p>
            </div>
          ) : (
            <>
              <div className="agr-table">
                <div className="table-header">
                  <span>Supplier</span>
                  <span>Agreement Type</span>
                  <span>Version</span>
                  <span>Accepted At</span>
                  <span>IP Address</span>
                </div>
                {agreements.map((a) => (
                  <div key={a.id} className="table-row">
                    <div>
                      <div className="supplier-name">{a.suppliers?.name ?? '—'}</div>
                      <div className="supplier-email">{a.suppliers?.contact_email ?? ''}</div>
                    </div>
                    <div className="agr-type">
                      <CheckCircle size={14} className="check-icon" />
                      {a.agreement_type.replace(/_/g, ' ')}
                    </div>
                    <span className="version-badge">v{a.version}</span>
                    <span className="date-cell">{new Date(a.accepted_at).toLocaleString()}</span>
                    <span className="ip-cell">{a.ip_address ?? '—'}</span>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="pagination">
                  <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  <span className="page-info">Page {page} of {totalPages}</span>
                  <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </>
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
        .table-loading { text-align: center; padding: 40px; color: #94a3b8; }
        .empty-state { text-align: center; padding: 60px; color: #94a3b8; }
        .empty-state p { font-size: 16px; font-weight: 600; color: #475569; margin: 12px 0 0; }
        .agr-table { display: flex; flex-direction: column; }
        .table-header {
          display: grid; grid-template-columns: 2fr 1.5fr 1fr 1.5fr 1fr;
          padding: 8px 12px; font-size: 11px; font-weight: 600; color: #94a3b8;
          text-transform: uppercase; border-bottom: 1px solid #f1f5f9;
        }
        .table-row {
          display: grid; grid-template-columns: 2fr 1.5fr 1fr 1.5fr 1fr;
          padding: 14px 12px; border-bottom: 1px solid #f8fafc; align-items: center; font-size: 13px;
        }
        .table-row:last-child { border-bottom: none; }
        .supplier-name { font-size: 14px; font-weight: 600; color: #1e293b; }
        .supplier-email { font-size: 12px; color: #94a3b8; }
        .agr-type { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #334155; text-transform: capitalize; }
        :global(.check-icon) { color: #16a34a; flex-shrink: 0; }
        .version-badge { display: inline-block; padding: 2px 8px; background: #f1f5f9; border-radius: 6px; font-size: 12px; color: #475569; }
        .date-cell { font-size: 12px; color: #64748b; }
        .ip-cell { font-size: 12px; color: #94a3b8; font-family: monospace; }
        .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px 0 0; }
        .page-info { font-size: 13px; color: #64748b; }
      `}</style>
    </div>
  );
}
