'use client';

import Card from '@/components/ui/Card';
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

interface ConfigurationStepProps {
  config: VisionConfig;
  totalArea: number;
  onUpdate: (config: Partial<VisionConfig>) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export default function ConfigurationStep({
  config,
  totalArea,
  onUpdate,
  onConfirm,
  onBack,
}: ConfigurationStepProps) {
  const scopes: ProjectScope[] = ['full_house', 'substructure', 'superstructure', 'roofing', 'finishing'];
  const brickTypes: BrickType[] = ['common', 'farm', 'blocks_6inch', 'blocks_8inch', 'face_brick'];
  const cementTypes: CementType[] = ['cement_325', 'cement_425'];

  return (
    <div className="config-step">
      <div className="step-header">
        <h1>Configure Estimate</h1>
        <p>Select materials and scope for your {totalArea.toFixed(0)}m² floor plan</p>
      </div>

      <div className="config-sections">
        {/* Scope Selection */}
        <Card>
          <div className="section-header">
            <House size={22} weight="light" />
            <div>
              <h3>Project Scope</h3>
              <p>What part of construction do you want to estimate?</p>
            </div>
          </div>

          <div className="option-grid scope-grid">
            {scopes.map((scope) => (
              <button
                key={scope}
                className={`option-card ${config.scope === scope ? 'selected' : ''}`}
                onClick={() => onUpdate({ scope })}
              >
                <div className="option-check">
                  {config.scope === scope && <Check size={16} weight="bold" />}
                </div>
                <span className="option-name">{SCOPE_INFO[scope].name}</span>
                <span className="option-desc">{SCOPE_INFO[scope].description}</span>
              </button>
            ))}
          </div>
        </Card>

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
            {brickTypes.map((brick) => (
              <button
                key={brick}
                className={`option-card ${config.brickType === brick ? 'selected' : ''}`}
                onClick={() => onUpdate({ brickType: brick })}
              >
                <div className="option-check">
                  {config.brickType === brick && <Check size={16} weight="bold" />}
                </div>
                <span className="option-name">{BRICK_INFO[brick].name}</span>
                <span className="option-desc">{BRICK_INFO[brick].description}</span>
                <span className="option-meta">{BRICK_INFO[brick].bricksPerSqm} per m²</span>
              </button>
            ))}
          </div>
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
            {cementTypes.map((cement) => (
              <button
                key={cement}
                className={`option-card horizontal ${config.cementType === cement ? 'selected' : ''}`}
                onClick={() => onUpdate({ cementType: cement })}
              >
                <div className="option-check">
                  {config.cementType === cement && <Check size={16} weight="bold" />}
                </div>
                <div className="option-content">
                  <span className="option-name">{CEMENT_INFO[cement].name}</span>
                  <span className="option-desc">{CEMENT_INFO[cement].description}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

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
          background: var(--color-background);
          border: 2px solid var(--color-border-light);
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
          background: var(--color-accent-bg);
        }

        .option-check {
          position: absolute;
          top: var(--spacing-sm);
          right: var(--spacing-sm);
          width: 20px;
          height: 20px;
          border-radius: var(--radius-full);
          border: 2px solid var(--color-border);
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
          background: var(--color-background);
          border: 2px solid var(--color-border-light);
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
          background: var(--color-accent-bg);
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

        .btn-secondary {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
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
