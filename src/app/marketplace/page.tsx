'use client';

import { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ProjectPickerModal from '@/components/ui/ProjectPickerModal';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useToast } from '@/components/ui/Toast';
import { Project } from '@/lib/database.types';
import { addBOQItem, updateProject, getProject } from '@/lib/services/projects';
import {
  MagnifyingGlass,
  Star,
  ShieldCheck,
  MapPin,
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
} from '@phosphor-icons/react';
import {
  materials,
  getPricesForMaterial,
  getBestPrice,
  searchMaterials,
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

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'all'>('all');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const { success, error: showError } = useToast();

  const handleAddToProject = async (project: Project) => {
    if (!selectedMaterial) return;

    const bestPrice = getBestPrice(selectedMaterial.id);
    if (!bestPrice) {
      showError('No pricing available for this material');
      return;
    }

    setIsAdding(true);

    // Add the BOQ item to the project
    const { error } = await addBOQItem({
      project_id: project.id,
      material_id: selectedMaterial.id,
      material_name: selectedMaterial.name,
      category: selectedMaterial.category,
      quantity: quantity,
      unit: selectedMaterial.unit,
      unit_price_usd: bestPrice.priceUsd,
      unit_price_zwg: bestPrice.priceZwg,
      sort_order: 0,
    });

    if (error) {
      showError('Failed to add material to project. Please try again.');
      setIsAdding(false);
      return;
    }

    // Update the project totals
    const { project: currentProject } = await getProject(project.id);
    if (currentProject) {
      const itemTotalUsd = bestPrice.priceUsd * quantity;
      const itemTotalZwg = bestPrice.priceZwg * quantity;
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

  // Filter materials
  const filteredMaterials = useMemo(() => {
    let result = materials;

    if (searchQuery) {
      result = searchMaterials(searchQuery);
    }

    if (selectedCategory !== 'all') {
      result = result.filter((m) => m.category === selectedCategory);
    }

    return result;
  }, [searchQuery, selectedCategory]);

  // Group materials by category for display
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

  const categories = Object.keys(categoryInfo) as MaterialCategory[];

  return (
    <MainLayout title="Marketplace">
      <div className="marketplace">
        {/* Search and Filters */}
        <div className="search-section">
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
          </div>
        </div>

        {/* Category Pills */}
        <div className="category-section">
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
            {Object.entries(groupedMaterials).map(([category, items]) => (
              <div key={category} className="category-group">
                <h3 className="category-title">
                  {categoryInfo[category as MaterialCategory]?.label || category}
                  <span className="count">{items.length}</span>
                </h3>
                <div className="materials-grid">
                  {items.map((material) => {
                    const bestPrice = getBestPrice(material.id);
                    return (
                      <Card
                        key={material.id}
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
                            {bestPrice && (
                              <span className="price">
                                <PriceDisplay priceUsd={bestPrice.priceUsd} priceZwg={bestPrice.priceZwg} />
                              </span>
                            )}
                          </div>
                          {material.specifications && (
                            <p className="specs">{material.specifications}</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredMaterials.length === 0 && (
              <div className="empty-state">
                <p>No materials found matching your search.</p>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div className="detail-panel">
            {selectedMaterial ? (
              <Card className="detail-card">
                <CardContent>
                  <h2 className="detail-title">{selectedMaterial.name}</h2>
                  <p className="detail-subtitle">{selectedMaterial.subcategory}</p>

                  {selectedMaterial.specifications && (
                    <p className="detail-specs">{selectedMaterial.specifications}</p>
                  )}

                  <div className="detail-unit">
                    <span className="label">Unit:</span>
                    <span className="value">{selectedMaterial.unit}</span>
                  </div>

                  <div className="milestones-used">
                    <span className="label">Used in:</span>
                    <div className="milestone-tags">
                      {selectedMaterial.milestones.map((m) => (
                        <span key={m} className="milestone-tag">{m}</span>
                      ))}
                    </div>
                  </div>

                  <hr className="divider" />

                  <h3 className="suppliers-title">Supplier Prices</h3>
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

                  <Button
                    icon={<Plus size={16} />}
                    className="add-btn"
                    onClick={() => setShowProjectPicker(true)}
                    disabled={isAdding}
                  >
                    {isAdding ? 'Adding...' : 'Add to Estimate'}
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
      </div>

      {/* Project Picker Modal */}
      <ProjectPickerModal
        isOpen={showProjectPicker}
        onClose={() => setShowProjectPicker(false)}
        onSelect={handleAddToProject}
        title="Add to Project"
        description={`Select a project to add ${selectedMaterial?.name || 'this material'} to`}
      />

      <style jsx>{`
        .marketplace {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .search-section {
          display: flex;
          gap: var(--spacing-md);
          align-items: center;
        }

        .search-box {
          flex: 1;
          max-width: 500px;
        }

        .filter-actions {
          display: flex;
          gap: var(--spacing-sm);
        }

        .category-section {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
        }

        .category-pill {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-md);
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-full);
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .category-pill:hover {
          border-color: var(--color-accent);
        }

        .category-pill.active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: var(--color-primary);
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: var(--spacing-lg);
          min-height: 600px;
        }

        .materials-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .category-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .category-title {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }

        .category-title .count {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-text-muted);
          background: var(--color-background);
          padding: 2px 8px;
          border-radius: var(--radius-full);
        }

        .materials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: var(--spacing-md);
        }

        .material-card {
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .material-card:hover {
          border-color: var(--color-accent);
        }

        .material-card.selected {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px rgba(252, 163, 17, 0.2);
        }

        .material-header {
          margin-bottom: var(--spacing-xs);
        }

        .material-name {
          display: block;
          font-weight: 600;
          color: var(--color-text);
          font-size: 0.9375rem;
        }

        .material-subcategory {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .material-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-xs);
        }

        .unit {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .price {
          font-weight: 600;
          color: var(--color-accent);
        }

        .specs {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin: 0;
        }

        .detail-panel {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .detail-card {
          position: sticky;
          top: var(--spacing-lg);
        }

        .detail-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .detail-subtitle {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-md) 0;
        }

        .detail-specs {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          background: var(--color-background);
          padding: var(--spacing-sm);
          border-radius: var(--radius-md);
          margin: 0 0 var(--spacing-md) 0;
        }

        .detail-unit {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-sm);
        }

        .detail-unit .label {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .detail-unit .value {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
        }

        .milestones-used {
          margin-bottom: var(--spacing-md);
        }

        .milestones-used .label {
          display: block;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin-bottom: var(--spacing-xs);
        }

        .milestone-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-xs);
        }

        .milestone-tag {
          font-size: 0.75rem;
          text-transform: capitalize;
          background: var(--color-background);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
        }

        .divider {
          border: none;
          border-top: 1px solid var(--color-border-light);
          margin: var(--spacing-md) 0;
        }

        .suppliers-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-md) 0;
        }

        .price-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-lg);
        }

        .price-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-sm);
          background: var(--color-background);
          border-radius: var(--radius-md);
        }

        .price-row.best {
          background: rgba(252, 163, 17, 0.1);
          border: 1px solid var(--color-accent);
        }

        .supplier-name {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
        }

        .trusted-badge {
          color: var(--color-success);
        }

        .supplier-location {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
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
          font-size: 0.875rem;
          color: var(--color-text-muted);
          text-align: center;
          padding: var(--spacing-md);
        }

        .quantity-row {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-md);
        }

        .quantity-row label {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .quantity-input {
          display: flex;
          align-items: center;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .qty-btn {
          width: 32px;
          height: 32px;
          background: var(--color-background);
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
          font-size: 0.875rem;
          background: var(--color-surface);
          color: var(--color-text);
        }

        .quantity-input input:focus {
          outline: none;
        }

        .qty-unit {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .add-btn {
          width: 100%;
        }

        .empty-detail {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-md);
          padding: var(--spacing-xl);
          color: var(--color-text-muted);
          text-align: center;
        }

        .suppliers-card {
          background: var(--color-primary);
        }

        .suppliers-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-accent);
          margin: 0 0 var(--spacing-md) 0;
        }

        .supplier-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .supplier-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .supplier-row .name {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-inverse);
        }

        .supplier-row .location {
          display: block;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .rating {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.875rem;
          color: var(--color-accent);
        }

        .empty-state {
          text-align: center;
          padding: var(--spacing-xl);
          color: var(--color-text-muted);
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
            padding: var(--spacing-lg);
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
            z-index: 100;
            max-height: 50vh;
            overflow-y: auto;
          }

          .suppliers-card {
            display: none;
          }
        }
      `}</style>
    </MainLayout>
  );
}
