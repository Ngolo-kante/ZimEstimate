'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useToast } from '@/components/ui/Toast';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { listQuickBOQs, deleteQuickBOQ } from '@/lib/services/quickBoq';
import type { QuickBOQ } from '@/lib/quick-projects/engine/types';
import {
  Lightning,
  Toilet,
  Drop,
  CirclesThree,
  Rows,
  Path,
  Plus,
  Trash,
  Calendar,
  CurrencyDollar,
  ChartBar,
  Folders,
} from '@phosphor-icons/react';

// ─── Project type config ────────────────────────────────────────────────────

const PROJECT_TYPE_CONFIG: Record<string, {
  label: string;
  icon: typeof Lightning;
  gradient: string;
}> = {
  septic:   { label: 'Septic Tank',   icon: Toilet,        gradient: 'linear-gradient(135deg, var(--color-warning), #d97706)' },
  solar:    { label: 'Solar System',   icon: Lightning,     gradient: 'linear-gradient(135deg, #eab308, #ca8a04)' },
  water:    { label: 'Water Tank',     icon: Drop,          gradient: 'linear-gradient(135deg, var(--color-accent), var(--color-accent))' },
  borehole: { label: 'Borehole',       icon: CirclesThree,  gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)' },
  fencing:  { label: 'Fencing',        icon: Rows,          gradient: 'linear-gradient(135deg, #22c55e, var(--color-success))' },
  paving:   { label: 'Paving',         icon: Path,          gradient: 'linear-gradient(135deg, #78716c, #57534e)' },
};

// ─── Sub-navigation (shared pattern) ────────────────────────────────────────

function ProjectsSubNav() {
  return (
    <div className="projects-subnav">
      <nav className="subnav-tabs">
        <Link href="/projects/dashboard" className="subnav-tab">
          <ChartBar size={18} />
          Insights
        </Link>
        <Link href="/projects" className="subnav-tab">
          <Folders size={18} />
          My Work
        </Link>
        <Link href="/projects/quick" className="subnav-tab active">
          <Lightning size={18} />
          Quick BOQs
        </Link>
      </nav>

      <style jsx>{`
        .projects-subnav {
          margin-bottom: 24px;
        }
        .subnav-tabs {
          display: flex;
          gap: 8px;
          background: var(--color-background);
          padding: 4px;
          border-radius: 12px;
          width: fit-content;
        }
        .subnav-tab {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .subnav-tab:hover {
          color: var(--color-text);
          background: rgba(255, 255, 255, 0.5);
        }
        .subnav-tab.active {
          background: white;
          color: var(--color-text);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        @media (max-width: 480px) {
          .subnav-tabs {
            width: 100%;
          }
          .subnav-tab {
            flex: 1;
            justify-content: center;
            padding: 10px 12px;
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

function QuickBOQsContent() {
  const [boqs, setBoqs] = useState<QuickBOQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { formatPrice, exchangeRate } = useCurrency();
  const { success, error: showError } = useToast();
  const router = useRouter();

  const loadBoqs = useCallback(async () => {
    setLoading(true);
    const { boqs: data, error } = await listQuickBOQs();
    if (error) {
      showError('Failed to load quick estimates.');
    } else {
      setBoqs(data);
    }
    setLoading(false);
  }, [showError]);

  useEffect(() => {
    // Initial page load needs a one-time fetch for persisted quick BOQs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBoqs();
  }, [loadBoqs]);

  async function handleDelete(id: string) {
    const { error } = await deleteQuickBOQ(id);
    if (error) {
      showError('Failed to delete estimate.');
    } else {
      success('Estimate deleted.');
      setBoqs((prev) => prev.filter((b) => b.id !== id));
    }
    setDeleteTarget(null);
  }

  function getTotal(boq: QuickBOQ): number {
    return boq.boqItems
      .filter((item) => item.included !== false)
      .reduce((sum, item) => sum + (item.quantity * item.unitCostUsd), 0);
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-ZW', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  return (
    <MainLayout>
      <ProtectedRoute>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
          <ProjectsSubNav />

          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                Quick BOQs
              </h1>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Your saved utility and quick project estimates
              </p>
            </div>
            <Link href="/quick-projects">
              <Button>
                <Plus size={18} weight="bold" />
                New Quick Estimate
              </Button>
            </Link>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '16px',
            }}>
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <div style={{ padding: '24px' }}>
                    <div style={{ height: '20px', width: '60%', background: 'var(--color-border)', borderRadius: '6px', marginBottom: '12px' }} />
                    <div style={{ height: '14px', width: '40%', background: 'var(--color-background)', borderRadius: '4px', marginBottom: '8px' }} />
                    <div style={{ height: '14px', width: '50%', background: 'var(--color-background)', borderRadius: '4px' }} />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && boqs.length === 0 && (
            <Card>
              <div style={{
                padding: '64px 24px',
                textAlign: 'center',
              }}>
                <Lightning size={48} weight="duotone" style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  No quick estimates yet
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
                  Create your first quick estimate for solar, water, septic, borehole, fencing, or paving projects.
                </p>
                <Link href="/quick-projects">
                  <Button>
                    <Plus size={18} weight="bold" />
                    Create Your First Estimate
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {/* BOQ Cards Grid */}
          {!loading && boqs.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '16px',
            }}>
              {boqs.map((boq) => {
                const config = PROJECT_TYPE_CONFIG[boq.projectType] || {
                  label: boq.projectType,
                  icon: Lightning,
                  gradient: 'linear-gradient(135deg, var(--color-text-muted), var(--color-text-secondary))',
                };
                const Icon = config.icon;
                const total = getTotal(boq);
                const itemCount = boq.boqItems.filter((i) => i.included !== false).length;

                return (
                  <div
                    key={boq.id}
                    className="quick-boq-card"
                    onClick={() => router.push(`/quick-projects/${boq.projectType}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && router.push(`/quick-projects/${boq.projectType}`)}
                  >
                    <Card>
                      <div style={{ padding: '20px' }}>
                        {/* Header Row */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '16px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: config.gradient,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <Icon size={20} weight="fill" style={{ color: 'white' }} />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                                {(boq.answers?.project_name as string) || config.label}
                              </h3>
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                {config.label} &middot; {itemCount} items
                              </span>
                            </div>
                          </div>
                          <button
                            className="delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(boq.id);
                            }}
                            title="Delete estimate"
                          >
                            <Trash size={16} weight="regular" />
                          </button>
                        </div>

                        {/* Total */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '12px',
                        }}>
                          <CurrencyDollar size={18} weight="duotone" style={{ color: '#22c55e' }} />
                          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {formatPrice(total, total * exchangeRate)}
                          </span>
                        </div>

                        {/* Date */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.8rem',
                          color: 'var(--color-text-muted)',
                        }}>
                          <Calendar size={14} />
                          {formatDate(boq.createdAt)}
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}

          {/* Delete Confirmation */}
          <ConfirmDialog
            isOpen={!!deleteTarget}
            title="Delete Estimate"
            message="Are you sure you want to delete this quick estimate? This cannot be undone."
            confirmText="Delete"
            variant="danger"
            onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
          />
        </div>

        <style jsx>{`
          .quick-boq-card {
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          .quick-boq-card:hover {
            transform: translateY(-2px);
          }
          .delete-btn {
            background: none;
            border: none;
            color: var(--color-text-muted);
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            transition: all 0.15s;
          }
          .delete-btn:hover {
            color: var(--color-error);
            background: #fef2f2;
          }
        `}</style>
      </ProtectedRoute>
    </MainLayout>
  );
}

export default function QuickBOQsPage() {
  return <QuickBOQsContent />;
}
