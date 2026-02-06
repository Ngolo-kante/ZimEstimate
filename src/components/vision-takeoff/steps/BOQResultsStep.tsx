'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import SavingOverlay from '@/components/ui/SavingOverlay';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useAuth } from '@/components/providers/AuthProvider';
import { createProject, saveProjectWithItems } from '@/lib/services/projects';
import {
  ArrowLeft,
  DownloadSimple,
  WhatsappLogo,
  FloppyDisk,
  ArrowsClockwise,
  Trash,
  PencilSimple,
  Check,
  X,
  CaretDown,
  CaretRight,
  CircleNotch,
} from '@phosphor-icons/react';
import { GeneratedBOQItem, ProjectInfo, VisionConfig, normalizeConfigToArrays } from '@/lib/vision/types';
import { exportBOQToPDF } from '@/lib/pdf-export';

interface BOQResultsStepProps {
  items: GeneratedBOQItem[];
  totals: { usd: number; zwg: number };
  projectInfo: ProjectInfo;
  totalArea: number;
  config: VisionConfig;
  onItemUpdate: (itemId: string, updates: Partial<GeneratedBOQItem>) => void;
  onItemRemove: (itemId: string) => void;
  onBack: () => void;
  onStartOver: () => void;
}

interface EditingState {
  itemId: string | null;
  field: 'quantity' | 'unitPriceUsd' | null;
  value: string;
}

export default function BOQResultsStep({
  items,
  totals,
  projectInfo,
  totalArea,
  config,
  onItemUpdate,
  onItemRemove,
  onBack,
  onStartOver,
}: BOQResultsStepProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { currency, formatPrice } = useCurrency();
  const [editingState, setEditingState] = useState<EditingState>({ itemId: null, field: null, value: '' });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveMessage, setSaveMessage] = useState('Creating your project...');
  const [saveSteps, setSaveSteps] = useState<Array<{ label: string; status: 'pending' | 'active' | 'done' }>>([]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, GeneratedBOQItem[]> = {};
    items.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [items]);

  const categories = Object.keys(groupedItems);

  // Expand all categories by default
  useState(() => {
    setExpandedCategories(new Set(categories));
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const startEditing = (itemId: string, field: 'quantity' | 'unitPriceUsd', currentValue: number) => {
    setEditingState({ itemId, field, value: currentValue.toString() });
  };

  const cancelEditing = () => {
    setEditingState({ itemId: null, field: null, value: '' });
  };

  const saveEditing = () => {
    if (!editingState.itemId || !editingState.field) return;

    const numValue = parseFloat(editingState.value);
    if (isNaN(numValue) || numValue < 0) {
      cancelEditing();
      return;
    }

    if (editingState.field === 'quantity') {
      onItemUpdate(editingState.itemId, { quantity: numValue });
    } else if (editingState.field === 'unitPriceUsd') {
      // Update both USD and ZWG (using 30:1 rate)
      onItemUpdate(editingState.itemId, {
        unitPriceUsd: numValue,
        unitPriceZwg: numValue * 30,
      });
    }

    cancelEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEditing();
    if (e.key === 'Escape') cancelEditing();
  };

  const handleExportPDF = () => {
    const boqData = {
      projectName: projectInfo.name || 'Vision Takeoff Project',
      location: projectInfo.location,
      totalArea,
      items: items.map((item) => ({
        material_name: item.materialName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        unit_price_usd: item.unitPriceUsd,
        unit_price_zwg: item.unitPriceZwg,
      })),
      totals,
      config,
    };

    exportBOQToPDF(boqData);
  };

  const handleWhatsAppShare = () => {
    const summary = `*${projectInfo.name || 'Vision Takeoff BOQ'}*\n` +
      `Location: ${projectInfo.location || 'Not specified'}\n` +
      `Floor Area: ${totalArea.toFixed(0)}m²\n\n` +
      `*Total Estimate:*\n` +
      `USD: $${totals.usd.toLocaleString()}\n` +
      `ZWG: $${totals.zwg.toLocaleString()}\n\n` +
      `Generated with ZimEstimate`;

    const encodedText = encodeURIComponent(summary);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const handleSave = async () => {
    if (isAuthenticated) {
      // Save project to database
      setIsSaving(true);
      setSaveError(null);
      setSaveMessage('Creating your project...');
      setSaveSteps([
        { label: 'Creating project', status: 'active' },
        { label: 'Saving materials', status: 'pending' },
        { label: 'Finalizing', status: 'pending' },
      ]);

      try {
        const { scopes } = normalizeConfigToArrays(config);
        const hasFullHouse = scopes.includes('full_house');
        const selectedStages = scopes.filter(scope => scope !== 'full_house');
        const projectScope = hasFullHouse || selectedStages.length !== 1
          ? 'entire_house'
          : selectedStages[0];

        // Create project
        const { project, error: createError } = await createProject({
          name: projectInfo.name || 'Vision Takeoff Project',
          location: projectInfo.location,
          scope: projectScope,
          labor_preference: config.includeLabor ? 'with_labor' : 'materials_only',
          selected_stages: !hasFullHouse && selectedStages.length > 0 ? selectedStages : null,
        });

        if (createError || !project) {
          throw createError || new Error('Failed to create project');
        }

        setSaveMessage('Saving materials...');
        setSaveSteps(prev => prev.map((step, index) => {
          if (index === 0) return { ...step, status: 'done' };
          if (index === 1) return { ...step, status: 'active' };
          return step;
        }));

        // Convert items to database format
        const boqItems = items.map((item, index) => ({
          material_id: item.id,
          material_name: item.materialName,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          unit_price_usd: item.unitPriceUsd,
          unit_price_zwg: item.unitPriceZwg,
          notes: item.calculationNote,
          sort_order: index,
        }));

        // Save BOQ items
        const { error: saveError } = await saveProjectWithItems(
          project.id,
          { status: 'active' },
          boqItems
        );

        if (saveError) {
          throw saveError;
        }

        setSaveSteps(prev => prev.map((step, index) => {
          if (index <= 1) return { ...step, status: 'done' };
          if (index === 2) return { ...step, status: 'active' };
          return step;
        }));

        // Show success state briefly
        setSaveSuccess(true);
        setSaveMessage('Project saved!');
        setSaveSteps(prev => prev.map(step => ({ ...step, status: 'done' })));

        // Wait a moment to show success, then redirect
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Redirect to projects page
        router.push('/projects?refresh=1');
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save project');
        setIsSaving(false);
      }
    } else {
      // Show login prompt for unauthenticated users
      setShowSavePrompt(true);
    }
  };

  return (
    <div className="boq-results">
      <div className="results-header">
        <div className="header-content">
          <h1>{projectInfo.name || 'Vision Takeoff Results'}</h1>
          {projectInfo.location && <p className="location">{projectInfo.location}</p>}
          <p className="meta">{totalArea.toFixed(0)}m² floor area</p>
        </div>

        <div className="header-actions">
          <button className="btn btn-icon" onClick={handleExportPDF} title="Download PDF">
            <DownloadSimple size={20} weight="light" />
          </button>
          <button className="btn btn-icon" onClick={handleWhatsAppShare} title="Share via WhatsApp">
            <WhatsappLogo size={20} weight="light" />
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <CircleNotch size={18} className="spinning" />
            ) : (
              <FloppyDisk size={18} weight="light" />
            )}
            {isAuthenticated ? 'Save & View Projects' : 'Save Project'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {saveError && (
        <div className="save-error">
          {saveError}
        </div>
      )}

      {/* Totals Summary */}
      <Card className="totals-card">
        <div className="totals-grid">
          <div className="total-item">
            <span className="total-label">Materials</span>
            <span className="total-value">
              {formatPrice(totals.usd * (config.includeLabor ? 0.7 : 1), totals.zwg * (config.includeLabor ? 0.7 : 1))}
            </span>
          </div>
          {config.includeLabor && (
            <div className="total-item">
              <span className="total-label">Labor</span>
              <span className="total-value">
                {formatPrice(totals.usd * 0.3, totals.zwg * 0.3)}
              </span>
            </div>
          )}
          <div className="total-item grand">
            <span className="total-label">Grand Total</span>
            <span className="total-value">{formatPrice(totals.usd, totals.zwg)}</span>
          </div>
        </div>
      </Card>

      {/* BOQ Table */}
      <Card className="boq-table-card">
        <div className="table-container">
          {categories.map((category) => (
            <div key={category} className="category-section">
              <button
                className="category-header"
                onClick={() => toggleCategory(category)}
              >
                {expandedCategories.has(category) ? (
                  <CaretDown size={18} weight="bold" />
                ) : (
                  <CaretRight size={18} weight="bold" />
                )}
                <span className="category-name">{category}</span>
                <span className="category-count">{groupedItems[category].length} items</span>
              </button>

              {expandedCategories.has(category) && (
                <table className="boq-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th className="col-qty">Qty</th>
                      <th className="col-unit">Unit</th>
                      <th className="col-price">Unit Price</th>
                      <th className="col-total">Total</th>
                      <th className="col-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedItems[category].map((item) => (
                      <tr key={item.id} className={item.isEdited ? 'edited' : ''}>
                        <td>
                          <div className="material-cell">
                            <span className="material-name">{item.materialName}</span>
                            {item.calculationNote && (
                              <span className="calc-note">{item.calculationNote}</span>
                            )}
                          </div>
                        </td>
                        <td className="col-qty">
                          {editingState.itemId === item.id && editingState.field === 'quantity' ? (
                            <div className="edit-cell">
                              <input
                                type="number"
                                value={editingState.value}
                                onChange={(e) => setEditingState({ ...editingState, value: e.target.value })}
                                onKeyDown={handleKeyDown}
                                autoFocus
                              />
                              <button onClick={saveEditing} className="edit-action save">
                                <Check size={14} weight="bold" />
                              </button>
                              <button onClick={cancelEditing} className="edit-action cancel">
                                <X size={14} weight="bold" />
                              </button>
                            </div>
                          ) : (
                            <span
                              className="editable"
                              onClick={() => startEditing(item.id, 'quantity', item.quantity)}
                            >
                              {item.quantity.toLocaleString()}
                              <PencilSimple size={12} className="edit-icon" />
                            </span>
                          )}
                        </td>
                        <td className="col-unit">{item.unit}</td>
                        <td className="col-price">
                          {editingState.itemId === item.id && editingState.field === 'unitPriceUsd' ? (
                            <div className="edit-cell">
                              <input
                                type="number"
                                step="0.01"
                                value={editingState.value}
                                onChange={(e) => setEditingState({ ...editingState, value: e.target.value })}
                                onKeyDown={handleKeyDown}
                                autoFocus
                              />
                              <button onClick={saveEditing} className="edit-action save">
                                <Check size={14} weight="bold" />
                              </button>
                              <button onClick={cancelEditing} className="edit-action cancel">
                                <X size={14} weight="bold" />
                              </button>
                            </div>
                          ) : (
                            <span
                              className="editable"
                              onClick={() => startEditing(item.id, 'unitPriceUsd', item.unitPriceUsd)}
                            >
                              {formatPrice(item.unitPriceUsd, item.unitPriceZwg)}
                              <PencilSimple size={12} className="edit-icon" />
                            </span>
                          )}
                        </td>
                        <td className="col-total">
                          {formatPrice(item.totalUsd, item.totalZwg)}
                        </td>
                        <td className="col-actions">
                          <button
                            className="remove-btn"
                            onClick={() => onItemRemove(item.id)}
                            title="Remove item"
                          >
                            <Trash size={16} weight="light" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Footer Actions */}
      <div className="footer-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={18} weight="bold" />
          Back to Configuration
        </button>

        <button className="btn btn-ghost" onClick={onStartOver}>
          <ArrowsClockwise size={18} weight="light" />
          Start Over
        </button>
      </div>

      {/* Saving Overlay */}
      <SavingOverlay
        isVisible={isSaving}
        message={saveMessage}
        success={saveSuccess}
        steps={saveSteps}
      />

      {/* Save Prompt Modal */}
      {showSavePrompt && (
        <div className="modal-overlay" onClick={() => setShowSavePrompt(false)}>
          <div className="save-modal" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="modal-icon">
              <FloppyDisk size={32} weight="light" />
            </div>
            <h3>Save to Your Projects</h3>
            <p>Sign in or create an account to save this BOQ and access it anytime from your dashboard.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowSavePrompt(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => window.location.href = '/auth/login?redirect=/ai/vision-takeoff'}
              >
                Sign In
              </button>
              <button
                className="btn btn-accent"
                onClick={() => window.location.href = '/auth/register?redirect=/ai/vision-takeoff'}
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .boq-results {
          max-width: 1000px;
          margin: 0 auto;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-lg);
          gap: var(--spacing-lg);
        }

        .header-content h1 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .location {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .meta {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin: var(--spacing-xs) 0 0;
        }

        .header-actions {
          display: flex;
          gap: var(--spacing-sm);
        }

        .btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-icon {
          padding: var(--spacing-sm);
          background: rgba(6, 20, 47, 0.02);
          border: 1px solid var(--color-border-light);
          color: var(--color-text-secondary);
        }

        .btn-icon:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .btn-primary {
          background: var(--color-primary);
          color: var(--color-text-inverse);
        }

        .btn-primary:hover {
          background: var(--color-primary-dark);
        }

        .btn-secondary {
          background: rgba(6, 20, 47, 0.02);
          border: 1px solid var(--color-border-light);
          color: var(--color-text-secondary);
        }

        .btn-secondary:hover {
          border-color: var(--color-text-muted);
          color: var(--color-text);
        }

        .btn-ghost {
          background: transparent;
          color: var(--color-text-muted);
        }

        .btn-ghost:hover {
          color: var(--color-text);
          background: rgba(6, 20, 47, 0.04);
        }

        .totals-card {
          margin-bottom: var(--spacing-lg);
        }

        .totals-grid {
          display: flex;
          gap: var(--spacing-xl);
          align-items: center;
        }

        .total-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .total-item.grand {
          margin-left: auto;
          padding-left: var(--spacing-xl);
          border-left: 1px solid var(--color-border-light);
        }

        .total-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
        }

        .total-value {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .total-item.grand .total-value {
          font-size: 1.5rem;
          color: var(--color-accent);
        }

        .boq-table-card {
          margin-bottom: var(--spacing-lg);
        }

        .table-container {
          overflow-x: auto;
        }

        .category-section {
          border-bottom: 1px solid var(--color-border-light);
        }

        .category-section:last-child {
          border-bottom: none;
        }

        .category-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          background: rgba(6, 20, 47, 0.02);
          border: none;
          cursor: pointer;
          text-align: left;
        }

        .category-header:hover {
          background: var(--color-surface);
        }

        .category-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text);
          flex: 1;
        }

        .category-count {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .boq-table {
          width: 100%;
          border-collapse: collapse;
        }

        .boq-table th,
        .boq-table td {
          padding: var(--spacing-sm) var(--spacing-md);
          text-align: left;
          font-size: 0.875rem;
        }

        .boq-table th {
          font-weight: 500;
          color: var(--color-text-muted);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--color-border-light);
        }

        .boq-table td {
          color: var(--color-text);
          border-bottom: 1px solid var(--color-border-light);
        }

        .boq-table tr:last-child td {
          border-bottom: none;
        }

        .boq-table tr.edited {
          background: rgba(78, 154, 247, 0.12);
        }

        .col-qty,
        .col-unit,
        .col-price,
        .col-total {
          text-align: right;
          white-space: nowrap;
        }

        .col-actions {
          width: 40px;
          text-align: center;
        }

        .material-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .material-name {
          font-weight: 500;
        }

        .calc-note {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .editable {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          cursor: pointer;
          padding: 2px 4px;
          margin: -2px -4px;
          border-radius: var(--radius-sm);
        }

        .editable:hover {
          background: rgba(6, 20, 47, 0.04);
        }

        .editable .edit-icon {
          opacity: 0;
          color: var(--color-text-muted);
        }

        .editable:hover .edit-icon {
          opacity: 1;
        }

        .edit-cell {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .edit-cell input {
          width: 80px;
          padding: 4px 8px;
          border: 1px solid var(--color-accent);
          border-radius: var(--radius-sm);
          font-size: 0.875rem;
          text-align: right;
        }

        .edit-action {
          width: 24px;
          height: 24px;
          border: none;
          border-radius: var(--radius-sm);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .edit-action.save {
          background: var(--color-success);
          color: white;
        }

        .edit-action.cancel {
          background: var(--color-error);
          color: white;
        }

        .remove-btn {
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          cursor: pointer;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .remove-btn:hover {
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .footer-actions {
          display: flex;
          justify-content: space-between;
        }

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

        .save-modal {
          background: white;
          border-radius: var(--radius-lg);
          padding: var(--spacing-xl);
          max-width: 420px;
          width: 90%;
          text-align: center;
          box-shadow: 0 24px 50px rgba(6, 20, 47, 0.24);
          animation: modalSlideUp 0.3s ease;
        }

        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto var(--spacing-md);
          background: rgba(78, 154, 247, 0.12);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent);
          border: 1px solid rgba(78, 154, 247, 0.2);
        }

        .save-modal h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .save-modal p {
          font-size: 0.9375rem;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-lg) 0;
          line-height: 1.5;
        }

        .modal-actions {
          display: flex;
          gap: var(--spacing-sm);
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn-accent {
          background: var(--color-accent);
          color: white;
        }

        .btn-accent:hover {
          background: var(--color-accent-dark);
        }

        .save-error {
          background: rgba(239, 68, 68, 0.1);
          color: var(--color-error);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-lg);
          font-size: 0.875rem;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .results-header {
            flex-direction: column;
          }

          .totals-grid {
            flex-direction: column;
            align-items: flex-start;
          }

          .total-item.grand {
            margin-left: 0;
            padding-left: 0;
            padding-top: var(--spacing-md);
            border-left: none;
            border-top: 1px solid var(--color-border-light);
            width: 100%;
          }

          .footer-actions {
            flex-direction: column;
            gap: var(--spacing-sm);
          }
        }
      `}</style>
    </div>
  );
}
