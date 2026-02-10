'use client';

import { useState, useMemo, useEffect } from 'react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  createPurchaseRecord,
  getProjectPurchases,
  updatePurchaseRecord,
  deletePurchaseRecord,
} from '@/lib/services/purchases';
import {
  getRequestsForQuotations,
  createRequestForQuotation,
  updateRequestForQuotation,
} from '@/lib/services/rfq';
import {
  getSuppliers,
  createSupplier,
} from '@/lib/services/suppliers';
import {
  Project,
  BOQItem,
  PurchaseRecord,
  RequestForQuotation,
  Supplier,
} from '@/lib/database.types';
import { useReveal } from '@/hooks/useReveal';
import {
  Plus,
  MagnifyingGlass,
  Funnel,
  DownloadSimple,
  ShoppingCart,
  FileText,
  Storefront,
  CheckCircle,
  Warning,
  DotsThreeVertical,
  TrendUp,
  Money,
  Printer,
  EnvelopeSimple,
  PencilSimple,
  Trash,
  X,
  CaretDown,
} from '@phosphor-icons/react';

type ProcurementStage = 'planning' | 'rfq' | 'quotes' | 'purchasing' | 'delivery';

interface UnifiedProcurementViewProps {
  project: Project;
  items: BOQItem[];
  onItemsRefresh: () => void;
}

export default function UnifiedProcurementView({
  project,
  items,
  onItemsRefresh,
}: UnifiedProcurementViewProps) {
  const { success, error: showError } = useToast();
  const { formatPrice, exchangeRate } = useCurrency();

  // State
  const [activeStage, setActiveStage] = useState<ProcurementStage>('purchasing');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Data State
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [rfqs, setRfqs] = useState<RequestForQuotation[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Modal States (placeholders for now)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showRfqModal, setShowRfqModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  useReveal({ deps: [activeStage, purchases.length, rfqs.length, suppliers.length] });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [purchasesData, rfqsData, suppliersData] = await Promise.all([
          getProjectPurchases(project.id),
          getRequestsForQuotations(project.id),
          getSuppliers(),
        ]);

        if (purchasesData.purchases) setPurchases(purchasesData.purchases);
        if (rfqsData.rfqs) setRfqs(rfqsData.rfqs);
        if (suppliersData.suppliers) setSuppliers(suppliersData.suppliers);
      } catch (err) {
        console.error('Failed to load procurement data:', err);
        showError('Failed to load procurement data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [project.id]);

  // Computed Stats
  const stats = useMemo(() => {
    const totalBudget = project.total_usd || 0;
    const totalSpent = purchases.reduce((sum, p) => sum + (Number(p.total_cost_usd) || 0), 0);
    const pendingRfqs = rfqs.filter(r => r.status === 'open' || r.status === 'draft').length;
    const openOrders = purchases.filter(p => p.status === 'ordered' || p.status === 'pending_delivery').length;

    return {
      totalBudget,
      totalSpent,
      remainingBudget: totalBudget - totalSpent,
      pendingRfqs,
      openOrders,
      spendingProgress: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
    };
  }, [project.total_usd, purchases, rfqs]);

  // Filtered Rows based on active stage
  const filteredRows = useMemo(() => {
    let rows: any[] = [];
    switch (activeStage) {
      case 'purchasing':
        rows = purchases;
        break;
      case 'rfq':
        rows = rfqs;
        break;
      case 'delivery':
        rows = purchases.filter(p => p.status === 'pending_delivery' || p.status === 'delivered');
        break;
      default:
        rows = [];
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      // Basic filtering logic - expand based on actual data structure
      rows = rows.filter(row =>
        JSON.stringify(row).toLowerCase().includes(lowerQuery)
      );
    }

    return rows;
  }, [activeStage, purchases, rfqs, searchQuery]);

  const renderStageTabs = () => (
    <div className="flex space-x-1 border-b border-border overflow-x-auto no-scrollbar mb-6 reveal" data-delay="1">
      <button
        onClick={() => setActiveStage('planning')}
        className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeStage === 'planning'
          ? 'border-accent text-accent'
          : 'border-transparent text-secondary hover:text-primary'
          }`}
      >
        Planning
      </button>
      <button
        onClick={() => setActiveStage('rfq')}
        className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeStage === 'rfq'
          ? 'border-accent text-accent'
          : 'border-transparent text-secondary hover:text-primary'
          }`}
      >
        RFQs & Quotes
      </button>
      <button
        onClick={() => setActiveStage('purchasing')}
        className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeStage === 'purchasing'
          ? 'border-accent text-accent'
          : 'border-transparent text-secondary hover:text-primary'
          }`}
      >
        Purchases
      </button>
      <button
        onClick={() => setActiveStage('delivery')}
        className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeStage === 'delivery'
          ? 'border-accent text-accent'
          : 'border-transparent text-secondary hover:text-primary'
          }`}
      >
        Delivery & Inventory
      </button>
    </div>
  );

  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 reveal" data-delay="2">
      <Card className="p-4 flex items-center gap-4 bg-surface border-border shadow-sm">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
          <Money size={24} weight="duotone" />
        </div>
        <div>
          <div className="text-sm text-secondary">Total Spent</div>
          <div className="text-xl font-bold text-primary font-mono">
            {formatPrice(stats.totalSpent, stats.totalSpent * exchangeRate)}
          </div>
        </div>
      </Card>

      <Card className="p-4 flex items-center gap-4 bg-surface border-border shadow-sm">
        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
          <TrendUp size={24} weight="duotone" />
        </div>
        <div>
          <div className="text-sm text-secondary">Remaining Budget</div>
          <div className="text-xl font-bold text-primary font-mono">
            {formatPrice(stats.remainingBudget, stats.remainingBudget * exchangeRate)}
          </div>
        </div>
      </Card>

      <Card className="p-4 flex items-center gap-4 bg-surface border-border shadow-sm">
        <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
          <FileText size={24} weight="duotone" />
        </div>
        <div>
          <div className="text-sm text-secondary">Pending RFQs</div>
          <div className="text-xl font-bold text-primary">
            {stats.pendingRfqs}
          </div>
        </div>
      </Card>

      <Card className="p-4 flex items-center gap-4 bg-surface border-border shadow-sm">
        <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
          <Storefront size={24} weight="duotone" />
        </div>
        <div>
          <div className="text-sm text-secondary">Open Orders</div>
          <div className="text-xl font-bold text-primary">
            {stats.openOrders}
          </div>
        </div>
      </Card>
    </div>
  );

  const renderToolbar = () => (
    <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6 reveal" data-delay="3">
      <div className="flex items-center gap-2 w-full md:w-auto">
        <div className="relative flex-1 md:w-64">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
          <input
            type="text"
            placeholder={`Search ${activeStage}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          />
        </div>
        <Button variant="secondary" icon={<Funnel size={16} />}>
          Filter
        </Button>
      </div>

      <div className="flex gap-2 w-full md:w-auto">
        {activeStage === 'purchasing' && (
          <Button onClick={() => setShowPurchaseModal(true)} icon={<Plus size={16} />}>
            Record Purchase
          </Button>
        )}
        {activeStage === 'rfq' && (
          <Button onClick={() => setShowRfqModal(true)} icon={<Plus size={16} />}>
            Create RFQ
          </Button>
        )}
        <Button variant="ghost" icon={<DownloadSimple size={16} />}>
          Export
        </Button>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="py-12 text-center text-secondary">
          Loading procurement data...
        </div>
      );
    }

    if (filteredRows.length === 0) {
      return (
        <EmptyState
          icon={<ShoppingCart size={48} weight="light" />}
          title={`No ${activeStage} records found`}
          description="Get started by creating your first record."
          action={
            <Button
              onClick={() => activeStage === 'rfq' ? setShowRfqModal(true) : setShowPurchaseModal(true)}
              icon={<Plus size={16} />}
            >
              Create New
            </Button>
          }
        />
      );
    }

    return (
      <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm reveal" data-delay="4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-mist text-secondary font-medium border-b border-border">
              <tr>
                {activeStage === 'purchasing' && (
                  <>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 w-10"></th>
                  </>
                )}
                {activeStage === 'rfq' && (
                  <>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Suppliers</th>
                    <th className="px-4 py-3">Deadline</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 w-10"></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-mist transition-colors group">
                  {activeStage === 'purchasing' && (
                    <>
                      <td className="px-4 py-3 text-primary">
                        {new Date(row.purchase_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-primary font-medium">
                        {row.supplier_name || 'Unknown Supplier'}
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {(row.items || []).length} items
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-primary">
                        {formatPrice(row.total_cost_usd, row.total_cost_zwg)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${row.status === 'delivered' ? 'success' : 'accent'}-soft text-${row.status === 'delivered' ? 'success' : 'accent'}`}>
                          {row.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-secondary hover:text-primary p-1">
                          <DotsThreeVertical size={20} weight="bold" />
                        </button>
                      </td>
                    </>
                  )}
                  {activeStage === 'rfq' && (
                    <>
                      <td className="px-4 py-3 text-primary">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-primary font-medium">
                        {row.title || 'Untitled RFQ'}
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {(row.supplier_ids || []).length} recipients
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {row.due_date ? new Date(row.due_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${row.status === 'closed' ? 'secondary' : 'accent'}-soft text-${row.status === 'closed' ? 'secondary' : 'accent'}`}>
                          {row.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-secondary hover:text-primary p-1">
                          <DotsThreeVertical size={20} weight="bold" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="procurement-view">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-primary font-heading mb-2">Procurement Hub</h2>
        <p className="text-secondary">Manage your purchasing, requests for quotations, and supplier relationships.</p>
      </div>

      {renderSummaryCards()}
      {renderStageTabs()}

      <div className="mt-6">
        {renderToolbar()}
        {renderContent()}
      </div>

      {/* Placeholder for Modals - these would be separate components */}
      {/* <PurchaseRecordModal isOpen={showPurchaseModal} onClose={() => setShowPurchaseModal(false)} /> */}
      {/* <RFQModal isOpen={showRfqModal} onClose={() => setShowRfqModal(false)} /> */}
    </div>
  );
}
