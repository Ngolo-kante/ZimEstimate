'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Card, { CardContent, CardHeader, CardTitle, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { getUserSupplierProfile, getSupplierProducts } from '@/lib/services/suppliers';
import {
  getSupplierSubscription,
  getPaymentHistory,
  cancelSubscription,
  checkProductLimit,
} from '@/lib/services/subscriptions';
import type { SupplierSubscription, SubscriptionPayment } from '@/lib/database.types';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Warning,
  Trash,
} from '@phosphor-icons/react';

const PLAN_COLORS: Record<string, string> = {
  basic: '#64748b',
  pro: '#1e40af',
  premium: '#7c3aed',
};

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
};

const STATUS_VARIANT: Record<string, string> = {
  active: 'success',
  trialing: 'info',
  past_due: 'warning',
  cancelled: 'error',
};

const PAYMENT_STATUS_VARIANT: Record<string, string> = {
  succeeded: 'success',
  pending: 'warning',
  failed: 'error',
  refunded: 'default',
};

const PROVIDER_LABELS: Record<string, string> = {
  stripe: 'Card (Stripe)',
  paynow: 'EcoCash (Paynow)',
  manual: 'Manual',
};

export default function SupplierBillingPage() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SupplierSubscription | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [productLimit, setProductLimit] = useState<number | null>(10);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?redirect=/supplier/billing');
        return;
      }

      const profile = await getUserSupplierProfile(user.id);
      if (!profile) {
        router.push('/supplier/register');
        return;
      }

      setSupplierId(profile.id);

      const [sub, history, products] = await Promise.all([
        getSupplierSubscription(profile.id),
        getPaymentHistory(profile.id),
        getSupplierProducts(profile.id),
      ]);

      setSubscription(sub);
      setPayments(history);
      setProductCount(products.length);

      const { limit } = await checkProductLimit(profile.id, products.length);
      setProductLimit(limit);
      setLoading(false);
    };

    load();
  }, [router]);

  const handleCancel = async () => {
    if (!supplierId) return;
    setCancelling(true);
    const { success } = await cancelSubscription(supplierId, true);
    if (success) {
      setCancelSuccess(true);
      setSubscription((prev) => prev ? { ...prev, cancel_at_period_end: true } : prev);
    }
    setCancelling(false);
    setShowCancelDialog(false);
  };

  const planId = subscription?.plan_id ?? 'basic';
  const planColor = PLAN_COLORS[planId];
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString()
    : '—';

  // This list showed padlocks against features no code has ever gated, which
  // made a free supplier think they were missing things they already had.
  // Only two limits are genuinely enforced anywhere: checkProductLimit on
  // products, and requirePlanFeature('api_access') on the API. Everything else
  // is open to every supplier while the platform is free, so it says so.
  const FEATURES: { key: string; label: string; allowed: boolean }[] = [
    { key: 'products', label: `Products (${productCount}/${productLimit ?? '∞'})`, allowed: true },
    { key: 'rfq', label: 'RFQ Requests', allowed: true },
    { key: 'contact', label: 'Contact Requests', allowed: true },
    { key: 'analytics', label: 'Advanced Analytics', allowed: true },
    { key: 'badge', label: 'Verified Badge', allowed: true },
    { key: 'featured', label: 'Featured Listing', allowed: true },
    { key: 'packages', label: 'Product Packages', allowed: true },
    { key: 'api', label: 'API Access', allowed: planId === 'premium' },
  ];

  return (
    <ProtectedRoute>
      <>
        <div className="billing-page">
          <div className="page-header">
            <Link href="/supplier/dashboard" className="back-link">
              <ArrowLeft size={18} />
              Dashboard
            </Link>
            <div>
              <div className="header-label">Supplier Portal</div>
              <h1>Billing &amp; Subscription</h1>
              <p className="header-desc">Manage your plan and view payment history</p>
            </div>
          </div>

          {loading ? (
            <div className="billing-loading">Loading...</div>
          ) : (
            <div className="billing-grid">
              {/* Current plan */}
              <Card className="plan-card">
                <CardHeader>
                  <CardTitle>Current Plan</CardTitle>
                  {subscription && (
                    <CardBadge variant={STATUS_VARIANT[subscription.status] as 'success' | 'warning' | 'error' | 'info' | 'default'}>
                      {subscription.status}
                    </CardBadge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="plan-name" style={{ color: planColor }}>
                    {PLAN_LABELS[planId]}
                  </div>
                  {planId === 'basic' ? (
                    <div className="plan-price">Free forever</div>
                  ) : (
                    <div className="plan-price">
                      ${planId === 'pro' ? '15' : '35'}<span>/month</span>
                    </div>
                  )}
                  {subscription?.cancel_at_period_end && (
                    <div className="cancel-notice">
                      <Warning size={14} />
                      Cancels at end of period ({periodEnd})
                    </div>
                  )}
                  {!subscription?.cancel_at_period_end && planId !== 'basic' && (
                    <div className="renews-on">
                      <Clock size={14} />
                      Renews {periodEnd}
                    </div>
                  )}
                  {/* The upgrade route is gone while the platform is free —
                      see the note on plan-free-note below. Cancel stays: a
                      supplier who already has a paid plan must still be able
                      to end it. */}
                  <div className="plan-actions">
                    {planId === 'basic' && (
                      <p className="plan-free-note">
                        Every supplier feature is free while ZimEstimate is getting started.
                        There is nothing to upgrade to yet.
                      </p>
                    )}
                    {planId === 'pro' && !subscription?.cancel_at_period_end && (
                      <div className="plan-action-row">
                        <Button
                          variant="ghost"
                          icon={<Trash size={16} />}
                          onClick={() => setShowCancelDialog(true)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    {planId === 'premium' && !subscription?.cancel_at_period_end && (
                      <Button
                        variant="ghost"
                        icon={<Trash size={16} />}
                        onClick={() => setShowCancelDialog(true)}
                      >
                        Cancel subscription
                      </Button>
                    )}
                  </div>
                  {cancelSuccess && (
                    <div className="cancel-success">Subscription will cancel at period end.</div>
                  )}
                </CardContent>
              </Card>

              {/* Feature access */}
              <Card className="features-card">
                <CardHeader>
                  <CardTitle>Feature Access</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="features-list">
                    {FEATURES.map((f) => (
                      <div key={f.key} className={`feature-row ${f.allowed ? 'allowed' : 'locked'}`}>
                        {f.allowed ? (
                          <CheckCircle size={16} weight="fill" className="feature-icon yes" />
                        ) : (
                          <XCircle size={16} weight="fill" className="feature-icon no" />
                        )}
                        <span>{f.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Payment history */}
              <Card className="payments-card">
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <div className="no-payments">
                      <CreditCard size={32} />
                      <p>No payments yet</p>
                      <span>Your payment history will appear here.</span>
                    </div>
                  ) : (
                    <div className="payments-table">
                      <div className="payments-header">
                        <span>Date</span>
                        <span>Amount</span>
                        <span>Provider</span>
                        <span>Status</span>
                      </div>
                      {payments.map((p) => (
                        <div key={p.id} className="payment-row">
                          <span>{new Date(p.created_at).toLocaleDateString()}</span>
                          <span className="payment-amount">
                            {p.currency === 'USD' ? '$' : 'ZWG '}
                            {Number(p.amount).toFixed(2)}
                          </span>
                          <span className="provider-label">
                            {PROVIDER_LABELS[p.payment_provider] ?? p.payment_provider}
                          </span>
                          <CardBadge variant={PAYMENT_STATUS_VARIANT[p.status] as 'success' | 'warning' | 'error' | 'default'}>
                            {p.status}
                          </CardBadge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <ConfirmDialog
          isOpen={showCancelDialog}
          title="Cancel Subscription"
          message="Your plan will remain active until the end of the current billing period. You can resubscribe anytime."
          confirmText="Yes, cancel"
          onConfirm={handleCancel}
          onClose={() => setShowCancelDialog(false)}
          isLoading={cancelling}
          variant="warning"
        />

        <style jsx>{`
          .billing-page {
            max-width: 960px;
            margin: 0 auto;
            padding: 24px 16px;
          }
          .page-header { margin-bottom: 28px; }
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
          .billing-loading { text-align: center; padding: 48px; color: #64748b; }
          .billing-grid {
            display: grid;
            grid-template-columns: 280px 1fr;
            grid-template-rows: auto auto;
            gap: 20px;
          }
          .plan-card { grid-column: 1; grid-row: 1; }
          .features-card { grid-column: 1; grid-row: 2; }
          .payments-card { grid-column: 2; grid-row: 1 / 3; }
          .plan-name {
            font-size: 30px;
            font-weight: 800;
            margin-bottom: 4px;
          }
          .plan-price {
            font-size: 20px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 12px;
          }
          .plan-price span { font-size: 14px; color: #94a3b8; font-weight: 400; }
          .cancel-notice {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: #b45309;
            background: #fef3c7;
            padding: 8px 12px;
            border-radius: 8px;
            margin-bottom: 12px;
          }
          .renews-on {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: #64748b;
            margin-bottom: 12px;
          }
          .plan-actions { margin-top: 4px; }
          .plan-free-note {
            margin: 0;
            font-size: 0.8125rem;
            line-height: 1.5;
            color: var(--color-text-muted, #64748b);
          }
          .plan-action-row { display: flex; gap: 8px; flex-wrap: wrap; }
          .cancel-success {
            font-size: 13px;
            color: #16a34a;
            margin-top: 10px;
          }
          .features-list { display: flex; flex-direction: column; gap: 10px; }
          .feature-row {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
          }
          .feature-row.locked { color: #94a3b8; }
          .feature-row.allowed { color: #1e293b; }
          .feature-icon.yes { color: #16a34a; flex-shrink: 0; }
          .feature-icon.no { color: #e2e8f0; flex-shrink: 0; }
          .upgrade-hint {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 12px;
            color: #1e40af;
            text-decoration: none;
            margin-left: auto;
          }
          .upgrade-hint:hover { text-decoration: underline; }
          .no-payments {
            text-align: center;
            padding: 48px 24px;
            color: #94a3b8;
          }
          .no-payments p { font-size: 16px; font-weight: 600; color: #475569; margin: 10px 0 4px; }
          .no-payments span { font-size: 13px; }
          .payments-table { display: flex; flex-direction: column; gap: 0; }
          .payments-header {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 100px;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            border-bottom: 1px solid #f1f5f9;
          }
          .payment-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 100px;
            padding: 12px;
            font-size: 14px;
            color: #334155;
            border-bottom: 1px solid #f8fafc;
            align-items: center;
          }
          .payment-row:last-child { border-bottom: none; }
          .payment-amount { font-weight: 600; color: #1e293b; }
          .provider-label { font-size: 13px; color: #64748b; }
          @media (max-width: 768px) {
            .billing-grid {
              grid-template-columns: 1fr;
            }
            .plan-card, .features-card, .payments-card {
              grid-column: 1;
              grid-row: auto;
            }
            .payments-header, .payment-row {
              grid-template-columns: 1fr 1fr 1fr;
            }
            .payments-header span:nth-child(3),
            .payment-row span:nth-child(3) { display: none; }
          }
        `}</style>
      </>
    </ProtectedRoute>
  );
}
