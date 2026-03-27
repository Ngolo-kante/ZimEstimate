'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Card, { CardContent, CardHeader, CardTitle, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { suspendUser } from '@/lib/services/admin-analytics';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Star, Lock, LockOpen, MagnifyingGlass } from '@phosphor-icons/react';

interface SupplierRow {
  id: string;
  name: string;
  contact_email: string | null;
  verification_status: string;
  rating: number | null;
  user_id: string | null;
  is_suspended?: boolean;
}

export default function AdminPerformancePage() {
  const { adminId, checking } = useAdminAuth();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionSupplier, setActionSupplier] = useState<SupplierRow | null>(null);
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, contact_email, verification_status, rating, user_id')
      .is('deleted_at', null)
      .order('rating', { ascending: false, nullsFirst: false });
    setSuppliers((data ?? []) as SupplierRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!adminId) return;
    load();
  }, [adminId]);

  const handleSuspend = async () => {
    if (!actionSupplier?.user_id || !adminId) return;
    setProcessing(true);
    await suspendUser(actionSupplier.user_id, adminId, 'Suspended by admin from performance review');
    setProcessing(false);
    setActionSupplier(null);
    load();
  };

  const filtered = suppliers.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_email?.toLowerCase().includes(search.toLowerCase())
  );

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="no-rating">No rating</span>;
    return (
      <div className="star-row">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={14}
            weight={i <= Math.round(rating) ? 'fill' : 'regular'}
            className={i <= Math.round(rating) ? 'star-filled' : 'star-empty'}
          />
        ))}
        <span>{rating.toFixed(1)}</span>
      </div>
    );
  };

  if (checking) return <div className="admin-loading">Loading...</div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <Link href="/admin/suppliers" className="back-link">
          <ArrowLeft size={18} /> Admin
        </Link>
        <h1>Supplier Performance</h1>
      </div>

      <div className="filters-row">
        <div className="search-wrap">
          <MagnifyingGlass size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <Button size="sm" variant="secondary" onClick={load}>Refresh</Button>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <div className="table-loading">Loading...</div>
          ) : (
            <div className="perf-table">
              <div className="table-header">
                <span>Supplier</span>
                <span>Verification</span>
                <span>Rating</span>
                <span>Actions</span>
              </div>
              {filtered.map((s) => (
                <div key={s.id} className="table-row">
                  <div>
                    <div className="supplier-name">{s.name}</div>
                    <div className="supplier-email">{s.contact_email}</div>
                  </div>
                  <span>
                    <CardBadge
                      variant={
                        s.verification_status === 'verified' || s.verification_status === 'trusted'
                          ? 'success'
                          : s.verification_status === 'pending'
                          ? 'warning'
                          : 'default'
                      }
                    >
                      {s.verification_status}
                    </CardBadge>
                  </span>
                  <span>{renderStars(s.rating)}</span>
                  <div className="actions-cell">
                    {s.user_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Lock size={14} />}
                        onClick={() => setActionSupplier(s)}
                      >
                        Suspend
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={!!actionSupplier}
        title="Suspend Supplier"
        message={`Suspend ${actionSupplier?.name}? Their account will be locked immediately.`}
        confirmText="Suspend"
        variant="danger"
        onConfirm={handleSuspend}
        onClose={() => setActionSupplier(null)}
        isLoading={processing}
      />

      <style jsx>{`
        .admin-page { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
        .admin-loading { text-align: center; padding: 60px; color: #64748b; }
        .admin-header { margin-bottom: 24px; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; color: #64748b; font-size: 14px; text-decoration: none; margin-bottom: 10px; }
        .back-link:hover { color: #1e40af; }
        h1 { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0; }
        .filters-row { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; }
        .search-wrap { position: relative; flex: 1; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .search-input { width: 100%; padding: 8px 12px 8px 36px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; }
        .search-input:focus { outline: none; border-color: #1e40af; }
        .table-loading { text-align: center; padding: 40px; color: #94a3b8; }
        .perf-table { display: flex; flex-direction: column; }
        .table-header { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; padding: 8px 12px; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; }
        .table-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; padding: 14px 12px; border-bottom: 1px solid #f8fafc; align-items: center; font-size: 13px; }
        .table-row:last-child { border-bottom: none; }
        .supplier-name { font-size: 14px; font-weight: 600; color: #1e293b; }
        .supplier-email { font-size: 12px; color: #94a3b8; }
        .star-row { display: flex; align-items: center; gap: 3px; }
        :global(.star-filled) { color: #f59e0b; }
        :global(.star-empty) { color: #e2e8f0; }
        .star-row span { font-size: 13px; color: #475569; margin-left: 4px; }
        .no-rating { font-size: 12px; color: #94a3b8; }
        .actions-cell { display: flex; gap: 6px; }
      `}</style>
    </div>
  );
}
