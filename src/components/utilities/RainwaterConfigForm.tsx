import React from 'react';
import {
    CloudRain,
    Funnel,
    Drop,
    Cylinder,
    HouseLine
} from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import {
    RainwaterConfig,
    RainwaterGutterType
} from '@/lib/database.types';

interface RainwaterConfigFormProps {
    config: RainwaterConfig;
    onChange: (config: RainwaterConfig) => void;
}

export default function RainwaterConfigForm({ config, onChange }: RainwaterConfigFormProps) {

    const updateConfig = (updates: Partial<RainwaterConfig>) => {
        onChange({ ...config, ...updates });
    };

    return (
        <div className="rainwater-form-container">
            {/* Roof Details Section */}
            <section className="form-section">
                <h3 className="section-title">Catchment Area</h3>
                <Input
                    label="Roof Area (m²)"
                    type="number"
                    value={config.roofAreaM2 || ''}
                    onChange={(e) => updateConfig({ roofAreaM2: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g. 150"
                    hint="Rough estimate of your roof's surface area"
                    icon={<HouseLine size={20} />}
                />
            </section>

            {/* Gutter Type Section */}
            <section className="form-section">
                <h3 className="section-title">Gutter System</h3>
                <div className="options-grid">
                    {(['pvc', 'galvanised'] as RainwaterGutterType[]).map(type => (
                        <Card
                            key={type}
                            className={`option-card ${config.gutterType === type ? 'selected' : ''}`}
                            onClick={() => updateConfig({ gutterType: type })}
                        >
                            <div className={`gutter-icon ${type}`} />
                            <span className="capitalize">{type}</span>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Storage Tank Section */}
            <section className="form-section">
                <h3 className="section-title">Storage Options</h3>
                <label className="options-label">Tank Size</label>
                <div className="options-grid three-col">
                    {(['2500', '5000', '10000']).map(size => (
                        <Card
                            key={size}
                            className={`option-card ${config.tankSizeLitres?.toString() === size ? 'selected' : ''}`}
                            onClick={() => updateConfig({ tankSizeLitres: parseInt(size) })}
                        >
                            <Cylinder size={24} />
                            <span>{size}L</span>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Filtering Options */}
            <section className="form-section">
                <h3 className="section-title">Filtration</h3>
                <div className="toggles-container">
                    <label className="toggle-card">
                        <div className="toggle-content">
                            <span className="toggle-title">First Flush Diverter</span>
                            <span className="toggle-desc">Removes initial dirty runoff from roof</span>
                        </div>
                        <input
                            type="checkbox"
                            className="toggle-switch"
                            checked={config.firstFlush || false}
                            onChange={(e) => updateConfig({ firstFlush: e.target.checked })}
                        />
                    </label>

                    <label className="toggle-card">
                        <div className="toggle-content">
                            <span className="toggle-title">Sand Filter</span>
                            <span className="toggle-desc">Improves water clarity and quality</span>
                        </div>
                        <input
                            type="checkbox"
                            className="toggle-switch"
                            checked={config.sandFilter || false}
                            onChange={(e) => updateConfig({ sandFilter: e.target.checked })}
                        />
                    </label>
                </div>
            </section>

            <style jsx>{`
        .rainwater-form-container {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
        }

        .section-title {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: var(--spacing-md);
          color: var(--color-text);
        }

        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-md);
        }

        .options-grid.three-col {
          grid-template-columns: 1fr 1fr 1fr;
        }

        :global(.option-card) {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          cursor: pointer;
          border: 2px solid transparent !important;
          transition: all 0.2s ease;
          text-align: center;
        }

        :global(.option-card:hover) {
          background: var(--color-background);
          border-color: var(--color-border) !important;
        }

        :global(.option-card.selected) {
          border-color: var(--color-accent) !important;
          background: rgba(6, 182, 212, 0.05);
          color: var(--color-text-primary);
        }

        .capitalize {
          text-transform: capitalize;
        }

        .gutter-icon {
            width: 40px;
            height: 20px;
            background: currentColor;
            border-radius: 0 0 20px 20px;
            margin-bottom: 8px;
            opacity: 0.8;
        }
        
        .gutter-icon.pvc { color: #64748B; }
        .gutter-icon.galvanised { color: #94A3B8; }

        .options-label {
            font-weight: 500;
            font-size: 0.9rem;
            color: var(--color-text);
            margin-bottom: var(--spacing-sm);
            display: block;
        }

        .toggles-container {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-md);
        }

        .toggle-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--spacing-md);
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .toggle-card:hover {
            border-color: var(--color-accent);
        }

        .toggle-content {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .toggle-title {
            font-weight: 500;
            color: var(--color-text);
        }

        .toggle-desc {
            font-size: 0.85rem;
            color: var(--color-text-muted);
        }

        .toggle-switch {
            width: 50px;
            height: 28px;
            -webkit-appearance: none;
            background: var(--color-border);
            border-radius: 20px;
            position: relative;
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }
        .toggle-switch:checked {
            background: var(--color-accent);
        }
        .toggle-switch::before {
            content: '';
            position: absolute;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: white;
            top: 2px;
            left: 2px;
            transition: all 0.2s ease;
        }
        .toggle-switch:checked::before {
            transform: translateX(22px);
        }
        
        @media (max-width: 640px) {
            .options-grid.three-col {
                grid-template-columns: 1fr;
            }
        }
      `}</style>
        </div>
    );
}
