'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Card, { CardContent, CardBadge } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import Button from '@/components/ui/Button';
import {
  getAllTickets,
  getTicketReplies,
  addTicketReply,
  updateTicketStatus,
} from '@/lib/services/admin-analytics';
import { ArrowLeft, ChatCircleText, X } from '@phosphor-icons/react';

const PRIORITY_VARIANT: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  urgent: 'error',
  high: 'warning',
  normal: 'info',
  low: 'default',
};

const STATUS_VARIANT: Record<string, 'error' | 'warning' | 'success' | 'default' | 'info'> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  closed: 'default',
};

interface Ticket {
  id: string;
  // Null on tickets filed from the public support form. Typing this as a plain
  // string is why `user_id.slice(...)` below type-checked and then threw at
  // runtime, taking the whole list down with it.
  user_id: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  created_at: string;
  profiles?: { email: string; full_name: string | null } | null;
}

interface Reply {
  id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  profiles?: { email: string; full_name: string | null } | null;
}

/**
 * Who to answer. A signed-in user is identified by their account; a ticket from
 * the public form carries its own contact details instead, and those are the
 * only way to reply to it.
 */
function requesterLabel(t: Ticket): string {
  if (t.profiles?.email) return t.profiles.email;
  if (t.contact_email) return t.contact_name ? `${t.contact_name} · ${t.contact_email}` : t.contact_email;
  return t.user_id ? t.user_id.slice(0, 8) : 'Anonymous';
}

export default function AdminTicketsPage() {
  const { adminId, checking } = useAdminAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [page, setPage] = useState(1);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getAllTickets({ status: statusFilter || undefined, page, pageSize: 25 });
      setTickets(result.tickets as Ticket[]);
      setTotal(result.total);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      // Guarantees the spinner clears even if a query rejects.
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    if (!adminId) return;
    void Promise.resolve().then(loadTickets);
  }, [adminId, loadTickets]);

  const openTicket = async (t: Ticket) => {
    setSelectedTicket(t);
    const r = await getTicketReplies(t.id);
    setReplies(r as Reply[]);
  };

  const handleReply = async () => {
    if (!selectedTicket || !adminId || !replyBody.trim()) return;
    setReplyLoading(true);
    await addTicketReply(selectedTicket.id, adminId, replyBody.trim(), false);
    const r = await getTicketReplies(selectedTicket.id);
    setReplies(r as Reply[]);
    setReplyBody('');
    setReplyLoading(false);
  };

  const handleStatusChange = async (ticketId: string, status: string) => {
    await updateTicketStatus(ticketId, status);
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket((t) => t ? { ...t, status } : t);
    }
    loadTickets();
  };

  if (checking) return <div className="admin-loading">Loading...</div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <Link href="/admin/suppliers" className="back-link">
          <ArrowLeft size={18} /> Admin
        </Link>
        <h1>Support Tickets</h1>
        <p className="header-sub">{total} tickets</p>
      </div>

      <div className="filters-row">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="filter-select">
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <Button size="sm" variant="secondary" onClick={loadTickets}>Refresh</Button>
      </div>

      <div className="tickets-layout">
        <Card className="tickets-list-card">
          <CardContent>
            {loading ? (
              <LoadingState variant="table" rows={6} label="Loading tickets" />
            ) : loadError ? (
              <ErrorState
                whatFailed="Support tickets could not be loaded."
                technicalDetail={loadError}
                onRetry={() => void loadTickets()}
              />
            ) : tickets.length === 0 ? (
              <EmptyState
                headline="No tickets"
                description="Support tickets raised by users will appear here."
              />
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  className={`ticket-item ${selectedTicket?.id === t.id ? 'active' : ''}`}
                  onClick={() => openTicket(t)}
                >
                  <div className="ticket-item-top">
                    <span className="ticket-subject">{t.subject}</span>
                    <div className="ticket-badges">
                      <CardBadge variant={PRIORITY_VARIANT[t.priority] ?? 'default'}>{t.priority}</CardBadge>
                      <CardBadge variant={STATUS_VARIANT[t.status] ?? 'default'}>{t.status}</CardBadge>
                    </div>
                  </div>
                  <div className="ticket-item-meta">
                    <span>{requesterLabel(t)}</span>
                    <span>{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {selectedTicket && (
          <Card className="ticket-detail-card">
            <CardContent>
              <div className="detail-header">
                <h3>{selectedTicket.subject}</h3>
                <button className="close-btn" onClick={() => setSelectedTicket(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="detail-meta">
                <CardBadge variant={PRIORITY_VARIANT[selectedTicket.priority] ?? 'default'}>
                  {selectedTicket.priority}
                </CardBadge>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value)}
                  className="status-select"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              {/* Without this an anonymous ticket showed its message and no way
                  to answer it — the reply box posts into the thread, which
                  someone who has never signed in cannot read. */}
              <div className="detail-requester">
                <span className="detail-requester-label">From</span>
                <span>{requesterLabel(selectedTicket)}</span>
                {selectedTicket.contact_email && (
                  <a href={`mailto:${selectedTicket.contact_email}?subject=Re: ${encodeURIComponent(selectedTicket.subject)}`}>
                    Reply by email
                  </a>
                )}
              </div>
              <p className="detail-desc">{selectedTicket.description}</p>
              <div className="replies-list">
                {replies.map((r) => (
                  <div key={r.id} className={`reply ${r.is_internal ? 'internal' : ''}`}>
                    <div className="reply-author">{r.profiles?.email ?? r.author_id.slice(0, 8)}</div>
                    <div className="reply-body">{r.body}</div>
                    <div className="reply-time">{new Date(r.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="reply-form">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a reply..."
                  className="reply-textarea"
                  rows={3}
                />
                <Button
                  size="sm"
                  variant="primary"
                  loading={replyLoading}
                  disabled={!replyBody.trim()}
                  onClick={handleReply}
                  icon={<ChatCircleText size={14} />}
                >
                  Send Reply
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <style jsx>{`
        .admin-page { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
        .admin-loading { text-align: center; padding: 60px; color: #64748b; }
        .admin-header { margin-bottom: 24px; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; color: #64748b; font-size: 14px; text-decoration: none; margin-bottom: 10px; }
        .back-link:hover { color: #1e40af; }
        h1 { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .header-sub { font-size: 14px; color: #94a3b8; margin: 0; }
        .filters-row { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; }
        .filter-select { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; }
        .tickets-layout { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; }
        .tickets-list-card, .ticket-detail-card { min-height: 500px; }
        .table-loading, .empty-state { text-align: center; padding: 40px; color: #94a3b8; }
        .ticket-item {
          padding: 14px 12px; border-bottom: 1px solid #f1f5f9; cursor: pointer; border-radius: 8px;
        }
        .ticket-item:hover { background: #f8fafc; }
        .ticket-item.active { background: #eff6ff; }
        .ticket-item-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
        .ticket-subject { font-size: 14px; font-weight: 600; color: #1e293b; }
        .ticket-badges { display: flex; gap: 4px; flex-shrink: 0; }
        .ticket-item-meta { display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; }
        .detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        h3 { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0; }
        .close-btn { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 4px; }
        .close-btn:hover { color: #475569; }
        .detail-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
        .status-select { padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; }
        .detail-requester { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 13px; color: #334155; }
        .detail-requester-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; font-weight: 700; }
        .detail-requester a { color: #1e40af; font-weight: 600; text-decoration: none; }
        .detail-requester a:hover { text-decoration: underline; }
        .detail-desc { font-size: 14px; color: #475569; margin: 0 0 16px; line-height: 1.6; }
        .replies-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; max-height: 300px; overflow-y: auto; }
        .reply { padding: 10px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .reply.internal { background: #fef3c7; border-color: #fde68a; }
        .reply-author { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px; }
        .reply-body { font-size: 13px; color: #334155; line-height: 1.5; }
        .reply-time { font-size: 11px; color: #94a3b8; margin-top: 4px; }
        .reply-form { display: flex; flex-direction: column; gap: 10px; }
        .reply-textarea {
          width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0;
          border-radius: 10px; font-size: 14px; resize: vertical; font-family: inherit;
        }
        .reply-textarea:focus { outline: none; border-color: #1e40af; }
        @media (max-width: 768px) {
          .tickets-layout { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
