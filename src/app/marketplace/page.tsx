'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ProjectPickerModal from '@/components/ui/ProjectPickerModal';
import PriceSparkline from '@/components/ui/PriceSparkline';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useToast } from '@/components/ui/Toast';
import { useReveal } from '@/hooks/useReveal';
import { Project } from '@/lib/database.types';
import { addBOQItem, updateProject, getProject } from '@/lib/services/projects';
import { createRfqRequest } from '@/lib/services/rfq';
import {
  getBatchPrices,
  getPriceComparisons,
  getPriceWithTrend,
  getConfidenceLabel,
  getConfidenceColor,
  formatLastUpdated,
  type LivePrice,
  type PriceComparison,
  type PriceWithTrend,
} from '@/lib/services/prices';
import {
  MagnifyingGlass,
  Star,
  ShieldCheck,
  MapPin,
  Storefront,
  Plus,
  Cube,
  Package,
  Drop,
  Stack,
  Barbell,
  HouseSimple,
  Tree,
  Lightning,
  PaintBrush,
  Wrench,
  TrendUp,
  TrendDown,
  ClipboardText,
  Bell,
  BellSlash,
  Clock,
  Database,
  Info,
  X,
} from '@phosphor-icons/react';
import {
  materials,
  getPricesForMaterial,
  getTrustedSuppliers,
  categoryInfo,
  type Material,
  type MaterialCategory,
} from '@/lib/materials';

// Icon mapping
const categoryIcons: Record<string, React.ComponentType<{ size?: number; weight?: 'light' | 'regular' | 'bold' }>> = {
  Cube,
  Package,
  Drop,
  Stack,
  Barbell,
  HouseSimple,
  Tree,
  Lightning,
  PaintBrush,
  Wrench,
};

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
  const { formatPrice } = useCurrency();
  return <>{formatPrice(priceUsd, priceZwg)}</>;
}

interface MaterialWithPrice extends Material {
  livePrice?: LivePrice;
  priceWithTrend?: PriceWithTrend;
}

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'all'>('all');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialWithPrice | null>(null);
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [pickerAction, setPickerAction] = useState<'add' | 'rfq'>('add');
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isRequestingQuote, setIsRequestingQuote] = useState(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());
  const [priceAlerts, setPriceAlerts] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    const saved = localStorage.getItem('priceAlerts');
    if (saved) {
      try { return new Set(JSON.parse(saved)); } catch { return new Set(); }
    }
    return new Set();
  });
  const [selectedPriceDetail, setSelectedPriceDetail] = useState<PriceWithTrend | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonRows, setComparisonRows] = useState<PriceComparison[]>([]);
  const [materialCompareOpen, setMaterialCompareOpen] = useState(false);
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null);
  const { success, error: showError } = useToast();


  // Load live prices on mount
  useEffect(() => {
    const loadPrices = async () => {
      setIsLoadingPrices(true);
      const materialKeys = materials.map(m => m.id);
      const prices = await getBatchPrices(materialKeys);
      setLivePrices(prices);
      setIsLoadingPrices(false);
    };
    loadPrices();
  }, []);

  // Load detailed price when material is selected
  useEffect(() => {
    if (selectedMaterial) {
      const loadDetail = async () => {
        const detail = await getPriceWithTrend(selectedMaterial.id);
        setSelectedPriceDetail(detail);
      };
      loadDetail();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset derived state when selection clears
      setSelectedPriceDetail(null);
    }
  }, [selectedMaterial]);

  const togglePriceAlert = useCallback((materialId: string) => {
    setPriceAlerts(prev => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
        success('Price alert removed');
      } else {
        next.add(materialId);
        success('Price alert enabled - you\'ll be notified of changes');
      }
      localStorage.setItem('priceAlerts', JSON.stringify([...next]));
      return next;
    });
  }, [success]);

  const handleAddToProject = async (project: Project) => {
    if (!selectedMaterial) return;

    const livePrice = livePrices.get(selectedMaterial.id);
    if (!livePrice) {
      showError('No pricing available for this material');
      return;
    }

    setIsAdding(true);

    const { error } = await addBOQItem({
      project_id: project.id,
      material_id: selectedMaterial.id,
      material_name: selectedMaterial.name,
      category: selectedMaterial.category,
      quantity: quantity,
      unit: selectedMaterial.unit,
      unit_price_usd: livePrice.priceUsd,
      unit_price_zwg: livePrice.priceZwg,
      sort_order: 0,
    });

    if (error) {
      showError('Failed to add material to project. Please try again.');
      setIsAdding(false);
      return;
    }

    const { project: currentProject } = await getProject(project.id);
    if (currentProject) {
      const itemTotalUsd = livePrice.priceUsd * quantity;
      const itemTotalZwg = livePrice.priceZwg * quantity;
      await updateProject(project.id, {
        total_usd: Number(currentProject.total_usd) + itemTotalUsd,
        total_zwg: Number(currentProject.total_zwg) + itemTotalZwg,
      });
    }

    success(`${quantity} ${selectedMaterial.unit} of ${selectedMaterial.name} added to ${project.name}`);
    setShowProjectPicker(false);
    setQuantity(1);
    setIsAdding(false);
  };

  const handleRequestQuote = async (project: Project) => {
    if (!selectedMaterial) return;

    setIsRequestingQuote(true);
    const { matches, error } = await createRfqRequest({
      projectId: project.id,
      deliveryAddress: project.location || null,
      requiredBy: null,
      notes: 'RFQ created from Marketplace',
      items: [
        {
          material_id: selectedMaterial.id,
          material_name: selectedMaterial.name,
          quantity,
          unit: selectedMaterial.unit,
        },
      ],
      maxSuppliers: 10,
    });

    if (error) {
      showError(error.message || 'Failed to create RFQ');
      setIsRequestingQuote(false);
      return;
    }

    const matchCount = matches.length;
    success(matchCount > 0
      ? `RFQ sent to ${matchCount} suppliers for ${selectedMaterial.name}`
      : `RFQ created for ${selectedMaterial.name}. No suppliers matched yet.`);
    setShowProjectPicker(false);
    setIsRequestingQuote(false);
  };

  const handleProjectSelect = async (project: Project) => {
    if (pickerAction === 'rfq') {
      await handleRequestQuote(project);
      return;
    }
    await handleAddToProject(project);
  };

  const openPriceComparison = async () => {
    if (!selectedMaterial) return;
    setComparisonOpen(true);
    setComparisonLoading(true);
    const rows = await getPriceComparisons(selectedMaterial.id);
    setComparisonRows(rows);
    setComparisonLoading(false);
  };

  // Filter materials
  const filteredMaterials = useMemo(() => {
    let result = materials;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(lowerQuery) ||
          m.category.toLowerCase().includes(lowerQuery) ||
          m.subcategory.toLowerCase().includes(lowerQuery) ||
          m.specifications?.toLowerCase().includes(lowerQuery)
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter((m) => m.category === selectedCategory);
    }

    return result;
  }, [searchQuery, selectedCategory]);

  // Group materials by category
  const groupedMaterials = useMemo(() => {
    const groups: Record<string, Material[]> = {};
    filteredMaterials.forEach((m) => {
      if (!groups[m.category]) {
        groups[m.category] = [];
      }
      groups[m.category].push(m);
    });
    return groups;
  }, [filteredMaterials]);

  useReveal({ deps: [filteredMaterials.length, selectedCategory, selectedMaterial?.id, isLoadingPrices] });

  const categories = Object.keys(categoryInfo) as MaterialCategory[];

  const alternativeMaterials = useMemo(() => {
    if (!selectedMaterial) return [];
    const sameSubcategory = materials.filter(
      (m) => m.id !== selectedMaterial.id && m.subcategory === selectedMaterial.subcategory
    );
    const sameCategory = materials.filter(
      (m) => m.id !== selectedMaterial.id && m.category === selectedMaterial.category && m.subcategory !== selectedMaterial.subcategory
    );
    return [...sameSubcategory, ...sameCategory].slice(0, 4);
  }, [selectedMaterial]);

  const compareTarget = useMemo(() => {
    if (!compareTargetId) return null;
    return materials.find((m) => m.id === compareTargetId) || null;
  }, [compareTargetId]);

  useEffect(() => {
    if (!selectedMaterial) return;
    if (alternativeMaterials.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset derived state
      setCompareTargetId(null);
      return;
    }
    setCompareTargetId(alternativeMaterials[0].id);
  }, [selectedMaterial, alternativeMaterials]);

  return (
    <MainLayout title="Marketplace">
      <div className="marketplace">
        {/* Search and Filters */}
        <div className="search-section reveal" data-delay="1">
          <div className="search-box">
            <Input
              placeholder="Search materials (e.g., cement, rebar, IBR sheets)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<MagnifyingGlass size={18} weight="light" />}
            />
          </div>
          <div className="filter-actions">
            <Button
              variant={trustedOnly ? 'primary' : 'secondary'}
              icon={<ShieldCheck size={18} />}
              size="sm"
              onClick={() => setTrustedOnly(!trustedOnly)}
            >
              Trusted Only
            </Button>
            <Link href="/marketplace/suppliers" className="dir-link">
              <Button variant="secondary" size="sm" icon={<Storefront size={18} />}>
                Supplier Directory
              </Button>
            </Link>
          </div>
        </div>

        {/* Category Pills */}
        <div className="category-section reveal" data-delay="2">
          <button
            className={`category-pill ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All Materials
          </button>
          {categories.map((cat) => {
            const info = categoryInfo[cat];
            const IconComponent = categoryIcons[info.icon] || Cube;
            return (
              <button
                key={cat}
                className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                <IconComponent size={16} weight="light" />
                {info.label}
              </button>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="content-grid">
          {/* Material List */}
          <div className="materials-list">
            {isLoadingPrices && (
              <div className="loading-banner">
                <div className="spinner" />
                <span>Loading live prices...</span>
              </div>
            )}

            {Object.entries(groupedMaterials).map(([category, items], groupIndex) => (
              <div
                key={category}
                className="category-group reveal"
                data-delay={(groupIndex % 5) + 1}
              >
                <h3 className="category-title">
                  {categoryInfo[category as MaterialCategory]?.label || category}
                  <span className="count">{items.length}</span>
                </h3>
                <div className="materials-grid">
                  {items.map((material, index) => {
                    const livePrice = livePrices.get(material.id);
                    const hasAlert = priceAlerts.has(material.id);
                    const supplierCount = getPricesForMaterial(material.id).length;
                    const delay = (index % 5) + 1;

                    return (
                      <div key={material.id} className="material-card-wrapper reveal" data-delay={delay}>
                        <Card
                          className={`material-card ${selectedMaterial?.id === material.id ? 'selected' : ''}`}
                          onClick={() => setSelectedMaterial(material)}
                        >
                          <CardContent>
                            <div className="material-header">
                              <span className="material-name">{material.name}</span>
                              <span className="material-subcategory">{material.subcategory}</span>
                            </div>
                            <div className="material-details">
                              <span className="unit">{material.unit}</span>
                              {livePrice && (
                                <span className="price">
                                  <PriceDisplay priceUsd={livePrice.priceUsd} priceZwg={livePrice.priceZwg} />
                                </span>
                              )}
                            </div>

                            {/* Price metadata row */}
                            {livePrice && (
                              <div className="price-meta">
                                <span className={`source-badge ${livePrice.source}`}>
                                  {livePrice.source === 'scraped' ? (
                                    <><Database size={10} /> Live</>
                                  ) : (
                                    <><Info size={10} /> Static</>
                                  )}
                                </span>
                                <span className="supplier-count">
                                  {supplierCount} suppliers
                                </span>
                                <span className="last-updated">
                                  <Clock size={10} />
                                  {formatLastUpdated(livePrice.lastUpdated)}
                                </span>
                                {hasAlert && (
                                  <Bell size={12} weight="fill" className="alert-indicator" />
                                )}
                              </div>
                            )}

                            {material.specifications && (
                              <p className="specs">{material.specifications}</p>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredMaterials.length === 0 && (
              <div className="empty-state reveal" data-delay="2">
                <p>No materials found matching your search.</p>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div className="detail-panel reveal" data-delay="3">
            {selectedMaterial ? (
              <Card className="detail-card">
                <CardContent>
                  <div className="detail-header">
                    <div>
                      <h2 className="detail-title">{selectedMaterial.name}</h2>
                      <p className="detail-subtitle">{selectedMaterial.subcategory}</p>
                    </div>
                    <button
                      className={`alert-btn ${priceAlerts.has(selectedMaterial.id) ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePriceAlert(selectedMaterial.id);
                      }}
                      title={priceAlerts.has(selectedMaterial.id) ? 'Remove price alert' : 'Set price alert'}
                    >
                      {priceAlerts.has(selectedMaterial.id) ? (
                        <Bell size={20} weight="fill" />
                      ) : (
                        <BellSlash size={20} />
                      )}
                    </button>
                  </div>

                  {selectedMaterial.specifications && (
                    <p className="detail-specs">{selectedMaterial.specifications}</p>
                  )}

                  <div className="detail-unit">
                    <span className="label">Unit:</span>
                    <span className="value">{selectedMaterial.unit}</span>
                  </div>
                  <div className="detail-unit">
                    <span className="label">Suppliers:</span>
                    <span className="value">{getPricesForMaterial(selectedMaterial.id).length} available</span>
                  </div>

                  {/* Live Price Card */}
                  {selectedPriceDetail && (
                    <div className="live-price-card">
                      <div className="price-main">
                        <span className="price-label">Current Price</span>
                        <span className="price-value">
                          <PriceDisplay
                            priceUsd={selectedPriceDetail.priceUsd}
                            priceZwg={selectedPriceDetail.priceZwg}
                          />
                        </span>
                      </div>

                      <div className="price-trend">
                        <div className="trend-chart">
                          <PriceSparkline
                            data={selectedPriceDetail.priceHistory}
                            width={80}
                            height={32}
                            trend={selectedPriceDetail.trend}
                          />
                        </div>
                        <div className={`trend-badge ${selectedPriceDetail.trend}`}>
                          {selectedPriceDetail.trend === 'up' ? (
                            <TrendUp size={14} weight="bold" />
                          ) : selectedPriceDetail.trend === 'down' ? (
                            <TrendDown size={14} weight="bold" />
                          ) : (
                            <span className="dash" />
                          )}
                          <span>
                            {selectedPriceDetail.changePercent === 0
                              ? 'Stable'
                              : `${selectedPriceDetail.changePercent > 0 ? '+' : ''}${selectedPriceDetail.changePercent}%`}
                          </span>
                        </div>
                      </div>

                      <div className="price-info-row">
                        <div className="info-item">
                          <span className="info-label">Source</span>
                          <span className={`info-value source ${selectedPriceDetail.source}`}>
                            {selectedPriceDetail.source === 'scraped' ? 'Live Data' : 'Static'}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Confidence</span>
                          <span
                            className="info-value confidence"
                            style={{ color: getConfidenceColor(selectedPriceDetail.confidence) }}
                          >
                            {getConfidenceLabel(selectedPriceDetail.confidence)}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Updated</span>
                          <span className="info-value">
                            {formatLastUpdated(selectedPriceDetail.lastUpdated)}
                          </span>
                        </div>
                      </div>

                      {selectedPriceDetail.supplierName && (
                        <div className="supplier-info">
                          <MapPin size={12} />
                          <span>{selectedPriceDetail.supplierName}</span>
                          {selectedPriceDetail.location && (
                            <span className="location"> - {selectedPriceDetail.location}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="milestones-used">
                    <span className="label">Used in:</span>
                    <div className="milestone-tags">
                      {selectedMaterial.milestones.map((m) => (
                        <span key={m} className="milestone-tag">{m}</span>
                      ))}
                    </div>
                  </div>

                  <hr className="divider" />

                  <h3 className="suppliers-title">All Supplier Prices</h3>
                  <div className="price-list">
                    {getPricesForMaterial(selectedMaterial.id)
                      .filter((p) => !trustedOnly || p.supplier.isTrusted)
                      .map((priceInfo, index) => (
                        <div
                          key={`${priceInfo.supplierId}-${index}`}
                          className={`price-row ${index === 0 ? 'best' : ''}`}
                        >
                          <div className="supplier-info">
                            <div className="supplier-name">
                              {priceInfo.supplier.name}
                              {priceInfo.supplier.isTrusted && (
                                <ShieldCheck size={14} weight="fill" className="trusted-badge" />
                              )}
                            </div>
                            <div className="supplier-location">
                              <MapPin size={12} weight="light" />
                              {priceInfo.supplier.location}
                            </div>
                          </div>
                          <div className="price-info">
                            <span className="supplier-price">
                              <PriceDisplay priceUsd={priceInfo.priceUsd} priceZwg={priceInfo.priceZwg} />
                            </span>
                            {index === 0 && <span className="best-badge">Best Price</span>}
                          </div>
                        </div>
                      ))}

                    {getPricesForMaterial(selectedMaterial.id).filter((p) => !trustedOnly || p.supplier.isTrusted).length === 0 && (
                      <p className="no-prices">No prices available from {trustedOnly ? 'trusted ' : ''}suppliers.</p>
                    )}
                  </div>

                  {alternativeMaterials.length > 0 && (
                    <>
                      <h3 className="alt-title">Similar Materials</h3>
                      <div className="alt-grid">
                        {alternativeMaterials.map((material) => {
                          const altPrice = livePrices.get(material.id);
                          return (
                            <button
                              key={material.id}
                              className="alt-card"
                              onClick={() => setSelectedMaterial(material)}
                            >
                              <div>
                                <span className="alt-name">{material.name}</span>
                                <span className="alt-sub">{material.subcategory}</span>
                              </div>
                              {altPrice && (
                                <span className="alt-price">
                                  <PriceDisplay priceUsd={altPrice.priceUsd} priceZwg={altPrice.priceZwg} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setMaterialCompareOpen(true)}
                      >
                        Compare Materials
                      </Button>
                    </>
                  )}

                  <div className="quantity-row">
                    <label htmlFor="quantity">Quantity:</label>
                    <div className="quantity-input">
                      <button
                        className="qty-btn"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        id="quantity"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                      />
                      <button
                        className="qty-btn"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <span className="qty-unit">{selectedMaterial.unit}</span>
                  </div>

                  <div className="action-row">
                    <Button
                      icon={<Plus size={16} />}
                      className="add-btn"
                      onClick={() => {
                        setPickerAction('add');
                        setShowProjectPicker(true);
                      }}
                      disabled={isAdding}
                    >
                      {isAdding ? 'Adding...' : 'Add to Estimate'}
                    </Button>
                    <Button
                      variant="secondary"
                      icon={<ClipboardText size={16} />}
                      className="quote-btn"
                      onClick={() => {
                        setPickerAction('rfq');
                        setShowProjectPicker(true);
                      }}
                      disabled={isRequestingQuote}
                    >
                      {isRequestingQuote ? 'Sending...' : 'Request Quote'}
                    </Button>
                  </div>

                  <Button
                    variant="secondary"
                    icon={<TrendUp size={16} />}
                    className="compare-btn"
                    onClick={openPriceComparison}
                  >
                    Compare Prices
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="detail-card empty">
                <CardContent>
                  <div className="empty-detail">
                    <Cube size={48} weight="light" />
                    <p>Select a material to view details and supplier prices</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Trusted Suppliers */}
            <Card className="suppliers-card">
              <CardContent>
                <h3 className="suppliers-header">
                  <ShieldCheck size={20} weight="fill" />
                  Trusted Suppliers
                </h3>
                <div className="supplier-list">
                  {getTrustedSuppliers().slice(0, 4).map((supplier) => (
                    <div key={supplier.id} className="supplier-row">
                      <div>
                        <span className="name">{supplier.name}</span>
                        <span className="location">{supplier.location}</span>
                      </div>
                      <div className="rating">
                        <Star size={14} weight="fill" />
                        {supplier.rating}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="market-disclaimer reveal" data-delay="2">
          <p>
            Prices reflect live market data from Zimbabwean suppliers. Live prices are updated regularly from verified sources.
          </p>
          <Link href="/ai/quote-scanner" className="quote-link">
            <Button variant="secondary" size="sm">Get a Quote</Button>
          </Link>
        </div>
      </div>

      <ProjectPickerModal
        isOpen={showProjectPicker}
        onClose={() => setShowProjectPicker(false)}
        onSelect={handleProjectSelect}
        title={pickerAction === 'rfq' ? 'Request Quote' : 'Add to Project'}
        description={
          pickerAction === 'rfq'
            ? `Select a project to request a quote for ${selectedMaterial?.name || 'this material'}`
            : `Select a project to add ${selectedMaterial?.name || 'this material'} to`
        }
      />

      {comparisonOpen && (
        <div className="comparison-overlay" onClick={() => setComparisonOpen(false)}>
          <div className="comparison-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comparison-header">
              <div>
                <h3>Price Comparison</h3>
                <p>{selectedMaterial?.name}</p>
              </div>
              <button className="close-btn" onClick={() => setComparisonOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {comparisonLoading ? (
              <div className="comparison-loading">
                <div className="spinner" />
                <span>Loading supplier prices...</span>
              </div>
            ) : (
              <div className="comparison-list">
                {comparisonRows.length === 0 ? (
                  <p className="no-prices">No supplier prices available yet.</p>
                ) : (
                  comparisonRows.map((row, idx) => (
                    <div key={`${row.supplierName}-${idx}`} className="comparison-row">
                      <div>
                        <span className="supplier-name">{row.supplierName}</span>
                        <span className="supplier-location">{row.location || 'Location TBD'}</span>
                        <span className={`source-badge ${row.source}`}>
                          {row.source === 'scraped' ? 'Live' : 'Static'}
                        </span>
                      </div>
                      <div className="comparison-price">
                        <span>
                          <PriceDisplay priceUsd={row.priceUsd} priceZwg={row.priceZwg} />
                        </span>
                        <span className="last-updated">
                          {formatLastUpdated(row.lastUpdated)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {materialCompareOpen && selectedMaterial && (
        <div className="comparison-overlay" onClick={() => setMaterialCompareOpen(false)}>
          <div className="material-compare-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comparison-header">
              <div>
                <h3>Compare Materials</h3>
                <p>See specifications side by side.</p>
              </div>
              <button className="close-btn" onClick={() => setMaterialCompareOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {alternativeMaterials.length === 0 ? (
              <p className="muted">No comparable materials available.</p>
            ) : (
              <>
                <div className="compare-select">
                  <label htmlFor="compareTarget">Compare with</label>
                  <select
                    id="compareTarget"
                    value={compareTargetId || ''}
                    onChange={(e) => setCompareTargetId(e.target.value)}
                  >
                    {alternativeMaterials.map((material) => (
                      <option key={material.id} value={material.id}>{material.name}</option>
                    ))}
                  </select>
                </div>

                {compareTarget && (
                  <div className="compare-table">
                    <div className="compare-row header">
                      <span />
                      <span>{selectedMaterial.name}</span>
                      <span>{compareTarget.name}</span>
                    </div>
                    <div className="compare-row">
                      <span className="label">Category</span>
                      <span>{selectedMaterial.subcategory}</span>
                      <span>{compareTarget.subcategory}</span>
                    </div>
                    <div className="compare-row">
                      <span className="label">Unit</span>
                      <span>{selectedMaterial.unit}</span>
                      <span>{compareTarget.unit}</span>
                    </div>
                    <div className="compare-row">
                      <span className="label">Specs</span>
                      <span>{selectedMaterial.specifications || '—'}</span>
                      <span>{compareTarget.specifications || '—'}</span>
                    </div>
                    <div className="compare-row">
                      <span className="label">Price</span>
                      <span>
                        {livePrices.get(selectedMaterial.id) ? (
                          <PriceDisplay
                            priceUsd={livePrices.get(selectedMaterial.id)!.priceUsd}
                            priceZwg={livePrices.get(selectedMaterial.id)!.priceZwg}
                          />
                        ) : '—'}
                      </span>
                      <span>
                        {livePrices.get(compareTarget.id) ? (
                          <PriceDisplay
                            priceUsd={livePrices.get(compareTarget.id)!.priceUsd}
                            priceZwg={livePrices.get(compareTarget.id)!.priceZwg}
                          />
                        ) : '—'}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .marketplace {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          max-width: var(--container-max);
          margin: 0 auto;
          padding: var(--space-8) var(--container-padding);
          font-family: var(--font-body);
        }

        .search-section {
          display: flex;
          gap: var(--space-4);
          align-items: center;
          flex-wrap: wrap;
        }

        .search-box {
          flex: 1;
          max-width: 500px;
        }

        .filter-actions {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .dir-link {
          text-decoration: none;
        }

        .category-section {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .category-pill {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-2) var(--space-4);
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-full);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
        }

        .category-pill:hover {
          border-color: var(--color-accent);
        }

        .category-pill.active {
          background: rgba(46, 108, 246, 0.12);
          border-color: var(--color-accent);
          color: var(--color-accent);
          font-weight: var(--font-semibold);
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: var(--space-6);
          min-height: 600px;
        }

        .loading-banner {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: rgba(46, 108, 246, 0.08);
          border-radius: var(--radius-md);
          color: var(--color-accent);
          font-size: var(--text-sm);
          margin-bottom: var(--space-4);
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(46, 108, 246, 0.3);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .materials-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .category-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .category-title {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          color: var(--color-primary);
          margin: 0;
          font-family: var(--font-heading);
        }

        .category-title .count {
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          color: var(--color-text-muted);
          background: var(--color-mist);
          padding: 2px 8px;
          border-radius: var(--radius-full);
        }

        .materials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: var(--space-4);
        }

        .material-card-wrapper {
          height: 100%;
        }

        .material-card.card {
          cursor: pointer;
          transition: all var(--duration-normal) var(--ease-out);
          border-radius: var(--card-radius);
          border: 1px solid var(--color-border-light);
          box-shadow: var(--shadow-card);
          background: var(--color-surface);
        }

        .material-card.card:hover {
          border-color: var(--color-accent);
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .material-card.card.selected {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px rgba(46, 108, 246, 0.2);
        }

        .material-header {
          margin-bottom: var(--space-1);
        }

        .material-name {
          display: block;
          font-weight: var(--font-semibold);
          color: var(--color-text);
          font-size: var(--text-sm);
        }

        .material-subcategory {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .material-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-1);
        }

        .unit {
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
        }

        .price {
          font-weight: var(--font-semibold);
          color: var(--color-accent);
        }

        .price-meta {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
          flex-wrap: wrap;
        }

        .supplier-count {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .source-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .source-badge.scraped {
          background: rgba(22, 163, 74, 0.12);
          color: var(--color-emerald);
        }

        .source-badge.static {
          background: var(--color-mist);
          color: var(--color-text-secondary);
        }

        .last-updated {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .alert-indicator {
          color: var(--color-amber);
        }

        .specs {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin: 0;
        }

        .detail-panel {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .detail-card.card {
          position: sticky;
          top: var(--space-6);
          border: 1px solid var(--color-border-light);
          border-radius: var(--card-radius);
          box-shadow: var(--shadow-card);
          background: var(--color-surface);
        }

        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-4);
        }

        .alert-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-mist);
          border: none;
          border-radius: var(--radius-md);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--duration-fast);
        }

        .alert-btn:hover {
          background: var(--color-border-light);
        }

        .alert-btn.active {
          background: rgba(245, 158, 11, 0.15);
          color: var(--color-amber);
        }

        .detail-title {
          font-size: var(--text-h4);
          font-weight: var(--font-semibold);
          color: var(--color-primary);
          margin: 0 0 var(--space-1) 0;
          font-family: var(--font-heading);
        }

        .detail-subtitle {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          margin: 0;
        }

        .detail-specs {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          background: var(--color-mist);
          padding: var(--space-2);
          border-radius: var(--radius-md);
          margin: 0 0 var(--space-4) 0;
        }

        .detail-unit {
          display: flex;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }

        .detail-unit .label {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .detail-unit .value {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--color-text);
        }

        /* Live Price Card */
        .live-price-card {
          background: var(--color-background-alt);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          margin-bottom: var(--space-4);
        }

        .price-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .price-label {
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          font-weight: var(--font-semibold);
        }

        .price-value {
          font-size: var(--text-h3);
          font-weight: var(--font-bold);
          color: var(--color-primary);
        }

        .price-trend {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-3);
          padding-bottom: var(--space-3);
          border-bottom: 1px solid var(--color-border-light);
        }

        .trend-chart {
          flex-shrink: 0;
        }

        .trend-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .trend-badge.up { background: rgba(22, 163, 74, 0.12); color: var(--color-emerald); }
        .trend-badge.down { background: rgba(220, 38, 38, 0.12); color: var(--color-danger); }
        .trend-badge.stable { background: var(--color-mist); color: var(--color-text-secondary); }

        .dash {
          width: 8px;
          height: 2px;
          background: currentColor;
          border-radius: 2px;
        }

        .price-info-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .info-item {
          text-align: center;
        }

        .info-label {
          display: block;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          margin-bottom: 2px;
        }

        .info-value {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .info-value.source.scraped {
          color: var(--color-emerald);
        }

        .info-value.source.static {
          color: var(--color-text-secondary);
        }

        .supplier-info {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: var(--space-3);
          padding-top: var(--space-3);
          border-top: 1px solid var(--color-border-light);
          font-size: 0.8rem;
          color: var(--color-text-secondary);
        }

        .supplier-info .location {
          color: var(--color-text-muted);
        }

        .milestones-used {
          margin-bottom: var(--space-4);
        }

        .milestones-used .label {
          display: block;
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          margin-bottom: var(--space-1);
        }

        .milestone-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
        }

        .milestone-tag {
          font-size: var(--text-xs);
          text-transform: capitalize;
          background: var(--color-mist);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
        }

        .divider {
          border: none;
          border-top: 1px solid var(--color-border-light);
          margin: var(--space-4) 0;
        }

        .suppliers-title {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--color-text);
          margin: 0 0 var(--space-4) 0;
        }

        .price-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          margin-bottom: var(--space-6);
        }

        .price-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-2);
          background: var(--color-mist);
          border-radius: var(--radius-md);
        }

        .price-row.best {
          background: rgba(46, 108, 246, 0.12);
          border: 1px solid var(--color-accent);
        }

        .price-row .supplier-info {
          border: none;
          padding: 0;
          margin: 0;
          flex-direction: column;
          align-items: flex-start;
        }

        .supplier-name {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--color-text);
        }

        .trusted-badge {
          color: var(--color-emerald);
        }

        .supplier-location {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .price-info {
          text-align: right;
        }

        .supplier-price {
          font-weight: 600;
          color: var(--color-text);
        }

        .best-badge {
          display: block;
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-accent);
        }

        .no-prices {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          text-align: center;
          padding: var(--space-4);
        }

        .quantity-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }

        .action-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }

        .compare-btn {
          width: 100%;
          margin-bottom: var(--space-4);
        }

        .quantity-row label {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .quantity-input {
          display: flex;
          align-items: center;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--color-surface);
        }

        .qty-btn {
          width: 32px;
          height: 32px;
          background: var(--color-mist);
          border: none;
          font-size: 1rem;
          cursor: pointer;
          color: var(--color-text);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .qty-btn:hover:not(:disabled) {
          background: var(--color-border-light);
        }

        .qty-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quantity-input input {
          width: 60px;
          height: 32px;
          border: none;
          text-align: center;
          font-size: var(--text-sm);
          background: var(--color-surface);
          color: var(--color-text);
        }

        .quantity-input input:focus {
          outline: none;
        }

        .qty-unit {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .add-btn {
          width: 100%;
        }

        .quote-btn {
          width: 100%;
        }

        .alt-title {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--color-text);
          margin: 0 0 var(--space-2) 0;
        }

        .alt-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-1);
          margin-bottom: var(--space-4);
        }

        .alt-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-2);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border-light);
          background: var(--color-mist);
          cursor: pointer;
          text-align: left;
        }

        .alt-card:hover {
          border-color: var(--color-accent);
        }

        .alt-name {
          display: block;
          font-size: 0.85rem;
          font-weight: var(--font-semibold);
          color: var(--color-text);
        }

        .alt-sub {
          display: block;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .alt-price {
          font-size: 0.85rem;
          font-weight: var(--font-semibold);
          color: var(--color-accent);
        }

        .comparison-overlay {
          position: fixed;
          inset: 0;
          background: var(--color-surface-overlay);
          backdrop-filter: blur(3px);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
        }

        .comparison-modal {
          width: 100%;
          max-width: 560px;
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-xl);
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .material-compare-modal {
          width: 100%;
          max-width: 640px;
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-xl);
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .comparison-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
        }

        .close-btn {
          background: none;
          border: none;
          padding: 6px;
          border-radius: var(--radius-md);
          cursor: pointer;
          color: var(--color-text-muted);
        }

        .close-btn:hover {
          background: var(--color-mist);
          color: var(--color-text-secondary);
        }

        .comparison-header h3 {
          margin: 0;
          font-size: var(--text-h5);
          color: var(--color-text);
          font-family: var(--font-heading);
        }

        .comparison-header p {
          margin: 4px 0 0;
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .comparison-loading {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          color: var(--color-accent);
          font-size: var(--text-sm);
        }

        .comparison-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          max-height: 50vh;
          overflow-y: auto;
        }

        .comparison-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-3);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          background: var(--color-mist);
        }

        .comparison-price {
          text-align: right;
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: var(--text-sm);
          color: var(--color-text);
        }

        .comparison-row .supplier-name {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--color-text);
        }

        .comparison-row .supplier-location {
          display: block;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-bottom: 4px;
        }

        .compare-select {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .compare-select label {
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-text-muted);
        }

        .compare-select select {
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border-light);
          background: var(--color-surface);
          font-size: var(--text-sm);
        }

        .compare-table {
          display: grid;
          gap: var(--space-2);
        }

        .compare-row {
          display: grid;
          grid-template-columns: 120px 1fr 1fr;
          gap: var(--space-3);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border-light);
          background: var(--color-mist);
          align-items: center;
          font-size: var(--text-sm);
        }

        .compare-row.header {
          font-weight: var(--font-semibold);
          background: var(--color-surface);
        }

        .compare-row .label {
          color: var(--color-text-muted);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .muted {
          color: var(--color-text-muted);
          font-size: var(--text-sm);
        }

        .empty-detail {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
          padding: var(--space-8);
          color: var(--color-text-muted);
          text-align: center;
        }

        .suppliers-card {
          background: var(--color-primary);
        }

        .suppliers-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--color-accent);
          margin: 0 0 var(--space-4) 0;
        }

        .supplier-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .supplier-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .supplier-row .name {
          display: block;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--color-text-inverse);
        }

        .supplier-row .location {
          display: block;
          font-size: var(--text-xs);
          color: rgba(255, 255, 255, 0.6);
        }

        .rating {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-sm);
          color: var(--color-accent);
        }

        .empty-state {
          text-align: center;
          padding: var(--space-8);
          color: var(--color-text-muted);
        }

        .market-disclaimer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          padding: var(--space-4) var(--space-6);
          border: 1px solid var(--color-border-light);
          background: var(--color-mist);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .market-disclaimer p {
          margin: 0;
        }

        .quote-link {
          flex-shrink: 0;
        }

        @media (max-width: 1024px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .detail-panel {
            position: fixed;
            bottom: 0;
            left: 260px;
            right: 0;
            background: var(--color-surface);
            padding: var(--space-6);
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
            z-index: 100;
            max-height: 50vh;
            overflow-y: auto;
          }

          .suppliers-card {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .market-disclaimer {
            flex-direction: column;
            align-items: flex-start;
          }

          .detail-panel {
            left: 0;
          }

          .materials-grid {
            grid-template-columns: 1fr;
          }

          .action-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </MainLayout>
  );
}
