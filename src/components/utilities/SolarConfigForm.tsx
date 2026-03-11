import React from 'react';
import {
    Sun,
    Lightning,
    BatteryHigh,
    HouseLine,
    WifiHigh,
    WifiSlash
} from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import { useSolarPreview } from '@/hooks/useSolarPreview';
import {
    SolarConfig,
    SolarSystemType,
    SolarDailyUsage,
    SolarAppliance,
    SolarRoofType
} from '@/lib/database.types';

interface SolarConfigFormProps {
    config: SolarConfig;
    onChange: (config: SolarConfig) => void;
}

export default function SolarConfigForm({ config, onChange }: SolarConfigFormProps) {
    const preview = useSolarPreview(config);

    const updateConfig = (updates: Partial<SolarConfig>) => {
        onChange({ ...config, ...updates });
    };

    const toggleAppliance = (appliance: SolarAppliance) => {
        const current = config.appliances || [];
        const newAppliances = current.includes(appliance)
            ? current.filter(a => a !== appliance)
            : [...current, appliance];
        updateConfig({ appliances: newAppliances });
    };

    return (
        <div className="solar-form-container">
            {/* System Type Section */}
            <section className="form-section">
                <h3 className="section-title">System Type</h3>
                <div className="options-grid">
                    <Card
                        className={`option-card ${config.systemType === 'off-grid' ? 'selected' : ''}`}
                        onClick={() => updateConfig({ systemType: 'off-grid' })}
                    >
                        <WifiSlash size={32} />
                        <span>Off-Grid</span>
                    </Card>
                    <Card
                        className={`option-card ${config.systemType === 'hybrid' ? 'selected' : ''}`}
                        onClick={() => updateConfig({ systemType: 'hybrid' })}
                    >
                        <WifiHigh size={32} />
                        <span>Hybrid (Grid-Tied)</span>
                    </Card>
                </div>
            </section>

            {/* Daily Usage Section */}
            <section className="form-section">
                <h3 className="section-title">Daily Usage Profile</h3>
                <div className="options-grid three-col">
                    {(['essential', 'moderate', 'full'] as SolarDailyUsage[]).map(usage => (
                        <Card
                            key={usage}
                            className={`option-card ${config.dailyUsage === usage ? 'selected' : ''}`}
                            onClick={() => updateConfig({ dailyUsage: usage })}
                        >
                            <Sun size={24} />
                            <span className="capitalize">{usage}</span>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Appliances Section */}
            <section className="form-section">
                <h3 className="section-title">Key Appliances</h3>
                <div className="chips-container">
                    {(['fridge', 'tv', 'lights', 'borehole_pump', 'geyser', 'stove'] as SolarAppliance[]).map(app => (
                        <button
                            key={app}
                            className={`chip ${config.appliances.includes(app) ? 'active' : ''}`}
                            type="button"
                            onClick={() => toggleAppliance(app)}
                        >
                            {app.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </section>

            {/* Roof Type Section */}
            <section className="form-section">
                <h3 className="section-title">Roof Type</h3>
                <div className="options-grid three-col">
                    {(['tile', 'ibr', 'concrete'] as SolarRoofType[]).map(roof => (
                        <Card
                            key={roof}
                            className={`option-card ${config.roofType === roof ? 'selected' : ''}`}
                            onClick={() => updateConfig({ roofType: roof })}
                        >
                            <HouseLine size={24} />
                            <span className="capitalize">{roof}</span>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Live Preview */}
            <div className="preview-bar">
                <div className="preview-item">
                    <span className="label">Panels</span>
                    <span className="value">{preview.panels} <small>x 450W</small></span>
                </div>
                <div className="preview-item">
                    <span className="label">Inverter</span>
                    <span className="value">{preview.inverter} <small>kVA</small></span>
                </div>
                <div className="preview-item">
                    <span className="label">Battery</span>
                    <span className="value">{preview.battery} <small>kWh</small></span>
                </div>
            </div>

            <style jsx>{`
        .solar-form-container {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
          padding-bottom: 80px; /* Space for preview bar */
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
          background: rgba(78, 154, 247, 0.05);
          color: var(--color-accent);
        }

        .capitalize {
          text-transform: capitalize;
        }

        .chips-container {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
        }

        .chip {
          padding: 8px 16px;
          border-radius: 9999px;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-text);
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s ease;
          text-transform: capitalize;
        }

        .chip:hover {
          background: var(--color-background);
        }

        .chip.active {
          background: var(--color-accent);
          color: white;
          border-color: var(--color-accent);
        }

        .preview-bar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 100px;
          padding: 12px 32px;
          display: flex;
          gap: 40px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
          z-index: 100;
          width: fit-content;
        }

        .preview-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .preview-item .label {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .preview-item .value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-text);
        }

        .preview-item small {
          font-size: 0.8rem;
          font-weight: 400;
          color: var(--color-text-muted);
        }
        
        @media (max-width: 640px) {
          .preview-bar {
            width: 90%;
            gap: 16px;
            padding: 12px 20px;
            bottom: 80px; /* Above mobile fab if exists */
          }
          .options-grid.three-col {
             grid-template-columns: 1fr;
          }
        }
      `}</style>
        </div>
    );
}
