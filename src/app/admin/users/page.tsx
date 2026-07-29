'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import { listAllUsers, suspendUser, reactivateUser, type UserListRow } from '@/lib/services/admin-analytics';
import type { UserType } from '@/lib/database.types';
import {
  ArrowLeft,
  MagnifyingGlass,
  UserCircle,
  Lock,
  LockOpen,
  ArrowLeft as PrevIcon,
  ArrowRight as NextIcon,
} from '@phosphor-icons/react';

const USER_TYPE_LABELS: Record<UserType, string> = {
  builder: 'Builder',
  supplier: 'Supplier',
  admin: 'Admin',
};

export default function AdminUsersPage() {
  const { adminId, checking } = useAdminAuth();
  const [users, setUsers] = useState<UserListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<UserType | ''>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionUser, setActionUser] = useState<UserListRow | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'reactivate' | null>(null);
  const [processing, setProcessing] = useState(false);

  const PAGE_SIZE = 25;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listAllUsers({
        search: search || undefined,
        userType: typeFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setUsers(result.users);
      setTotal(result.total);
    } catch (error) {
      // Without this the spinner stayed up for good on any rejection.
      setLoadError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, page]);

  useEffect(() => {
    if (!adminId) return;
    void Promise.resolve().then(loadUsers);
  }, [adminId, loadUsers]);

  const handleAction = async () => {
    if (!actionUser || !adminId || !actionType) return;
    setProcessing(true);

    if (actionType === 'suspend') {
      await suspendUser(actionUser.id, adminId);
    } else {
      await reactivateUser(actionUser.id, adminId);
    }

    setProcessing(false);
    setActionUser(null);
    setActionType(null);
    loadUsers();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (checking) return <div className="admin-loading">Loading...</div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <Link href="/admin/suppliers" className="back-link">
          <ArrowLeft size={18} /> Admin
        </Link>
        <h1>User Management</h1>
        <p className="header-sub">{total.toLocaleString()} total users</p>
      </div>

      <div className="filters-row">
        <div className="search-wrap">
          <MagnifyingGlass size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="search-input"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value as UserType | ''); setPage(1); }}
          className="type-filter"
        >
          <option value="">All types</option>
          <option value="builder">Builders</option>
          <option value="supplier">Suppliers</option>
          <option value="admin">Admins</option>
        </select>
        <Button size="sm" variant="secondary" onClick={loadUsers}>Refresh</Button>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <LoadingState variant="table" rows={6} label="Loading users" />
          ) : loadError ? (
            <ErrorState
              whatFailed="The user list could not be loaded."
              technicalDetail={loadError}
              onRetry={() => void loadUsers()}
            />
          ) : users.length === 0 ? (
            <EmptyState
              headline="No users found"
              description={search || typeFilter ? 'Try clearing the search or filter.' : 'Users will appear here once people sign up.'}
            />
          ) : (
            <>
              <div className="users-table">
                <div className="table-header">
                  <span>User</span>
                  <span>Type</span>
                  <span>Tier</span>
                  <span>Joined</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {users.map((u) => (
                  <div key={u.id} className={`table-row ${u.is_suspended ? 'suspended' : ''}`}>
                    <div className="user-cell">
                      <UserCircle size={20} className="user-icon" />
                      <div>
                        <div className="user-name">{u.full_name || '—'}</div>
                        <div className="user-email">{u.email}</div>
                      </div>
                    </div>
                    <span>
                      <span className={`type-badge type-${u.user_type}`}>
                        {USER_TYPE_LABELS[u.user_type]}
                      </span>
                    </span>
                    <span className="tier-label">{u.tier}</span>
                    <span className="date-label">{new Date(u.created_at).toLocaleDateString()}</span>
                    <span>
                      {u.is_suspended ? (
                        <span className="status-suspended">Suspended</span>
                      ) : (
                        <span className="status-active">Active</span>
                      )}
                    </span>
                    <div className="actions-cell">
                      {u.is_suspended ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<LockOpen size={14} />}
                          onClick={() => { setActionUser(u); setActionType('reactivate'); }}
                        >
                          Reactivate
                        </Button>
                      ) : u.tier !== 'admin' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Lock size={14} />}
                          onClick={() => { setActionUser(u); setActionType('suspend'); }}
                        >
                          Suspend
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<PrevIcon size={14} />}
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Prev
                  </Button>
                  <span className="page-info">Page {page} of {totalPages}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <NextIcon size={14} />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={!!actionUser && !!actionType}
        title={actionType === 'suspend' ? 'Suspend Account' : 'Reactivate Account'}
        message={
          actionType === 'suspend'
            ? `Suspend ${actionUser?.email}? They will lose access immediately.`
            : `Reactivate ${actionUser?.email}? They will regain full access.`
        }
        confirmText={actionType === 'suspend' ? 'Suspend' : 'Reactivate'}
        variant={actionType === 'suspend' ? 'danger' : 'warning'}
        onConfirm={handleAction}
        onClose={() => { setActionUser(null); setActionType(null); }}
        isLoading={processing}
      />

      <style jsx>{`
        .admin-page { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
        .admin-loading { text-align: center; padding: 60px; color: #64748b; }
        .admin-header { margin-bottom: 24px; }
        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          color: #64748b; font-size: 14px; text-decoration: none; margin-bottom: 10px;
        }
        .back-link:hover { color: #1e40af; }
        h1 { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .header-sub { font-size: 14px; color: #94a3b8; margin: 0; }
        .filters-row { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; }
        .search-wrap { position: relative; flex: 1; min-width: 200px; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .search-input {
          width: 100%; padding: 8px 12px 8px 36px; border: 1px solid #e2e8f0;
          border-radius: 10px; font-size: 14px; color: #334155;
        }
        .search-input:focus { outline: none; border-color: #1e40af; }
        .type-filter { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; }
        .table-loading, .empty-state { text-align: center; padding: 40px; color: #94a3b8; }
        .users-table { display: flex; flex-direction: column; }
        .table-header {
          display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1.5fr;
          padding: 8px 12px; font-size: 11px; font-weight: 600; color: #94a3b8;
          text-transform: uppercase; border-bottom: 1px solid #f1f5f9;
        }
        .table-row {
          display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1.5fr;
          padding: 12px; border-bottom: 1px solid #f8fafc; align-items: center; font-size: 13px;
        }
        .table-row.suspended { background: #fef2f2; }
        .table-row:last-child { border-bottom: none; }
        .user-cell { display: flex; align-items: center; gap: 10px; }
        .user-icon { color: #94a3b8; flex-shrink: 0; }
        .user-name { font-size: 14px; font-weight: 600; color: #1e293b; }
        .user-email { font-size: 12px; color: #94a3b8; }
        .type-badge {
          padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;
        }
        .type-builder { background: #dbeafe; color: #1e40af; }
        .type-supplier { background: #dcfce7; color: #166534; }
        .type-admin { background: #fef3c7; color: #92400e; }
        .tier-label { font-size: 13px; color: #64748b; }
        .date-label { font-size: 12px; color: #94a3b8; }
        .status-active { font-size: 12px; color: #16a34a; font-weight: 600; }
        .status-suspended { font-size: 12px; color: #dc2626; font-weight: 600; }
        .actions-cell { display: flex; gap: 6px; }
        .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px 0 0; }
        .page-info { font-size: 13px; color: #64748b; }
        @media (max-width: 768px) {
          .table-header { grid-template-columns: 2fr 1fr 1fr; }
          .table-row { grid-template-columns: 2fr 1fr 1fr; }
          .table-header span:nth-child(n+4), .table-row > *:nth-child(n+4) { display: none; }
          .actions-cell { display: flex; }
        }
      `}</style>
    </div>
  );
}
