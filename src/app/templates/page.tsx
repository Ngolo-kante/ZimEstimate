'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardBadge } from '@/components/ui/Card';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  HouseSimple,
  ArrowRight,
  Cube,
} from '@phosphor-icons/react';

type TemplateCategory = 'all' | 'residential' | 'commercial' | 'exterior';

// Template data
const templates = [
  {
    id: 'tpl-3bed-standard',
    name: '3-Bedroom House (Standard)',
    description: 'Common cement bricks, IBR roofing, basic finishes',
    icon: HouseSimple,
    category: 'residential',
    popularity: 'Most Popular',
    estimatedCostUsd: 28000,
    estimatedCostZwg: 840000,
    bedrooms: 3,
    bathrooms: 2,
    sqm: 120,
  },
  {
    id: 'tpl-4bed-standard',
    name: '4-Bedroom House (Standard)',
    description: 'Common cement bricks, IBR roofing, standard finishes',
    icon: HouseSimple,
    category: 'residential',
    estimatedCostUsd: 38000,
    estimatedCostZwg: 1140000,
    bedrooms: 4,
    bathrooms: 2,
    sqm: 160,
  },
  {
    id: 'tpl-4bed-premium',
    name: '4-Bedroom House (Premium)',
    description: 'Face bricks, tiles roofing, premium finishes',
    icon: HouseSimple,
    category: 'residential',
    popularity: 'Premium',
    estimatedCostUsd: 65000,
    estimatedCostZwg: 1950000,
    bedrooms: 4,
    bathrooms: 3,
    sqm: 200,
  },
  {
    id: 'tpl-5bed-executive',
    name: '5-Bedroom Executive House',
    description: 'Face bricks, Harvey tiles, high-end finishes, double garage',
    icon: HouseSimple,
    category: 'residential',
    estimatedCostUsd: 95000,
    estimatedCostZwg: 2850000,
    bedrooms: 5,
    bathrooms: 4,
    sqm: 280,
  },
  {
    id: 'tpl-cottage',
    name: 'Staff / Rental Cottage',
    description: '1-bed cottage with kitchenette and bathroom',
    icon: HouseSimple,
    category: 'residential',
    estimatedCostUsd: 12000,
    estimatedCostZwg: 360000,
    bedrooms: 1,
    bathrooms: 1,
    sqm: 35,
  },
  {
    id: 'tpl-durawall',
    name: 'Durawall Boundary (per 100m)',
    description: 'Standard 2.4m durawall with 2 gates',
    icon: Cube,
    category: 'exterior',
    estimatedCostUsd: 8500,
    estimatedCostZwg: 255000,
    sqm: 240,
  },
];

const categories = [
  { id: 'all', label: 'All Templates' },
  { id: 'residential', label: 'Residential' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'exterior', label: 'Exterior' },
];

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
  const { formatPrice } = useCurrency();
  return <>{formatPrice(priceUsd, priceZwg)}</>;
}

export default function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') {
      return templates;
    }
    return templates.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <MainLayout title="BOQ Templates">
      <div className="templates-page">
        {/* Intro */}
        <div className="intro">
          <p>Start with a pre-built Bill of Quantities based on common Zimbabwean house types. Customize materials and quantities to match your project.</p>
        </div>

        {/* Categories */}
        <div className="categories">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id as TemplateCategory)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="templates-grid">
          {filteredTemplates.map((template) => {
            const IconComponent = template.icon;
            return (
              <Link key={template.id} href={`/boq/new?template=${template.id}`} className="template-link">
                <Card className="template-card">
                  <div className="template-header">
                    <div className="template-icon">
                      <IconComponent size={28} weight="light" />
                    </div>
                    {template.popularity && (
                      <CardBadge variant={template.popularity === 'Premium' ? 'accent' : 'success'}>
                        {template.popularity}
                      </CardBadge>
                    )}
                  </div>

                  <h3>{template.name}</h3>
                  <p className="template-desc">{template.description}</p>

                  <div className="template-specs">
                    {template.bedrooms && <span>{template.bedrooms} Bed</span>}
                    {template.bathrooms && <span>{template.bathrooms} Bath</span>}
                    <span>{template.sqm} m²</span>
                  </div>

                  <div className="template-footer">
                    <div className="template-price">
                      <span className="price-label">Est. Cost</span>
                      <span className="price-value">
                        <PriceDisplay priceUsd={template.estimatedCostUsd} priceZwg={template.estimatedCostZwg} />
                      </span>
                    </div>
                    <ArrowRight size={20} className="arrow-icon" />
                  </div>
                </Card>
              </Link>
            );
          })}

          {filteredTemplates.length === 0 && (
            <div className="empty-state">
              <Cube size={48} weight="light" />
              <p>No templates available in this category yet.</p>
            </div>
          )}
        </div>

        <p className="disclaimer">
          Estimates are based on 2026 Harare material prices. Actual costs will vary based on location, supplier, and specifications.
        </p>
      </div>

      <style jsx>{`
        .templates-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .intro p {
          font-size: 1rem;
          color: var(--color-text-secondary);
          max-width: 600px;
          margin: 0;
        }

        .categories {
          display: flex;
          gap: var(--spacing-sm);
        }

        .category-btn {
          padding: var(--spacing-xs) var(--spacing-md);
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-full);
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .category-btn:hover {
          border-color: var(--color-accent);
        }

        .category-btn.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: var(--color-text-inverse);
        }

        .templates-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-lg);
        }

        .template-link {
          text-decoration: none;
          color: inherit;
        }

        .template-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-md);
        }

        .template-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          background: var(--color-background);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent);
        }

        .template-card h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .template-desc {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-md) 0;
          line-height: 1.5;
        }

        .template-specs {
          display: flex;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-lg);
        }

        .template-specs span {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          padding: 2px 8px;
          background: var(--color-background);
          border-radius: var(--radius-sm);
        }

        .template-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--color-border-light);
        }

        .price-label {
          display: block;
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
        }

        .price-value {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .arrow-icon {
          color: var(--color-text-muted);
        }

        .empty-state {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-2xl);
          color: var(--color-text-muted);
          text-align: center;
          gap: var(--spacing-md);
        }

        .empty-state p {
          margin: 0;
        }

        .disclaimer {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          text-align: center;
          margin: 0;
        }

        @media (max-width: 1024px) {
          .templates-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .templates-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </MainLayout>
  );
}
