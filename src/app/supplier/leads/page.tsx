'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Card, { CardContent, CardHeader, CardTitle, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { getUserSupplierProfile } from '@/lib/services/suppliers';
import { getSupplierRfqInbox, type SupplierInboxRfq } from '@/lib/services/rfq';
import { getContactRequests, updateContactRequestStatus } from '@/lib/services/leads';
import { requirePlanFeature } from '@/lib/services/subscriptions';
import type { ContactRequest } from '@/lib/database.types';
import {
  ArrowLeft,
  EnvelopeSimple,
  ClockCountdown,
  CheckCircle,
  XCircle,
  ChatCircleText,
  Archive,
  Package,
  Star,
  Lock,
  ArrowRight,
} from '@phosphor-icons/react';

type LeadsTab = 'rfq' | 'contact';

const STATUS_BADGE: Record<string, string> = {
  notified: 'info',
  viewed: 'warning',
  quoted: 'success',
  declined: 'error',
  new: 'info',
  read: 'warning',
  replied: 'success',
  archived: 'default',
};

export default function SupplierLeadsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<LeadsTab>('rfq');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [rfqs, setRfqs] = useState<SupplierInboxRfq[]>([]);
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [contactAllowed, setContactAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?redirect=/supplier/leads');
        return;
      }

      const profile = await getUserSupplierProfile(user.id);
      if (!profile) {
        router.push('/supplier/register');
        return;
      }

      setSupplierId(profile.id);

      const [rfqResult, contactFeature] = await Promise.all([
        getSupplierRfqInbox(profile.id),
        requirePlanFeature(profile.id, 'contact_requests'),
      ]);

      setRfqs(rfqResult.rfqs);
      setContactAllowed(contactFeature.allowed);

      if (contactFeature.allowed) {
        const cr = await getContactRequests(profile.id);
        setContacts(cr);
      }

      setLoading(false);
    };

    load();
  }, [router]);

  const loadContacts = async () => {
    if (!supplierId) return;
    const cr = await getContactRequests(supplierId, {
      status: filterStatus ? (filterStatus as ContactRequest['status']) : undefined,
      fromDate: filterFrom || undefined,
      toDate: filterTo || undefined,
    });
    setContacts(cr);
  };

  const handleMarkStatus = async (id: string, status: ContactRequest['status']) => {
    setUpdatingId(id);
    await updateContactRequestStatus(id, status);
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    setUpdatingId(null);
  };

  const filteredRfqs = rfqs.filter((r) => {
    if (filterStatus && r.recipient.status !== filterStatus) return false;
    if (filterFrom && r.created_at < filterFrom) return false;
    if (filterTo && r.created_at > filterTo + 'T23:59:59') return false;
    return true;
  });

  return (
    <ProtectedRoute>
      <>
        <div className="leads-page">
          <div className="page-header">
            <Link href="/supplier/dashboard" className="back-link">
              <ArrowLeft size={18} />
              Dashboard
            </Link>
            <div>
              <div className="header-label">Supplier Portal</div>
              <h1>Customer Leads</h1>
              <p className="header-desc">RFQ requests and direct contact from builders</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="leads-tabs">
            <button
              className={`leads-tab ${tab === 'rfq' ? 'active' : ''}`}
              onClick={() => setTab('rfq')}
            >
              <Package size={18} />
              RFQ Requests
              {rfqs.length > 0 && <span className="tab-badge">{rfqs.length}</span>}
            </button>
            <button
              className={`leads-tab ${tab === 'contact' ? 'active' : ''}`}
              onClick={() => setTab('contact')}
            >
              <ChatCircleText size={18} />
              Contact Requests
              {contactAllowed && contacts.filter((c) => c.status === 'new').length > 0 && (
                <span className="tab-badge new">
                  {contacts.filter((c) => c.status === 'new').length}
                </span>
              )}
              {!contactAllowed && <Lock size={14} className="tab-lock" />}
            </button>
          </div>

          {/* Filter bar */}
          <div className="leads-filters">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="">All statuses</option>
              {tab === 'rfq' ? (
                <>
                  <option value="notified">Notified</option>
                  <option value="viewed">Viewed</option>
                  <option value="quoted">Quoted</option>
                  <option value="declined">Declined</option>
                </>
              ) : (
                <>
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="replied">Replied</option>
                  <option value="archived">Archived</option>
                </>
              )}
            </select>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="filter-date"
              placeholder="From"
            />
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="filter-date"
              placeholder="To"
            />
            {tab === 'contact' && contactAllowed && (
              <Button size="sm" variant="secondary" onClick={loadContacts}>
                Apply
              </Button>
            )}
          </div>

          {loading ? (
            <div className="leads-loading">Loading leads...</div>
          ) : (
            <>
              {/* RFQ Tab */}
              {tab === 'rfq' && (
                <div className="leads-list">
                  {filteredRfqs.length === 0 ? (
                    <div className="leads-empty">
                      <Package size={40} />
                      <p>No RFQ requests yet</p>
                      <span>RFQ requests from builders will appear here once you&apos;re verified.</span>
                    </div>
                  ) : (
                    filteredRfqs.map((item) => (
                      <Card key={item.recipient.id} className="lead-card">
                        <CardContent>
                          <div className="lead-card-row">
                            <div className="lead-info">
                              <div className="lead-title">
                                <Package size={16} />
                                {item.notes || 'RFQ Request'}
                              </div>
                              <div className="lead-meta">
                                <ClockCountdown size={14} />
                                {new Date(item.created_at).toLocaleDateString()}
                                {item.required_by && (
                                  <span> · Required by {new Date(item.required_by).toLocaleDateString()}</span>
                                )}
                              </div>
                              <div className="lead-items">
                                {item.rfq_items.slice(0, 3).map((i) => (
                                  <span key={i.id} className="lead-item-chip">
                                    {i.material_name} × {i.quantity} {i.unit}
                                  </span>
                                ))}
                                {item.rfq_items.length > 3 && (
                                  <span className="lead-item-chip muted">+{item.rfq_items.length - 3} more</span>
                                )}
                              </div>
                            </div>
                            <div className="lead-actions">
                              <CardBadge variant={STATUS_BADGE[item.recipient.status] as 'info' | 'warning' | 'success' | 'error' | 'default'}>
                                {item.recipient.status}
                              </CardBadge>
                              {item.supplier_quote ? (
                                <span className="quote-submitted">
                                  <CheckCircle size={14} />
                                  Quote submitted
                                </span>
                              ) : (
                                <Link href="/supplier/dashboard">
                                  <Button size="sm" variant="primary">
                                    Submit Quote
                                    <ArrowRight size={14} />
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* Contact Requests Tab */}
              {tab === 'contact' && (
                <>
                  {!contactAllowed ? (
                    <div className="upgrade-gate">
                      <Lock size={40} />
                      <h3>Pro Feature</h3>
                      <p>
                        Upgrade to <strong>Pro</strong> to receive direct contact requests from
                        builders browsing the marketplace.
                      </p>
                      <Link href="/supplier/upgrade">
                        <Button variant="primary" icon={<Star size={16} />}>
                          Upgrade to Pro — $15/month
                        </Button>
                      </Link>
                    </div>
                  ) : contacts.length === 0 ? (
                    <div className="leads-empty">
                      <EnvelopeSimple size={40} />
                      <p>No contact requests yet</p>
                      <span>Builders will reach out directly from your marketplace profile.</span>
                    </div>
                  ) : (
                    <div className="leads-list">
                      {contacts.map((cr) => (
                        <Card key={cr.id} className="lead-card">
                          <CardContent>
                            <div className="lead-card-row">
                              <div className="lead-info">
                                <div className="lead-title">
                                  <ChatCircleText size={16} />
                                  {cr.builder_name || 'A builder'}
                                </div>
                                {cr.builder_email && (
                                  <div className="lead-contact">
                                    <EnvelopeSimple size={14} />
                                    <a href={`mailto:${cr.builder_email}`}>{cr.builder_email}</a>
                                  </div>
                                )}
                                <p className="lead-message">{cr.message}</p>
                                <div className="lead-meta">
                                  <ClockCountdown size={14} />
                                  {new Date(cr.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              <div className="lead-actions">
                                <CardBadge variant={STATUS_BADGE[cr.status] as 'info' | 'warning' | 'success' | 'error' | 'default'}>
                                  {cr.status}
                                </CardBadge>
                                <div className="action-row">
                                  {cr.status === 'new' && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      loading={updatingId === cr.id}
                                      onClick={() => handleMarkStatus(cr.id, 'read')}
                                    >
                                      Mark Read
                                    </Button>
                                  )}
                                  {(cr.status === 'new' || cr.status === 'read') && (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      loading={updatingId === cr.id}
                                      onClick={() => handleMarkStatus(cr.id, 'replied')}
                                    >
                                      <CheckCircle size={14} />
                                      Mark Replied
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    loading={updatingId === cr.id}
                                    onClick={() => handleMarkStatus(cr.id, 'archived')}
                                  >
                                    <Archive size={14} />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <style jsx>{`
          .leads-page {
            max-width: 900px;
            margin: 0 auto;
            padding: 24px 16px;
          }
          .page-header {
            margin-bottom: 28px;
          }
          .back-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #64748b;
            font-size: 14px;
            text-decoration: none;
            margin-bottom: 12px;
          }
          .back-link:hover { color: #1e40af; }
          .header-label {
            font-size: 12px;
            font-weight: 600;
            color: #1e40af;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 6px;
          }
          h1 { font-size: 28px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
          .header-desc { color: #64748b; margin: 0; font-size: 15px; }
          .leads-tabs {
            display: flex;
            gap: 4px;
            border-bottom: 2px solid #e2e8f0;
            margin-bottom: 20px;
          }
          .leads-tab {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #64748b;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            transition: color 0.15s, border-color 0.15s;
          }
          .leads-tab.active {
            color: #1e40af;
            border-bottom-color: #1e40af;
          }
          .leads-tab:hover:not(.active) { color: #334155; }
          .tab-badge {
            background: #e2e8f0;
            color: #475569;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 7px;
            border-radius: 9999px;
          }
          .tab-badge.new { background: #dbeafe; color: #1e40af; }
          .tab-lock { color: #94a3b8; margin-left: 2px; }
          .leads-filters {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
          }
          .filter-select, .filter-date {
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            font-size: 14px;
            color: #334155;
            background: #fff;
          }
          .filter-select:focus, .filter-date:focus {
            outline: none;
            border-color: #1e40af;
          }
          .leads-loading { text-align: center; padding: 48px; color: #64748b; }
          .leads-list { display: flex; flex-direction: column; gap: 12px; }
          .lead-card { margin: 0; }
          .lead-card-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
          }
          .lead-info { flex: 1; }
          .lead-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 15px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 6px;
          }
          .lead-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #94a3b8;
            margin-bottom: 8px;
          }
          .lead-contact {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: #64748b;
            margin-bottom: 6px;
          }
          .lead-contact a { color: #1e40af; text-decoration: none; }
          .lead-message {
            font-size: 13px;
            color: #475569;
            margin: 0 0 8px;
            line-height: 1.5;
          }
          .lead-items { display: flex; flex-wrap: wrap; gap: 6px; }
          .lead-item-chip {
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 3px 10px;
            font-size: 12px;
            color: #475569;
          }
          .lead-item-chip.muted { color: #94a3b8; }
          .lead-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 10px;
            min-width: 140px;
          }
          .action-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
          .quote-submitted {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #16a34a;
          }
          .leads-empty {
            text-align: center;
            padding: 64px 24px;
            color: #94a3b8;
          }
          .leads-empty p { font-size: 18px; font-weight: 600; color: #475569; margin: 12px 0 6px; }
          .leads-empty span { font-size: 14px; }
          .upgrade-gate {
            text-align: center;
            padding: 64px 24px;
            background: #f8fafc;
            border: 2px dashed #e2e8f0;
            border-radius: 20px;
          }
          .upgrade-gate h3 { font-size: 22px; font-weight: 700; color: #1e293b; margin: 12px 0 8px; }
          .upgrade-gate p { color: #64748b; margin: 0 0 20px; font-size: 15px; }
          @media (max-width: 600px) {
            .lead-card-row { flex-direction: column; }
            .lead-actions { align-items: flex-start; min-width: auto; }
          }
        `}</style>
      </>
    </ProtectedRoute>
  );
}
