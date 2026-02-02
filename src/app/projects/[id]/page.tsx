'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardHeader, CardTitle, CardContent, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import InlineEdit from '@/components/ui/InlineEdit';
import BudgetPlanner from '@/components/ui/BudgetPlanner';
import PurchaseTracker from '@/components/ui/PurchaseTracker';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  getProjectWithItems,
  deleteProject,
  updateProject,
  updateBOQItem,
  getProjectPurchaseStats,
  createReminder,
  generateWhatsAppReminderLink,
} from '@/lib/services/projects';
import { Project, BOQItem } from '@/lib/database.types';
import {
  PencilSimple,
  ShareNetwork,
  Export,
  Trash,
  CaretDown,
  CaretUp,
  ArrowLeft,
  Package,
  MapPin,
  Calendar,
  Tag,
  WhatsappLogo,
  TrendUp,
  CheckCircle,
  ShoppingCart,
  Bell,
  Wallet,
  ClipboardText,
} from '@phosphor-icons/react';

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
  const { formatPrice } = useCurrency();
  return <>{formatPrice(priceUsd, priceZwg)}</>;
}

// Group BOQ items by category
function groupItemsByCategory(items: BOQItem[]): Record<string, BOQItem[]> {
  return items.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, BOQItem[]>);
}

// Category display names
const categoryLabels: Record<string, string> = {
  substructure: 'Substructure',
  superstructure: 'Superstructure',
  roofing: 'Roofing',
  finishing: 'Finishing',
  exterior: 'Exterior & Security',
  labor: 'Labor & Services',
};

interface CategorySectionProps {
  category: string;
  items: BOQItem[];
  onItemUpdate: (itemId: string, updates: Partial<BOQItem>) => void;
  viewMode: 'boq' | 'tracking';
}

function CategorySection({ category, items, onItemUpdate, viewMode }: CategorySectionProps) {
  const [expanded, setExpanded] = useState(true);
  const { formatPrice, exchangeRate } = useCurrency();

  const totalUsd = items.reduce((sum, item) => sum + Number(item.total_usd), 0);
  const totalZwg = items.reduce((sum, item) => sum + Number(item.total_zwg), 0);
  const purchasedCount = items.filter(i => i.is_purchased).length;

  return (
    <Card className="category-section">
      <div className="category-header" onClick={() => setExpanded(!expanded)}>
        <div className="category-info">
          <h4>{categoryLabels[category] || category}</h4>
          <span className="item-count">
            {items.length} items
            {viewMode === 'tracking' && ` • ${purchasedCount} purchased`}
          </span>
        </div>
        <div className="category-total">
          <PriceDisplay priceUsd={totalUsd} priceZwg={totalZwg} />
        </div>
        <button className="expand-btn">
          {expanded ? <CaretUp size={20} /> : <CaretDown size={20} />}
        </button>
      </div>

      {expanded && (
        <div className="category-content">
          {viewMode === 'boq' ? (
            <table className="materials-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="material-name">{item.material_name}</div>
                      {item.notes && <div className="material-notes">{item.notes}</div>}
                    </td>
                    <td>
                      <InlineEdit
                        value={Number(item.quantity)}
                        type="number"
                        suffix={` ${item.unit}`}
                        onSave={(val) => onItemUpdate(item.id, {
                          quantity: Number(val),
                          total_usd: Number(val) * Number(item.unit_price_usd),
                          total_zwg: Number(val) * Number(item.unit_price_zwg),
                        })}
                      />
                    </td>
                    <td>
                      <InlineEdit
                        value={Number(item.unit_price_usd)}
                        type="currency"
                        prefix="$"
                        onSave={(val) => onItemUpdate(item.id, {
                          unit_price_usd: Number(val),
                          unit_price_zwg: Number(val) * exchangeRate,
                          total_usd: Number(item.quantity) * Number(val),
                          total_zwg: Number(item.quantity) * Number(val) * exchangeRate,
                        })}
                      />
                    </td>
                    <td className="total-cell">
                      <PriceDisplay priceUsd={Number(item.total_usd)} priceZwg={Number(item.total_zwg)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="tracking-list">
              {items.map((item) => (
                <PurchaseTracker
                  key={item.id}
                  item={item}
                  onUpdate={(itemId, updates) => onItemUpdate(itemId, updates)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .category-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          cursor: pointer;
          padding: var(--spacing-md);
          margin: calc(-1 * var(--spacing-md));
          border-radius: var(--radius-md);
        }
        .category-header:hover { background: var(--color-background); }
        .category-info { flex: 1; }
        .category-info h4 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }
        .item-count {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }
        .category-total {
          font-weight: 600;
          color: var(--color-text);
        }
        .expand-btn {
          background: none;
          border: none;
          padding: var(--spacing-sm);
          cursor: pointer;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
        }
        .category-content {
          margin-top: var(--spacing-md);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--color-border-light);
        }
        .materials-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .materials-table th,
        .materials-table td {
          padding: var(--spacing-sm);
          text-align: left;
          border-bottom: 1px solid var(--color-border-light);
        }
        .materials-table th {
          color: var(--color-text-secondary);
          font-weight: 500;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .materials-table tbody tr:last-child td { border-bottom: none; }
        .material-name { font-weight: 500; }
        .material-notes {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin-top: 2px;
        }
        .total-cell { font-weight: 600; }
        .tracking-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }
      `}</style>
    </Card>
  );
}

function ProjectDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const { profile } = useAuth();
  const { exchangeRate } = useCurrency();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<BOQItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'boq' | 'tracking'>('boq');
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');

  // Purchase stats
  const purchaseStats = useMemo(() => {
    const totalItems = items.length;
    const purchasedItems = items.filter(i => i.is_purchased).length;
    const estimatedTotal = items.reduce((sum, item) =>
      sum + (Number(item.quantity) * Number(item.unit_price_usd)), 0);
    const actualSpent = items
      .filter(item => item.is_purchased)
      .reduce((sum, item) => {
        const qty = item.actual_quantity ?? item.quantity;
        const price = item.actual_price_usd ?? item.unit_price_usd;
        return sum + (Number(qty) * Number(price));
      }, 0);

    // Critical items (first 3 from substructure - bricks, cement, sand)
    const criticalItems = items
      .filter(i => i.category === 'substructure' && !i.is_purchased)
      .slice(0, 3)
      .reduce((sum, item) => sum + Number(item.total_usd), 0);

    return {
      totalItems,
      purchasedItems,
      estimatedTotal,
      actualSpent,
      remainingBudget: estimatedTotal - actualSpent,
      criticalItemsUsd: criticalItems,
    };
  }, [items]);

  useEffect(() => {
    async function loadProject() {
      setIsLoading(true);
      setError(null);

      const { project: loadedProject, items: loadedItems, error: loadError } =
        await getProjectWithItems(projectId);

      if (loadError) {
        setError(loadError.message);
      } else if (loadedProject) {
        setProject(loadedProject);
        setItems(loadedItems);
      } else {
        setError('Project not found');
      }

      setIsLoading(false);
    }

    loadProject();
  }, [projectId]);

  const handleProjectUpdate = async (updates: Partial<Project>) => {
    if (!project) return;

    const { project: updated, error } = await updateProject(projectId, updates);
    if (error) {
      showError('Failed to update project');
    } else if (updated) {
      setProject(updated);
      success('Project updated');
    }
  };

  const handleItemUpdate = async (itemId: string, updates: Partial<BOQItem>) => {
    const { item, error } = await updateBOQItem(itemId, updates);
    if (error) {
      showError('Failed to update item');
    } else if (item) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i));

      // Recalculate project totals if quantity or price changed
      if ('total_usd' in updates || 'total_zwg' in updates) {
        const newTotal = items.reduce((sum, i) => {
          if (i.id === itemId) {
            return sum + Number(updates.total_usd || i.total_usd);
          }
          return sum + Number(i.total_usd);
        }, 0);

        await updateProject(projectId, {
          total_usd: newTotal,
          total_zwg: newTotal * exchangeRate,
        });
        setProject(prev => prev ? { ...prev, total_usd: newTotal, total_zwg: newTotal * exchangeRate } : prev);
      }
    }
  };

  const handleSetReminder = async (type: 'daily' | 'weekly' | 'monthly', amount: number) => {
    if (!phoneNumber) {
      setShowReminderModal(true);
      return;
    }

    const message = `ZimEstimate Reminder: Save $${amount.toFixed(2)} ${type} for your "${project?.name}" project. You've got this!`;
    const whatsappLink = generateWhatsAppReminderLink(phoneNumber, message);

    // Open WhatsApp with the reminder message
    window.open(whatsappLink, '_blank');

    success(`${type.charAt(0).toUpperCase() + type.slice(1)} reminder ready! WhatsApp opened.`);
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/projects/${projectId}`;
    const message = `Check out my construction project "${project?.name}" on ZimEstimate!\n\nTotal Budget: $${Number(project?.total_usd).toLocaleString()}\n\n${shareUrl}`;

    if (navigator.share) {
      navigator.share({
        title: project?.name || 'My Project',
        text: message,
        url: shareUrl,
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    const { error: deleteError } = await deleteProject(projectId);

    if (deleteError) {
      showError('Failed to delete project: ' + deleteError.message);
      setIsDeleting(false);
    } else {
      success('Project deleted');
      router.push('/projects');
    }
  };

  if (isLoading) {
    return (
      <MainLayout title="Loading...">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading project...</p>
        </div>
        <style jsx>{`
          .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            gap: var(--spacing-md);
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--color-border);
            border-top-color: var(--color-primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          p { color: var(--color-text-secondary); }
        `}</style>
      </MainLayout>
    );
  }

  if (error || !project) {
    return (
      <MainLayout title="Error">
        <div className="error-state">
          <h2>Project Not Found</h2>
          <p>{error || 'The requested project could not be found.'}</p>
          <Link href="/projects">
            <Button variant="secondary" icon={<ArrowLeft size={18} />}>
              Back to Projects
            </Button>
          </Link>
        </div>
        <style jsx>{`
          .error-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            gap: var(--spacing-md);
            text-align: center;
          }
          h2 { color: var(--color-text); margin: 0; }
          p { color: var(--color-text-secondary); margin: 0; }
        `}</style>
      </MainLayout>
    );
  }

  const groupedItems = groupItemsByCategory(items);
  const categories = Object.keys(groupedItems);

  const statusColors: Record<string, 'success' | 'accent' | 'default'> = {
    active: 'success',
    draft: 'default',
    completed: 'accent',
    archived: 'default',
  };

  return (
    <MainLayout title={project.name}>
      <div className="project-detail">
        {/* Back Link */}
        <Link href="/projects" className="back-link">
          <ArrowLeft size={16} />
          Back to Projects
        </Link>

        {/* Project Header with Inline Edit */}
        <div className="project-header">
          <div className="project-info">
            <h1>
              <InlineEdit
                value={project.name}
                onSave={(val) => handleProjectUpdate({ name: String(val) })}
                className="title-edit"
              />
            </h1>
            <div className="project-meta">
              <CardBadge variant={statusColors[project.status] || 'default'}>
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </CardBadge>
              <span className="meta-item">
                <MapPin size={14} />
                <InlineEdit
                  value={project.location || ''}
                  placeholder="Add location"
                  onSave={(val) => handleProjectUpdate({ location: String(val) || null })}
                />
              </span>
              <span className="meta-item">
                <Calendar size={14} />
                {new Date(project.created_at).toLocaleDateString()}
              </span>
              <span className="meta-item">
                <Tag size={14} />
                {project.scope.replace('_', ' ')}
              </span>
            </div>
          </div>
          <div className="header-actions">
            <Button variant="ghost" icon={<WhatsappLogo size={18} />} onClick={handleShare}>
              Share
            </Button>
            <Link href={`/export?project=${project.id}`}>
              <Button variant="secondary" icon={<Export size={18} />}>
                Export
              </Button>
            </Link>
            <Button
              variant="danger"
              icon={<Trash size={18} />}
              onClick={handleDelete}
              loading={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Stats Grid with Progress */}
        <div className="stats-grid">
          <Card variant="dashboard">
            <CardHeader>
              <CardTitle>Total Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="stat-value">
                <PriceDisplay
                  priceUsd={Number(project.total_usd)}
                  priceZwg={Number(project.total_zwg)}
                />
              </p>
              <p className="stat-label">{items.length} line items</p>
            </CardContent>
          </Card>

          <Card variant="dashboard">
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="stat-value">
                {purchaseStats.purchasedItems}/{purchaseStats.totalItems}
              </p>
              <div className="mini-progress">
                <div
                  className="mini-progress-fill"
                  style={{ width: `${(purchaseStats.purchasedItems / purchaseStats.totalItems) * 100}%` }}
                />
              </div>
              <p className="stat-label">items purchased</p>
            </CardContent>
          </Card>

          <Card variant="dashboard">
            <CardHeader>
              <CardTitle>Actual Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="stat-value spent">
                <PriceDisplay
                  priceUsd={purchaseStats.actualSpent}
                  priceZwg={purchaseStats.actualSpent * exchangeRate}
                />
              </p>
              <p className="stat-label">
                {purchaseStats.actualSpent <= purchaseStats.estimatedTotal ? (
                  <span className="under-budget">
                    <TrendUp size={12} /> Under budget
                  </span>
                ) : (
                  <span className="over-budget">Over by ${(purchaseStats.actualSpent - purchaseStats.estimatedTotal).toFixed(2)}</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* View Mode Toggle */}
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'boq' ? 'active' : ''}`}
            onClick={() => setViewMode('boq')}
          >
            <ClipboardText size={18} />
            Bill of Quantities
          </button>
          <button
            className={`toggle-btn ${viewMode === 'tracking' ? 'active' : ''}`}
            onClick={() => setViewMode('tracking')}
          >
            <ShoppingCart size={18} />
            Purchase Tracking
          </button>
        </div>

        {/* BOQ Items by Category */}
        <section className="boq-section">
          <div className="section-header">
            <h3>{viewMode === 'boq' ? 'Bill of Quantities' : 'Purchase Tracking'}</h3>
            {viewMode === 'boq' && (
              <Link href={`/boq/new?id=${project.id}`}>
                <Button variant="secondary" size="sm" icon={<PencilSimple size={16} />}>
                  Edit
                </Button>
              </Link>
            )}
          </div>

          {items.length === 0 ? (
            <Card>
              <div className="empty-state">
                <Package size={48} weight="light" />
                <h4>No materials yet</h4>
                <p>Start adding materials to your Bill of Quantities</p>
                <Link href={`/boq/new?id=${project.id}`}>
                  <Button icon={<PencilSimple size={18} />}>
                    Edit BOQ
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="categories-list">
              {categories.map((category) => (
                <CategorySection
                  key={category}
                  category={category}
                  items={groupedItems[category]}
                  onItemUpdate={handleItemUpdate}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </section>

        {/* Budget Planner */}
        {items.length > 0 && (
          <section className="planner-section">
            <BudgetPlanner
              totalBudgetUsd={purchaseStats.estimatedTotal}
              amountSpentUsd={purchaseStats.actualSpent}
              targetDate={project.target_date}
              onTargetDateChange={(date) => handleProjectUpdate({ target_date: date })}
              criticalItemsUsd={purchaseStats.criticalItemsUsd}
              onSetReminder={handleSetReminder}
            />
          </section>
        )}

        {/* Grand Total */}
        {items.length > 0 && (
          <Card className="grand-total-card">
            <div className="grand-total">
              <span className="total-label">Grand Total</span>
              <span className="total-value">
                <PriceDisplay
                  priceUsd={Number(project.total_usd)}
                  priceZwg={Number(project.total_zwg)}
                />
              </span>
            </div>
          </Card>
        )}
      </div>

      {/* Phone Number Modal */}
      {showReminderModal && (
        <div className="modal-overlay" onClick={() => setShowReminderModal(false)}>
          <div className="reminder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <WhatsappLogo size={32} weight="fill" />
            </div>
            <h3>Set Up WhatsApp Reminders</h3>
            <p>Enter your phone number to receive savings reminders via WhatsApp.</p>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+263 77 123 4567"
              className="phone-input"
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowReminderModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowReminderModal(false);
                  success('Phone number saved! Select a reminder option.');
                }}
                disabled={!phoneNumber}
              >
                Save Number
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .project-detail {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
          max-width: 960px;
          margin: 0 auto;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          color: var(--color-text-secondary);
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.2s;
        }
        .back-link:hover { color: var(--color-primary); }

        .project-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--spacing-lg);
        }

        .project-info h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .project-info :global(.title-edit) {
          font-size: inherit;
          font-weight: inherit;
        }

        .project-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--spacing-md);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          color: var(--color-text-secondary);
          font-size: 0.875rem;
        }

        .header-actions {
          display: flex;
          gap: var(--spacing-sm);
          flex-shrink: 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-lg);
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-text);
          margin: 0;
        }

        .stat-value.spent { color: var(--color-accent); }

        .stat-label {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: var(--spacing-xs) 0 0 0;
        }

        .mini-progress {
          height: 6px;
          background: var(--color-border-light);
          border-radius: 3px;
          margin: var(--spacing-sm) 0;
          overflow: hidden;
        }

        .mini-progress-fill {
          height: 100%;
          background: var(--color-success);
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .under-budget {
          color: var(--color-success);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .over-budget { color: var(--color-error); }

        .view-toggle {
          display: flex;
          gap: var(--spacing-sm);
          background: var(--color-background);
          padding: var(--spacing-xs);
          border-radius: var(--radius-lg);
          width: fit-content;
        }

        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: var(--spacing-sm) var(--spacing-lg);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .toggle-btn:hover { color: var(--color-text); }

        .toggle-btn.active {
          background: var(--color-surface);
          color: var(--color-text);
          box-shadow: var(--shadow-sm);
        }

        .boq-section {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .section-header h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }

        .categories-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-2xl);
          text-align: center;
          color: var(--color-text-muted);
        }

        .empty-state h4 {
          margin: var(--spacing-md) 0 var(--spacing-xs) 0;
          color: var(--color-text);
        }

        .empty-state p { margin: 0 0 var(--spacing-lg) 0; }

        .planner-section { margin-top: var(--spacing-lg); }

        :global(.grand-total-card) {
          background: var(--color-primary);
          color: white;
        }

        .grand-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .total-label {
          font-size: 1rem;
          font-weight: 500;
        }

        .total-value {
          font-size: 1.75rem;
          font-weight: 700;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .reminder-modal {
          background: white;
          border-radius: var(--radius-lg);
          padding: var(--spacing-xl);
          max-width: 400px;
          width: 90%;
          text-align: center;
        }

        .modal-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto var(--spacing-md);
          background: #25D366;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .reminder-modal h3 {
          margin: 0 0 var(--spacing-sm) 0;
          color: var(--color-text);
        }

        .reminder-modal p {
          margin: 0 0 var(--spacing-lg) 0;
          color: var(--color-text-secondary);
        }

        .phone-input {
          width: 100%;
          padding: var(--spacing-md);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: 1rem;
          margin-bottom: var(--spacing-lg);
        }

        .modal-actions {
          display: flex;
          gap: var(--spacing-sm);
          justify-content: center;
        }

        .btn {
          padding: var(--spacing-sm) var(--spacing-lg);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: var(--color-primary);
          color: white;
        }

        .btn-secondary {
          background: var(--color-background);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
        }

        @media (max-width: 768px) {
          .project-header { flex-direction: column; }
          .header-actions {
            width: 100%;
            flex-wrap: wrap;
          }
          .stats-grid { grid-template-columns: 1fr; }
          .view-toggle { width: 100%; }
          .toggle-btn { flex: 1; justify-content: center; }
        }
      `}</style>
    </MainLayout>
  );
}

export default function ProjectDetail() {
  return (
    <ProtectedRoute>
      <ProjectDetailContent />
    </ProtectedRoute>
  );
}
