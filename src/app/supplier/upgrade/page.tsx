'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { getUserSupplierProfile } from '@/lib/services/suppliers';
import { getSupplierPlan } from '@/lib/services/subscriptions';
import type { SubscriptionPlanId } from '@/lib/database.types';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  CreditCard,
  DeviceMobileCamera,
  Star,
  Crown,
  Package,
  ShieldCheck,
} from '@phosphor-icons/react';

interface Plan {
  id: SubscriptionPlanId;
  name: string;
  price_usd: number;
  price_zwg: number;
  tagline: string;
  icon: React.ReactNode;
  features: { label: string; included: boolean }[];
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price_usd: 0,
    price_zwg: 0,
    tagline: 'Get started for free',
    icon: <Package size={24} />,
    features: [
      { label: 'Up to 10 products', included: true },
      { label: 'RFQ requests inbox', included: true },
      { label: 'Basic analytics', included: true },
      { label: 'Contact requests', included: false },
      { label: 'Verified badge', included: false },
      { label: 'Advanced analytics', included: false },
      { label: 'Priority in search', included: false },
      { label: 'Featured listing', included: false },
      { label: 'API access', included: false },
      { label: 'Product packages', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price_usd: 15,
    price_zwg: 570,
    tagline: 'For growing suppliers',
    icon: <Star size={24} />,
    features: [
      { label: 'Unlimited products', included: true },
      { label: 'RFQ requests inbox', included: true },
      { label: 'Contact requests from builders', included: true },
      { label: 'Verified badge', included: true },
      { label: 'Advanced analytics', included: true },
      { label: 'Priority in search', included: true },
      { label: 'Featured listing', included: false },
      { label: 'API access', included: false },
      { label: 'Product packages', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price_usd: 35,
    price_zwg: 1330,
    tagline: 'Maximum visibility',
    icon: <Crown size={24} />,
    features: [
      { label: 'Unlimited products', included: true },
      { label: 'RFQ requests inbox', included: true },
      { label: 'Contact requests from builders', included: true },
      { label: 'Verified badge', included: true },
      { label: 'Advanced analytics', included: true },
      { label: 'Priority in search', included: true },
      { label: 'Featured marketplace listing', included: true },
      { label: 'API access', included: true },
      { label: 'Product combo packages', included: true },
    ],
  },
];

type PaymentProvider = 'stripe' | 'paynow';

export default function SupplierUpgradePage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlanId>('basic');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('stripe');
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?redirect=/supplier/upgrade');
        return;
      }

      const profile = await getUserSupplierProfile(user.id);
      if (!profile) {
        router.push('/supplier/register');
        return;
      }

      setSupplierId(profile.id);
      const plan = await getSupplierPlan(profile.id);
      setCurrentPlan(plan);
      setLoading(false);
    };

    load();
  }, [router]);

  const handleCheckout = async () => {
    if (!selectedPlan || selectedPlan === currentPlan) return;
    setCheckingOut(true);

    // Payment integration wired up in Phase 5.
    // For now, show a coming-soon message.
    alert(`Payment via ${paymentProvider === 'stripe' ? 'Card (USD)' : 'EcoCash (ZWG)'} coming soon. Contact support to upgrade to ${selectedPlan}.`);
    setCheckingOut(false);
  };

  return (
    <ProtectedRoute>
      <MainLayout title="Upgrade Plan">
        <div className="upgrade-page">
          <div className="page-header">
            <Link href="/supplier/billing" className="back-link">
              <ArrowLeft size={18} />
              Billing
            </Link>
            <div>
              <div className="header-label">Supplier Portal</div>
              <h1>Choose Your Plan</h1>
              <p className="header-desc">
                Upgrade to unlock more features and grow your business
              </p>
            </div>
          </div>

          {loading ? (
            <div className="upgrade-loading">Loading...</div>
          ) : (
            <>
              <div className="plans-grid">
                {PLANS.map((plan) => {
                  const isCurrent = plan.id === currentPlan;
                  const isSelected = plan.id === selectedPlan;
                  const isDowngrade =
                    plan.id === 'basic' ||
                    (plan.id === 'pro' && currentPlan === 'premium');

                  return (
                    <Card
                      key={plan.id}
                      variant="choice"
                      selected={isSelected}
                      onClick={!isCurrent && !isDowngrade ? () => setSelectedPlan(plan.id) : undefined}
                      className={`plan-card ${isCurrent ? 'current' : ''} ${plan.id === 'pro' ? 'featured' : ''}`}
                    >
                      {plan.id === 'pro' && (
                        <div className="popular-badge">Most Popular</div>
                      )}
                      <CardContent>
                        <div className="plan-icon" data-plan={plan.id}>{plan.icon}</div>
                        <div className="plan-name">{plan.name}</div>
                        <div className="plan-tagline">{plan.tagline}</div>
                        {plan.price_usd === 0 ? (
                          <div className="plan-price">Free</div>
                        ) : (
                          <div className="plan-price">
                            ${plan.price_usd}
                            <span>/mo</span>
                          </div>
                        )}
                        <div className="plan-zwg">
                          {plan.price_zwg > 0 ? `ZWG ${plan.price_zwg.toLocaleString()}/mo` : 'Free'}
                        </div>

                        <div className="features-list">
                          {plan.features.map((f) => (
                            <div key={f.label} className={`feature-row ${f.included ? 'yes' : 'no'}`}>
                              {f.included ? (
                                <CheckCircle size={15} weight="fill" />
                              ) : (
                                <XCircle size={15} weight="fill" />
                              )}
                              {f.label}
                            </div>
                          ))}
                        </div>

                        {isCurrent ? (
                          <div className="current-badge">
                            <ShieldCheck size={14} />
                            Current Plan
                          </div>
                        ) : isDowngrade ? (
                          <div className="downgrade-note">Contact support to downgrade</div>
                        ) : (
                          <div className={`select-indicator ${isSelected ? 'selected' : ''}`}>
                            {isSelected ? '✓ Selected' : 'Click to select'}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {selectedPlan && selectedPlan !== currentPlan && (
                <Card className="checkout-card">
                  <CardHeader>
                    <CardTitle>Complete Upgrade to {PLANS.find((p) => p.id === selectedPlan)?.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="checkout-summary">
                      <span>
                        ${PLANS.find((p) => p.id === selectedPlan)?.price_usd}/month
                      </span>
                      <span className="checkout-or">or</span>
                      <span>
                        ZWG {PLANS.find((p) => p.id === selectedPlan)?.price_zwg.toLocaleString()}/month
                      </span>
                    </div>

                    <div className="provider-selection">
                      <p className="provider-label">Payment method</p>
                      <div className="provider-options">
                        <button
                          className={`provider-btn ${paymentProvider === 'stripe' ? 'active' : ''}`}
                          onClick={() => setPaymentProvider('stripe')}
                        >
                          <CreditCard size={20} />
                          <div>
                            <div className="provider-name">Card (USD)</div>
                            <div className="provider-sub">Visa, Mastercard via Stripe</div>
                          </div>
                        </button>
                        <button
                          className={`provider-btn ${paymentProvider === 'paynow' ? 'active' : ''}`}
                          onClick={() => setPaymentProvider('paynow')}
                        >
                          <DeviceMobileCamera size={20} />
                          <div>
                            <div className="provider-name">EcoCash (ZWG)</div>
                            <div className="provider-sub">Mobile money via Paynow</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      loading={checkingOut}
                      onClick={handleCheckout}
                    >
                      {paymentProvider === 'stripe'
                        ? `Pay $${PLANS.find((p) => p.id === selectedPlan)?.price_usd}/month with Card`
                        : `Pay ZWG ${PLANS.find((p) => p.id === selectedPlan)?.price_zwg.toLocaleString()}/month via EcoCash`}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        <style jsx>{`
          .upgrade-page {
            max-width: 1000px;
            margin: 0 auto;
            padding: 24px 16px;
          }
          .page-header { margin-bottom: 32px; }
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
          .upgrade-loading { text-align: center; padding: 48px; color: #64748b; }
          .plans-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 28px;
          }
          .plan-card { position: relative; cursor: pointer; }
          .plan-card.current { cursor: default; }
          .popular-badge {
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            background: #1e40af;
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 14px;
            border-radius: 9999px;
            white-space: nowrap;
          }
          .plan-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
            background: #f1f5f9;
            color: #64748b;
          }
          .plan-icon[data-plan="pro"] { background: #dbeafe; color: #1e40af; }
          .plan-icon[data-plan="premium"] { background: #ede9fe; color: #7c3aed; }
          .plan-name { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
          .plan-tagline { font-size: 13px; color: #94a3b8; margin-bottom: 12px; }
          .plan-price { font-size: 28px; font-weight: 800; color: #0f172a; }
          .plan-price span { font-size: 14px; font-weight: 400; color: #94a3b8; }
          .plan-zwg { font-size: 12px; color: #94a3b8; margin-bottom: 20px; }
          .features-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 20px;
          }
          .feature-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
          }
          .feature-row.yes { color: #1e293b; }
          .feature-row.yes svg { color: #16a34a; flex-shrink: 0; }
          .feature-row.no { color: #cbd5e1; }
          .feature-row.no svg { color: #e2e8f0; flex-shrink: 0; }
          .current-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 600;
            color: #16a34a;
            background: #f0fdf4;
            padding: 6px 12px;
            border-radius: 8px;
          }
          .downgrade-note {
            font-size: 12px;
            color: #94a3b8;
            font-style: italic;
          }
          .select-indicator {
            font-size: 13px;
            color: #94a3b8;
            text-align: center;
            padding: 6px;
          }
          .select-indicator.selected {
            color: #1e40af;
            font-weight: 600;
          }
          .checkout-card { margin-top: 8px; }
          .checkout-summary {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 18px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 24px;
          }
          .checkout-or {
            font-size: 13px;
            font-weight: 400;
            color: #94a3b8;
          }
          .provider-label {
            font-size: 13px;
            font-weight: 600;
            color: #475569;
            margin: 0 0 12px;
          }
          .provider-options {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
          }
          .provider-btn {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            background: #fff;
            cursor: pointer;
            transition: border-color 0.15s, background 0.15s;
            text-align: left;
          }
          .provider-btn.active {
            border-color: #1e40af;
            background: #eff6ff;
          }
          .provider-btn:hover:not(.active) { border-color: #94a3b8; }
          .provider-name { font-size: 14px; font-weight: 600; color: #1e293b; }
          .provider-sub { font-size: 12px; color: #94a3b8; }
          @media (max-width: 700px) {
            .plans-grid { grid-template-columns: 1fr; }
            .provider-options { flex-direction: column; }
          }
        `}</style>
      </MainLayout>
    </ProtectedRoute>
  );
}
