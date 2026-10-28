'use client';

import Card from '@/components/ui/Card';
import { DEFAULT_ROOF_SHAPE, ROOF_COVERINGS, ROOF_SHAPES, type RoofCovering, type RoofShape } from '@/lib/calculations/roofingOptions';
import RoofProfileIcon from '@/components/ui/RoofProfileIcon';
import RoofShapeIcon from '@/components/ui/RoofShapeIcon';
import {
  ArrowLeft,
  ArrowRight,
  House,
  Wall,
  Package,
  Users,
  Check,
} from '@phosphor-icons/react';
import {
  VisionConfig,
  BrickType,
  CementType,
  ProjectScope,
  BRICK_INFO,
  CEMENT_INFO,
  SCOPE_INFO,
} from '@/lib/vision/types';
import type { OptionalExtra } from '@/hooks/useVisionTakeoff';

interface ConfigurationStepProps {
  config: VisionConfig;
  onUpdate: (config: Partial<VisionConfig>) => void;
  onConfirm: () => void;
  onBack: () => void;
  /** Optional extras with their prices; unticked ones are left out of the BOQ. */
  extras?: OptionalExtra[];
  onToggleExtra?: (id: string) => void;
}

export default function ConfigurationStep({
  config,
  onUpdate,
  onConfirm,
  onBack,
  extras = [],
  onToggleExtra,
}: ConfigurationStepProps) {
  const ticked = new Set(config.includeExtras ?? []);
  const leftOutUsd = extras.filter((extra) => !ticked.has(extra.id)).reduce((sum, extra) => sum + extra.usd, 0);
  const usd = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;
  const scopes: ProjectScope[] = ['full_house', 'substructure', 'superstructure', 'roofing', 'finishing', 'services', 'exterior'];
  const brickTypes: BrickType[] = ['common', 'farm', 'blocks_6inch', 'blocks_8inch', 'face_brick'];
  const cementTypes: CementType[] = ['cement_325', 'cement_425'];
  const selectedScopes = Array.isArray(config.scope) ? config.scope : [config.scope];
  const includedScopes: ProjectScope[] = selectedScopes.includes('full_house')
    ? ['substructure', 'superstructure', 'roofing', 'finishing', 'services', 'exterior']
    : selectedScopes;


  // Helper to check if a scope is selected
  const isScopeSelected = (scope: ProjectScope): boolean => {
    if (Array.isArray(config.scope)) {
      return config.scope.includes(scope);
    }
    return config.scope === scope;
  };

  // Helper to check if full_house is selected
  const isFullHouseSelected = isScopeSelected('full_house');

  // Handle scope toggle (multi-select)
  const handleScopeToggle = (scope: ProjectScope) => {
    // If selecting full_house, set it as the only selection
    if (scope === 'full_house') {
      onUpdate({ scope: 'full_house' });
      return;
    }

    // If full_house is currently selected and clicking another, switch to that one
    if (isFullHouseSelected) {
      onUpdate({ scope: scope });
      return;
    }

    // Multi-select for non-full_house options
    const currentScopes = Array.isArray(config.scope) ? config.scope : [config.scope];
    if (currentScopes.includes(scope)) {
      // Remove if already selected (but keep at least one)
      const newScopes = currentScopes.filter(s => s !== scope);
      onUpdate({ scope: newScopes.length > 0 ? newScopes : [scope] });
    } else {
      // Add to selection
      onUpdate({ scope: [...currentScopes.filter(s => s !== 'full_house'), scope] });
    }
  };

  // Helper to check if a brick type is selected
  const isBrickSelected = (brick: BrickType): boolean => {
    if (Array.isArray(config.brickType)) {
      return config.brickType.includes(brick);
    }
    return config.brickType === brick;
  };

  // Handle brick type toggle (multi-select)
  const handleBrickToggle = (brick: BrickType) => {
    const currentBricks = Array.isArray(config.brickType) ? config.brickType : [config.brickType];
    if (currentBricks.includes(brick)) {
      const newBricks = currentBricks.filter(b => b !== brick);
      onUpdate({ brickType: newBricks.length > 0 ? newBricks : [brick] });
    } else {
      onUpdate({ brickType: [...currentBricks, brick] });
    }
  };

  // Helper to check if a cement type is selected
  const isCementSelected = (cement: CementType): boolean => {
    if (Array.isArray(config.cementType)) {
      return config.cementType.includes(cement);
    }
    return config.cementType === cement;
  };

  // Handle cement type toggle (multi-select)
  const handleCementToggle = (cement: CementType) => {
    const currentCements = Array.isArray(config.cementType) ? config.cementType : [config.cementType];
    if (currentCements.includes(cement)) {
      const newCements = currentCements.filter(c => c !== cement);
      onUpdate({ cementType: newCements.length > 0 ? newCements : [cement] });
    } else {
      onUpdate({ cementType: [...currentCements, cement] });
    }
  };

  return (
    <div className="config-step">
      <div className="step-header">
        <h1>Configure Estimate</h1>
        <p>Select materials and scope for your reviewed floor plan</p>
      </div>

      <div className="config-sections">
        {/* Scope Selection */}
        <div id="vision-scope-selection" style={{ scrollMarginTop: 120 }}>
          <Card>
          <div className="section-header">
            <House size={22} weight="light" />
            <div>
              <h3>Project Scope</h3>
              <p>What part of construction do you want to estimate?</p>
            </div>
          </div>

          <div className="option-grid scope-grid">
            {scopes.map((scope) => {
              const isSelected = isScopeSelected(scope);
              const isDisabled = scope !== 'full_house' && isFullHouseSelected;
              return (
                <button
                  key={scope}
                  className={`option-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                  onClick={() => !isDisabled && handleScopeToggle(scope)}
                  disabled={isDisabled}
                >
                  <div className="option-check">
                    {isSelected && <Check size={16} weight="bold" />}
                  </div>
                  <span className="option-name">{SCOPE_INFO[scope].name}</span>
                  <span className="option-desc">{SCOPE_INFO[scope].description}</span>
                  {scope === 'full_house' && (
                    <span className="option-hint">Selects all stages</span>
                  )}
                </button>
              );
            })}
          </div>
          {!isFullHouseSelected && (
            <p className="multi-select-hint">Select multiple stages or choose Full House for complete estimate</p>
          )}
          </Card>
        </div>

        {/* Brick Type Selection */}
        <Card>
          <div className="section-header">
            <Wall size={22} weight="light" />
            <div>
              <h3>Wall Material</h3>
              <p>Select the brick or block type for walls</p>
            </div>
          </div>

          <div className="option-grid brick-grid">
            {brickTypes.map((brick) => {
              const isSelected = isBrickSelected(brick);
              return (
                <button
                  key={brick}
                  className={`option-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleBrickToggle(brick)}
                >
                  <div className="option-check">
                    {isSelected && <Check size={16} weight="bold" />}
                  </div>
                  <span className="option-name">{BRICK_INFO[brick].name}</span>
                  <span className="option-desc">{BRICK_INFO[brick].description}</span>
                  <span className="option-meta">{BRICK_INFO[brick].bricksPerSqm} per m²</span>
                </button>
              );
            })}
          </div>
          <p className="multi-select-hint">Select multiple wall materials if using different types for different areas</p>
        </Card>

        {/* Cement Type Selection */}
        <Card>
          <div className="section-header">
            <Package size={22} weight="light" />
            <div>
              <h3>Cement Type</h3>
              <p>Select cement grade for mortar and concrete</p>
            </div>
          </div>

          <div className="option-grid cement-grid">
            {cementTypes.map((cement) => {
              const isSelected = isCementSelected(cement);
              return (
                <button
                  key={cement}
                  className={`option-card horizontal ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleCementToggle(cement)}
                >
                  <div className="option-check">
                    {isSelected && <Check size={16} weight="bold" />}
                  </div>
                  <div className="option-content">
                    <span className="option-name">{CEMENT_INFO[cement].name}</span>
                    <span className="option-desc">{CEMENT_INFO[cement].description}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="multi-select-hint">Select both cement types if using different grades for different purposes</p>
        </Card>

        {includedScopes.includes('roofing') && <Card>
          <div className="section-header"><House size={22} weight="light" /><div><h3>Roof</h3><p>Choose the shape and the covering to cost</p></div></div>
          <div className="mb-3 grid gap-2 sm:grid-cols-3" role="group" aria-label="Roof shape">
            {(Object.entries(ROOF_SHAPES) as [RoofShape, (typeof ROOF_SHAPES)[RoofShape]][]).map(([id, option]) => (
              <button key={id} type="button" onClick={() => onUpdate({ roofShape: id })}
                aria-pressed={(config.roofShape || DEFAULT_ROOF_SHAPE) === id}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left ${(config.roofShape || DEFAULT_ROOF_SHAPE) === id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                <RoofShapeIcon shape={id} className="mt-0.5 h-6 w-12 shrink-0 text-slate-700" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                  <span className="mt-1 block text-xs text-slate-600">{option.description}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Roof covering">
            {(Object.entries(ROOF_COVERINGS) as [RoofCovering, (typeof ROOF_COVERINGS)[RoofCovering]][]).map(([id, option]) => (
              <button key={id} type="button" onClick={() => onUpdate({ roofCovering: id })}
                aria-pressed={(config.roofCovering || 'ibr_05') === id}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left ${(config.roofCovering || 'ibr_05') === id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                <RoofProfileIcon covering={id} className="mt-0.5 h-6 w-12 shrink-0 text-slate-700" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                  <span className="mt-1 block text-xs text-slate-600">{option.description}</span>
                </span>
              </button>
            ))}
          </div>
          {config.roofCovering === 'concrete_tile' && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Concrete tiles need a roof structure designed for their weight. Confirm timber sizes, spacing, fixings and ridge pieces with a local roof designer and supplier.</p>}
        </Card>}

        {/* Labor Toggle */}
        <Card>
          <div className="section-header">
            <Users size={22} weight="light" />
            <div>
              <h3>Include Labor</h3>
              <p>Add estimated labor costs to the BOQ</p>
            </div>
          </div>

          <div className="labor-toggle">
            <button
              className={`toggle-btn ${config.includeLabor ? 'selected' : ''}`}
              onClick={() => onUpdate({ includeLabor: true })}
            >
              <div className="option-check">
                {config.includeLabor && <Check size={16} weight="bold" />}
              </div>
              <span>Materials + Labor</span>
              <span className="toggle-desc">Full project cost including workers</span>
            </button>

            <button
              className={`toggle-btn ${!config.includeLabor ? 'selected' : ''}`}
              onClick={() => onUpdate({ includeLabor: false })}
            >
              <div className="option-check">
                {!config.includeLabor && <Check size={16} weight="bold" />}
              </div>
              <span>Materials Only</span>
              <span className="toggle-desc">Just building materials cost</span>
            </button>
          </div>
        </Card>
        {extras.length > 0 && onToggleExtra && <Card>
          <div className="section-header">
            <Package size={22} weight="light" />
            <div>
              <h3>Already on your site, or for later?</h3>
              <p>Plans often show a water tank, site toilet or kitchen you may already have, or will add later. Tick only what you want priced now{config.includeLabor ? ', labour included' : ''}.</p>
            </div>
          </div>
          {(['site', 'house'] as const).map((group) => {
            const rows = extras.filter((extra) => extra.group === group);
            if (rows.length === 0) return null;
            return (
              <div key={group} className="extras-group">
                <p className="extras-heading">{group === 'site' ? 'Site setup' : 'Extras in the house plan'}</p>
                {rows.map((extra) => (
                  <label key={extra.id} className="extra-row">
                    <input type="checkbox" checked={ticked.has(extra.id)} onChange={() => onToggleExtra(extra.id)} />
                    <span className="extra-text">
                      <strong>{extra.label}</strong>
                      <small>{extra.why}</small>
                    </span>
                    <span className="extra-price">{usd(extra.usd)}</span>
                  </label>
                ))}
              </div>
            );
          })}
          <p className="extras-total">{leftOutUsd > 0 ? `Left out of this BOQ: ${usd(leftOutUsd)}. You can still add any of it later.` : 'Everything is included.'}</p>
        </Card>}
        {config.includeLabor && <Card>
          <div className="section-header"><Users size={22} weight="light" /><div><h3>Labour by trade</h3><p>Priced the way builders quote: per m² of floor for building, plastering and roofing, per m² tiled, per metre of boundary wall; plumbing, electrical, painting and paving as a share of their materials. Change any rate in the BOQ.</p></div></div>
        </Card>}
      </div>

      <div className="form-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={18} weight="bold" />
          Back
        </button>

        <button className="btn btn-primary" onClick={onConfirm}>
          Generate BOQ
          <ArrowRight size={18} weight="bold" />
        </button>
      </div>

      <style jsx>{`
        .extras-group { margin-top: 12px; }
        .extras-heading { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; margin: 0 0 6px; }
        .extra-row { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; min-height: 44px; padding: 10px 0; border-bottom: 1px solid #e2e8f0; cursor: pointer; }
        .extra-row input { width: 20px; height: 20px; accent-color: #2e6cf6; }
        .extra-text { display: grid; gap: 2px; min-width: 0; }
        .extra-text strong { font-size: 0.9rem; color: var(--color-text); }
        .extra-text small { font-size: 0.76rem; color: #64748b; line-height: 1.35; }
        .extra-price { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--color-primary); }
        .extras-total { margin: 12px 0 0; font-size: 0.82rem; font-weight: 600; color: #475569; }
        .config-step {
          max-width: 800px;
          margin: 0 auto;
        }

        .step-header {
          text-align: center;
          margin-bottom: var(--spacing-xl);
        }

        .step-header h1 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .step-header p {
          font-size: 1rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .config-sections {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-md);
          color: var(--color-accent);
        }

        .section-header h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }

        .section-header p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .option-grid {
          display: grid;
          gap: var(--spacing-sm);
        }

        .scope-grid {
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }

        .brick-grid {
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        }

        .cement-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .option-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-xs);
          padding: var(--spacing-md);
          background: #ffffff;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .option-card.horizontal {
          flex-direction: row;
          align-items: center;
        }

        .option-card.horizontal .option-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .option-card:hover {
          border-color: var(--color-accent);
        }

        .option-card.selected {
          border-color: var(--color-accent);
          background: rgba(78, 154, 247, 0.12);
        }

        .option-check {
          position: absolute;
          top: var(--spacing-sm);
          right: var(--spacing-sm);
          width: 20px;
          height: 20px;
          border-radius: var(--radius-full);
          border: 2px solid var(--color-border-light);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .option-card.selected .option-check {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: white;
        }

        .option-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
        }

        .option-desc {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          line-height: 1.4;
        }

        .option-meta {
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-accent);
          margin-top: auto;
        }

        .option-hint {
          font-size: 0.625rem;
          color: var(--color-primary);
          font-weight: 500;
        }

        .option-card.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }

        .multi-select-hint {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin: var(--spacing-sm) 0 0 0;
          font-style: italic;
        }

        .labor-toggle {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-sm);
        }

        .toggle-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-xs);
          padding: var(--spacing-md);
          background: rgba(6, 20, 47, 0.02);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .toggle-btn:hover {
          border-color: var(--color-accent);
        }

        .toggle-btn.selected {
          border-color: var(--color-accent);
          background: rgba(78, 154, 247, 0.12);
        }

        .toggle-btn span:first-of-type {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
        }

        .toggle-desc {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .form-actions {
          display: flex;
          justify-content: space-between;
          gap: var(--spacing-md);
          margin-top: var(--spacing-xl);
        }

        .btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-lg);
          border-radius: var(--radius-md);
          font-size: 0.9375rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-primary {
          background: var(--color-primary);
          color: var(--color-text-inverse);
        }

        .btn-primary:hover {
          background: var(--color-primary-dark);
        }

        .btn-primary:disabled {
          cursor: not-allowed;
          opacity: 0.5;
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

        @media (max-width: 640px) {
          .cement-grid,
          .labor-toggle {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
