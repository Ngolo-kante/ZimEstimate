'use client';

import { useState } from 'react';
import { Bell, ShoppingCart, Star, FileText, TrendUp, Check, Trash } from '@phosphor-icons/react';

type Notification = {
  id: string;
  type: 'order' | 'review' | 'document' | 'analytics' | 'system';
  title: string;
  body: string;
  time: string;
  read: boolean;
};

const TYPE_CONFIG = {
  order: { icon: ShoppingCart, color: '#2563eb', bg: '#eff6ff' },
  review: { icon: Star, color: '#f59e0b', bg: '#fffbeb' },
  document: { icon: FileText, color: '#7c3aed', bg: '#faf5ff' },
  analytics: { icon: TrendUp, color: '#059669', bg: '#f0fdf4' },
  system: { icon: Bell, color: '#64748b', bg: '#f1f5f9' },
};

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'order', title: 'New Order Request', body: 'Tafadzwa M. sent an RFQ for 50 bags of cement. Respond before Friday.', time: '10 min ago', read: false },
  { id: '2', type: 'review', title: 'New Review Received', body: 'Chiedza P. left a 5-star review on your roofing products.', time: '2 hours ago', read: false },
  { id: '3', type: 'document', title: 'Document Rejected', body: 'Your CIPA certificate was rejected. Please upload a current version.', time: '1 day ago', read: false },
  { id: '4', type: 'analytics', title: 'Weekly Performance', body: 'Your profile got 48 views this week — up 22% from last week.', time: '2 days ago', read: true },
  { id: '5', type: 'order', title: 'Quote Accepted', body: 'Sithembile N. accepted your quote for Y12 rebar. Prepare for delivery.', time: '3 days ago', read: true },
  { id: '6', type: 'system', title: 'Subscription Renewing', body: 'Your Pro plan renews on April 1, 2026. Update billing details if needed.', time: '1 week ago', read: true },
];

export default function SupplierNotificationsPage() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const remove = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));

  const filtered = notifications.filter(n => filter === 'all' || !n.read);

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
            <p>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
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

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Bell size={40} />
          <h3>No notifications</h3>
          <p>You are all caught up!</p>
        </div>
      ) : (
        <div className="notif-list">
          {filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type];
            const Icon = cfg.icon;
            return (
              <div key={n.id} className={`notif-card ${n.read ? 'read' : 'unread'}`} onClick={() => markRead(n.id)}>
                <div className="notif-icon" style={{ background: cfg.bg, color: cfg.color }}>
                  <Icon size={18} weight="duotone" />
                </div>
                <div className="notif-body">
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-text">{n.body}</div>
                  <div className="notif-time">{n.time}</div>
                </div>
                {!n.read && <span className="unread-indicator" />}
                <button className="remove-btn" onClick={e => { e.stopPropagation(); remove(n.id); }} title="Dismiss">
                  <Trash size={13} />
                </button>
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
        .notif-text { font-size: 0.8125rem; color: #475569; line-height: 1.45; margin-bottom: 6px; }
        .notif-time { font-size: 0.72rem; color: #94a3b8; }
        .unread-indicator { width: 8px; height: 8px; background: #2563eb; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
        .remove-btn { background: none; border: none; color: #cbd5e1; cursor: pointer; padding: 4px; border-radius: 5px; display: flex; align-items: center; flex-shrink: 0; }
        .remove-btn:hover { color: #ef4444; background: #fef2f2; }
        .read .notif-title { color: #475569; }
        .empty-state { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 80px 40px; text-align: center; color: #94a3b8; }
        .empty-state h3 { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 16px 0 8px; }
      `}</style>
    </div>
  );
}
