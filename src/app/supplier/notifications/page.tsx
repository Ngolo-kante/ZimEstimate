'use client';

// Was six hardcoded notifications — a new order from "Tafadzwa M.", a 5-star
// review, a rejected CIPA certificate — none of which had ever happened. This
// reads notification_deliveries, the same table the dispatcher sends from, so
// what a supplier sees here is exactly what was actually addressed to them.

import { useEffect, useState } from 'react';
import { Bell, ClipboardText, Star, FileText, TrendUp, Check, CurrencyDollar } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import type { NotificationDelivery } from '@/lib/database.types';

type Filter = 'all' | 'unread';

// Delivery rows carry a template_key rather than a display category, so the
// icon is chosen from the key. Anything unrecognised falls back to the bell
// instead of breaking the row.
const TEMPLATE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  rfq_received: { icon: ClipboardText, color: '#2563eb', bg: '#eff6ff' },
  quote_submitted: { icon: ClipboardText, color: '#2563eb', bg: '#eff6ff' },
  quote_accepted: { icon: Check, color: '#059669', bg: '#f0fdf4' },
  price_drop: { icon: TrendUp, color: '#059669', bg: '#f0fdf4' },
  project_reminder: { icon: Bell, color: '#64748b', bg: '#f1f5f9' },
  supplier_application_submitted: { icon: FileText, color: '#7c3aed', bg: '#faf5ff' },
  supplier_application_under_review: { icon: FileText, color: '#7c3aed', bg: '#faf5ff' },
  supplier_application_approved: { icon: Check, color: '#059669', bg: '#f0fdf4' },
  supplier_application_rejected: { icon: FileText, color: '#dc2626', bg: '#fef2f2' },
  supplier_reverification_due: { icon: FileText, color: '#f59e0b', bg: '#fffbeb' },
  subscription_upgraded: { icon: Star, color: '#f59e0b', bg: '#fffbeb' },
  subscription_renewed: { icon: CurrencyDollar, color: '#059669', bg: '#f0fdf4' },
};

const FALLBACK_CONFIG = { icon: Bell, color: '#64748b', bg: '#f1f5f9' };

/** "10 minutes ago" reads better than a timestamp for a notification list. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

function titleFor(row: NotificationDelivery): string {
  const payload = (row.payload || {}) as Record<string, unknown>;
  if (typeof payload.title === 'string' && payload.title) return payload.title;
  // Fall back to the template key made readable, rather than showing a blank row.
  return row.template_key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function bodyFor(row: NotificationDelivery): string {
  const payload = (row.payload || {}) as Record<string, unknown>;
  return typeof payload.body === 'string' ? payload.body : '';
}

export default function SupplierNotificationsPage() {
  const [rows, setRows] = useState<NotificationDelivery[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('notification_deliveries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setRows((data || []) as NotificationDelivery[]);
      setLoading(false);
    };

    load();
  }, []);

  // There is no read/unread column on notification_deliveries — status tracks
  // delivery, not whether anybody looked. Rather than invent a column, "unread"
  // means "not yet opened in this visit", which is honest about what is known.
  const isRead = (row: NotificationDelivery) => readIds.has(row.id);
  const unreadCount = rows.filter((r) => !isRead(r)).length;

  const markRead = (id: string) => setReadIds((prev) => new Set(prev).add(id));
  const markAllRead = () => setReadIds(new Set(rows.map((r) => r.id)));

  const filtered = rows.filter((r) => filter === 'all' || !isRead(r));

  return (
    <div className="page">
      <div className="page-header">
        <div className="header-left">
          <div className="page-icon-wrap">
            <Bell size={22} weight="duotone" className="page-icon" />
            {unreadCount > 0 && <span className="unread-dot">{unreadCount}</span>}
          </div>
          <div>
            <h1>Notifications</h1>
            <p>{loading ? 'Loading…' : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="filter-bar">
            <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            <button className={`filter-btn ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
              Unread {unreadCount > 0 && <span className="count">{unreadCount}</span>}
            </button>
          </div>
          {unreadCount > 0 && (
            <button className="btn-mark-all" onClick={markAllRead}>
              <Check size={13} /> Mark all read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <Bell size={40} />
          <h3>Loading notifications</h3>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Bell size={40} />
          <h3>{rows.length === 0 ? 'No notifications' : 'Nothing unread'}</h3>
          <p>
            {rows.length === 0
              ? 'Quote requests and account updates will appear here.'
              : 'You are all caught up!'}
          </p>
        </div>
      ) : (
        <div className="notif-list">
          {filtered.map((row) => {
            const cfg = TEMPLATE_CONFIG[row.template_key] || FALLBACK_CONFIG;
            const Icon = cfg.icon;
            const read = isRead(row);
            const body = bodyFor(row);
            return (
              <div
                key={row.id}
                className={`notif-card ${read ? 'read' : 'unread'}`}
                onClick={() => markRead(row.id)}
              >
                <div className="notif-icon" style={{ background: cfg.bg, color: cfg.color }}>
                  <Icon size={18} weight="duotone" />
                </div>
                <div className="notif-body">
                  <div className="notif-title">{titleFor(row)}</div>
                  {body && <div className="notif-text">{body}</div>}
                  <div className="notif-time">
                    {relativeTime(row.created_at)}
                    {row.status === 'failed' && <span className="failed-tag">delivery failed</span>}
                  </div>
                </div>
                {!read && <span className="unread-indicator" />}
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .page { padding: 28px 32px; max-width: 760px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .page-icon-wrap { position: relative; }
        .page-icon { color: #2563eb; display: block; }
        .unread-dot { position: absolute; top: -4px; right: -6px; background: #ef4444; color: white; font-size: 0.6rem; font-weight: 700; border-radius: 20px; padding: 1px 5px; min-width: 16px; text-align: center; }
        h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        p { font-size: 0.8125rem; color: #64748b; margin: 0; }
        .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .filter-bar { display: flex; gap: 4px; background: #f1f5f9; border-radius: 8px; padding: 3px; }
        .filter-btn { background: transparent; border: none; border-radius: 6px; padding: 5px 14px; font-size: 0.8125rem; font-weight: 500; cursor: pointer; color: #64748b; display: flex; align-items: center; gap: 5px; }
        .filter-btn.active { background: white; color: #0f172a; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .count { background: #2563eb; color: white; font-size: 0.65rem; border-radius: 20px; padding: 1px 6px; }
        .btn-mark-all { display: flex; align-items: center; gap: 5px; background: none; border: 1px solid #e2e8f0; border-radius: 7px; padding: 6px 12px; font-size: 0.8rem; color: #64748b; cursor: pointer; }
        .btn-mark-all:hover { background: #f8fafc; }
        .notif-list { display: flex; flex-direction: column; gap: 8px; }
        .notif-card { display: flex; align-items: flex-start; gap: 14px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; cursor: pointer; transition: border-color 0.15s; position: relative; }
        .notif-card.unread { border-left: 3px solid #2563eb; }
        .notif-card:hover { border-color: #93c5fd; }
        .notif-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .notif-body { flex: 1; min-width: 0; }
        .notif-title { font-size: 0.875rem; font-weight: 700; color: #0f172a; margin-bottom: 3px; }
        .notif-text { font-size: 0.8125rem; color: #475569; line-height: 1.45; margin-bottom: 6px; white-space: pre-line; }
        .notif-time { font-size: 0.72rem; color: #94a3b8; display: flex; align-items: center; gap: 8px; }
        .failed-tag { color: #dc2626; font-weight: 600; }
        .unread-indicator { width: 8px; height: 8px; background: #2563eb; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
        .read .notif-title { color: #475569; }
        .empty-state { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 80px 40px; text-align: center; color: #94a3b8; }
        .empty-state h3 { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 16px 0 8px; }
      `}</style>
    </div>
  );
}
