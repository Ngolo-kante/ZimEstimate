import React from 'react';
import {
    Drop,
    Waves,
    Cylinder
} from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import {
    WaterConfig,
    WaterSource,
    PumpType,
    TankSizeLitres
} from '@/lib/database.types';

interface WaterConfigFormProps {
    config: WaterConfig;
    onChange: (config: WaterConfig) => void;
}

export default function WaterConfigForm({ config, onChange }: WaterConfigFormProps) {

    const updateConfig = (updates: Partial<WaterConfig>) => {
        onChange({ ...config, ...updates });
    };

    return (
        <div className="water-form-container">
            {/* Water Source Section */}
            <section className="form-section">
                <h3 className="section-title">Water Source</h3>
                <div className="options-grid three-col">
                    {(['municipal', 'borehole', 'borehole_tanks'] as WaterSource[]).map(source => (
                        <Card
                            key={source}
                            className={`option-card ${config.source === source ? 'selected' : ''}`}
                            onClick={() => updateConfig({ source })}
                        >
                            <Waves size={24} />
                            <span className="capitalize">{source.replace('_', ' + ')}</span>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Borehole Configuration (if applicable) */}
            {(config.source === 'borehole' || config.source === 'borehole_tanks') && (
                <section className="form-section reveal-section">
                    <h3 className="section-title">Borehole Details</h3>

                    <div className="field-group">
                        <label className="toggle-label">
                            <span>Does the borehole already exist?</span>
                            <input
                                type="checkbox"
                                className="toggle-switch"
                                checked={config.boreholeExists || false}
                                onChange={(e) => updateConfig({ boreholeExists: e.target.checked })}
                            />
                        </label>

                        {!config.boreholeExists && (
                            <div className="input-row">
                                <Input
                                    label="Estimated Depth (meters)"
                                    type="number"
                                    value={config.boreholeDepthM || ''}
                                    onChange={(e) => updateConfig({ boreholeDepthM: parseInt(e.target.value) || 0 })}
                                    placeholder="e.g. 40"
                                />
                            </div>
                        )}

                        <div className="pump-selector">
                            <span className="label">Pump Type</span>
                            <div className="options-grid">
                                {(['submersible', 'surface'] as PumpType[]).map(pump => (
                                    <Card
                                        key={pump}
                                        className={`option-card ${config.pumpType === pump ? 'selected' : ''}`}
                                        onClick={() => updateConfig({ pumpType: pump })}
                                    >
                                        <Drop size={24} />
                                        <span className="capitalize">{pump} Pump</span>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Tank Configuration */}
            <section className="form-section">
                <h3 className="section-title">Storage Tanks</h3>

                <div className="tank-controls">
                    <div className="counter-control">
                        <label>Number of Tanks</label>
                        <div className="counter">
                            <button
                                type="button"
                                onClick={() => updateConfig({ tankCount: Math.max(0, (config.tankCount || 0) - 1) })}
                            >
                                -
                            </button>
                            <span>{config.tankCount || 0}</span>
                            <button
                                type="button"
                                onClick={() => updateConfig({ tankCount: (config.tankCount || 0) + 1 })}
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {(config.tankCount || 0) > 0 && (
                        <>
                            <label className="options-label">Tank Size</label>
                            <div className="options-grid three-col">
                                {(['2500', '5000', '10000']).map(size => (
                                    <Card
                                        key={size}
                                        className={`option-card ${config.tankSizeLitres?.toString() === size ? 'selected' : ''}`}
                                        onClick={() => updateConfig({ tankSizeLitres: parseInt(size) as TankSizeLitres })}
                                    >
                                        <Cylinder size={24} />
                                        <span>{size}L</span>
                                    </Card>
                                ))}
                            </div>

                            <label className="toggle-label">
                                <span>Require Tank Stand?</span>
                                <input
                                    type="checkbox"
                                    className="toggle-switch"
                                    checked={config.tankStandRequired || false}
                                    onChange={(e) => updateConfig({ tankStandRequired: e.target.checked })}
                                />
                            </label>
                        </>
                    )}
                </div>
            </section>

            <style jsx>{`
        .water-form-container {
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
          background: rgba(59, 130, 246, 0.05); /* Blue tint */
          color: var(--color-info);
        }

        .capitalize {
          text-transform: capitalize;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .toggle-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
        }

        .counter-control {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-sm);
        }

        .counter {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
        }

        .counter button {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 1px solid var(--color-border);
            background: var(--color-surface);
            font-size: 1.25rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        
        .counter button:hover {
            border-color: var(--color-accent);
            color: var(--color-accent);
        }

        .counter span {
            font-size: 1.25rem;
            font-weight: 600;
            min-width: 40px;
            text-align: center;
        }
        
        .tank-controls {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-lg);
        }

        .options-label {
            font-weight: 500;
            font-size: 0.9rem;
            color: var(--color-text);
            margin-bottom: var(--spacing-sm);
            display: block;
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
