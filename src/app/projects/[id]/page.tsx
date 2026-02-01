'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardHeader, CardTitle, CardContent, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressRing, { ProgressBar } from '@/components/ui/ProgressRing';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  Cube,
  Wall,
  HouseSimple,
  PaintBrush,
  ShieldCheck,
  Plus,
  PencilSimple,
  ShareNetwork,
  Export,
  CaretDown,
  CaretUp,
  Check,
  X,
} from '@phosphor-icons/react';

// Milestone configuration
const milestoneConfig = [
  { type: 'substructure', label: 'Substructure', icon: Cube, description: 'Foundation, footings, DPC' },
  { type: 'superstructure', label: 'Superstructure', icon: Wall, description: 'Walls, lintels, ring beams' },
  { type: 'roofing', label: 'Roofing', icon: HouseSimple, description: 'Trusses, sheeting, fascia' },
  { type: 'finishing', label: 'Finishing', icon: PaintBrush, description: 'Plaster, paint, tiles, fixtures' },
  { type: 'exterior', label: 'Exterior & Security', icon: ShieldCheck, description: 'Boundary walls, gates, durawall' },
];

// Milestone type definition
interface Milestone {
  type: string;
  calculatedProgress: number;
  manualOverride: boolean;
  overrideValue: number | null;
}

// Sample project data
const projectData = {
  id: 'proj-1',
  name: 'Borrowdale 4-Bed House',
  location: 'Harare, Zimbabwe',
  status: 'active',
  budgetUsd: 45000,
  budgetZwg: 1350000,
  spentUsd: 28500,
  spentZwg: 855000,
  milestones: [
    { type: 'substructure', calculatedProgress: 100, manualOverride: false, overrideValue: null },
    { type: 'superstructure', calculatedProgress: 65, manualOverride: false, overrideValue: null },
    { type: 'roofing', calculatedProgress: 30, manualOverride: false, overrideValue: null },
    { type: 'finishing', calculatedProgress: 0, manualOverride: false, overrideValue: null },
    { type: 'exterior', calculatedProgress: 0, manualOverride: false, overrideValue: null },
  ] as Milestone[],
  estimateItems: [
    { milestone: 'substructure', material: 'Common Cement Brick', quantity: 15000, unit: 'bricks', priceUsd: 1125, priceZwg: 33750 },
    { milestone: 'substructure', material: 'River Sand (Concrete)', quantity: 20, unit: 'cubes', priceUsd: 900, priceZwg: 27000 },
    { milestone: 'substructure', material: 'Standard Cement 32.5N', quantity: 150, unit: 'bags', priceUsd: 1500, priceZwg: 45000 },
    { milestone: 'superstructure', material: 'Common Cement Brick', quantity: 25000, unit: 'bricks', priceUsd: 1875, priceZwg: 56250 },
    { milestone: 'superstructure', material: 'Pit Sand (Plastering)', quantity: 15, unit: 'cubes', priceUsd: 525, priceZwg: 15750 },
    { milestone: 'roofing', material: 'IBR Roofing Sheets', quantity: 45, unit: 'sheets', priceUsd: 2250, priceZwg: 67500 },
  ],
};

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
  const { formatPrice } = useCurrency();
  return <>{formatPrice(priceUsd, priceZwg)}</>;
}

interface MilestoneCardProps {
  config: typeof milestoneConfig[0];
  milestone: typeof projectData.milestones[0];
  items: typeof projectData.estimateItems;
  onProgressUpdate: (type: string, value: number, isManual: boolean) => void;
}

function MilestoneCard({ config, milestone, items, onProgressUpdate }: MilestoneCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(milestone.calculatedProgress);

  const IconComponent = config.icon;
  const progress = milestone.manualOverride ? milestone.overrideValue! : milestone.calculatedProgress;
  const milestoneItems = items.filter((item) => item.milestone === config.type);
  const totalUsd = milestoneItems.reduce((sum, item) => sum + item.priceUsd, 0);
  const totalZwg = milestoneItems.reduce((sum, item) => sum + item.priceZwg, 0);

  const handleSaveProgress = () => {
    onProgressUpdate(config.type, editValue, true);
    setEditing(false);
  };

  return (
    <Card className="milestone-card">
      <div className="milestone-header" onClick={() => setExpanded(!expanded)}>
        <div className="milestone-icon">
          <IconComponent size={24} weight="light" />
        </div>
        <div className="milestone-info">
          <h4>{config.label}</h4>
          <p>{config.description}</p>
        </div>
        <div className="milestone-progress">
          <ProgressRing progress={progress} size={56} color={progress === 100 ? 'success' : 'accent'} />
        </div>
        <button className="expand-btn">
          {expanded ? <CaretUp size={20} /> : <CaretDown size={20} />}
        </button>
      </div>

      {expanded && (
        <div className="milestone-content">
          {/* Progress Override */}
          <div className="progress-override">
            <div className="override-header">
              <span>Progress Tracking</span>
              {!editing ? (
                <Button size="sm" variant="ghost" icon={<PencilSimple size={14} />} onClick={() => setEditing(true)}>
                  Override
                </Button>
              ) : (
                <div className="edit-actions">
                  <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => setEditing(false)} />
                  <Button size="sm" variant="primary" icon={<Check size={14} />} onClick={handleSaveProgress} />
                </div>
              )}
            </div>
            {editing ? (
              <div className="progress-edit">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editValue}
                  onChange={(e) => setEditValue(Number(e.target.value))}
                />
                <span className="edit-value">{editValue}%</span>
              </div>
            ) : (
              <div className="progress-status">
                <ProgressBar progress={progress} showLabel />
                {milestone.manualOverride && <CardBadge>Manual Override</CardBadge>}
              </div>
            )}
          </div>

          {/* Materials List */}
          <div className="materials-list">
            <div className="materials-header">
              <span>Materials ({milestoneItems.length})</span>
              <Button size="sm" variant="secondary" icon={<Plus size={14} />}>
                Add Material
              </Button>
            </div>
            {milestoneItems.length > 0 ? (
              <table className="materials-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Quantity</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {milestoneItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.material}</td>
                      <td>{item.quantity.toLocaleString()} {item.unit}</td>
                      <td><PriceDisplay priceUsd={item.priceUsd} priceZwg={item.priceZwg} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Subtotal</td>
                    <td><PriceDisplay priceUsd={totalUsd} priceZwg={totalZwg} /></td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="no-materials">No materials added yet</p>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .milestone-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          cursor: pointer;
          padding: var(--spacing-xs);
          margin: calc(-1 * var(--spacing-xs));
          border-radius: var(--radius-md);
        }

        .milestone-header:hover {
          background: var(--color-background);
        }

        .milestone-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          background: var(--color-background);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
        }

        .milestone-info {
          flex: 1;
        }

        .milestone-info h4 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 2px 0;
        }

        .milestone-info p {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .expand-btn {
          background: none;
          border: none;
          padding: var(--spacing-sm);
          cursor: pointer;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
        }

        .milestone-content {
          margin-top: var(--spacing-lg);
          padding-top: var(--spacing-lg);
          border-top: 1px solid var(--color-border-light);
        }

        .progress-override {
          margin-bottom: var(--spacing-lg);
        }

        .override-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-sm);
          font-size: 0.875rem;
          font-weight: 500;
        }

        .edit-actions {
          display: flex;
          gap: var(--spacing-xs);
        }

        .progress-edit {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .progress-edit input[type="range"] {
          flex: 1;
          accent-color: var(--color-accent);
        }

        .edit-value {
          font-weight: 600;
          min-width: 3rem;
        }

        .progress-status {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .materials-list {
          background: var(--color-background);
          border-radius: var(--radius-md);
          padding: var(--spacing-md);
        }

        .materials-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-md);
          font-size: 0.875rem;
          font-weight: 500;
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
        }

        .materials-table tfoot td {
          font-weight: 600;
          border-bottom: none;
        }

        .no-materials {
          text-align: center;
          color: var(--color-text-muted);
          padding: var(--spacing-lg);
          margin: 0;
        }
      `}</style>
    </Card>
  );
}

export default function ProjectDetail() {
  const _params = useParams();
  const [milestones, setMilestones] = useState(projectData.milestones);

  const overallProgress = milestones.reduce((sum, m) => {
    const p = m.manualOverride ? m.overrideValue! : m.calculatedProgress;
    return sum + p;
  }, 0) / milestones.length;

  const handleProgressUpdate = (type: string, value: number, isManual: boolean) => {
    setMilestones((prev) =>
      prev.map((m) =>
        m.type === type
          ? { ...m, manualOverride: isManual, overrideValue: isManual ? value : null }
          : m
      )
    );
  };

  return (
    <MainLayout title={projectData.name}>
      <div className="project-detail">
        {/* Project Header */}
        <div className="project-header">
          <div className="project-meta">
            <CardBadge variant="success">{projectData.status}</CardBadge>
            <span className="location">{projectData.location}</span>
          </div>
          <div className="header-actions">
            <Button variant="secondary" icon={<ShareNetwork size={18} />}>
              Share
            </Button>
            <Button variant="secondary" icon={<Export size={18} />}>
              Export PDF
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="stats-grid">
          <Card variant="dashboard">
            <CardHeader>
              <CardTitle>Total Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="stat-value">
                <PriceDisplay priceUsd={projectData.budgetUsd} priceZwg={projectData.budgetZwg} />
              </p>
            </CardContent>
          </Card>

          <Card variant="dashboard">
            <CardHeader>
              <CardTitle>Spent to Date</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="stat-value">
                <PriceDisplay priceUsd={projectData.spentUsd} priceZwg={projectData.spentZwg} />
              </p>
              <ProgressBar progress={(projectData.spentUsd / projectData.budgetUsd) * 100} />
            </CardContent>
          </Card>

          <Card variant="dashboard">
            <CardHeader>
              <CardTitle>Overall Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="progress-display">
                <ProgressRing progress={overallProgress} size={64} />
                <span className="progress-text">{Math.round(overallProgress)}% Complete</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Milestones */}
        <section className="milestones-section">
          <h3>Construction Milestones</h3>
          <div className="milestones-list">
            {milestoneConfig.map((config) => {
              const milestone = milestones.find((m) => m.type === config.type)!;
              return (
                <MilestoneCard
                  key={config.type}
                  config={config}
                  milestone={milestone}
                  items={projectData.estimateItems}
                  onProgressUpdate={handleProgressUpdate}
                />
              );
            })}
          </div>
        </section>
      </div>

      <style jsx>{`
        .project-detail {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
        }

        .project-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .project-meta {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .location {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
        }

        .header-actions {
          display: flex;
          gap: var(--spacing-sm);
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
          margin: 0 0 var(--spacing-sm) 0;
        }

        .progress-display {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .progress-text {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .milestones-section h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-lg) 0;
        }

        .milestones-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </MainLayout>
  );
}
