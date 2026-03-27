import React from 'react';
import {
    Toilet,
    Trash,
    Plant
} from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import {
    WastewaterConfig,
    SanitationType,
    SepticTankType,
    SoakawayType
} from '@/lib/database.types';

interface WastewaterConfigFormProps {
    config: WastewaterConfig;
    onChange: (config: WastewaterConfig) => void;
}

export default function WastewaterConfigForm({ config, onChange }: WastewaterConfigFormProps) {

    const updateConfig = (updates: Partial<WastewaterConfig>) => {
        onChange({ ...config, ...updates });
    };

    const sanitationLabels: Record<SanitationType, string> = {
        municipal: 'Council Sewer',
        septic: 'Septic Tank',
        eco_composting: 'Eco / Composting',
    };

    return (
        <div className="wastewater-form-container">
            {/* Sanitation Type Section */}
            <section className="form-section">
                <h3 className="section-title">Sanitation Type</h3>
                <div className="options-grid">
                    {(['municipal', 'septic', 'eco_composting'] as SanitationType[]).map(type => (
                        <Card
                            key={type}
                            className={`option-card ${config.sanitationType === type ? 'selected' : ''}`}
                            onClick={() => updateConfig({ sanitationType: type })}
                        >
                            {type === 'municipal' && <Toilet size={24} />}
                            {type === 'septic' && <Trash size={24} />}
                            {type === 'eco_composting' && <Plant size={24} />}
                            <span>{sanitationLabels[type]}</span>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Septic Configuration */}
            {(config.sanitationType === 'septic') && (
                <section className="form-section reveal-section">
                    <h3 className="section-title">System Sizing</h3>

                    <div className="input-grid">
                        <Input
                            label="Number of Bathrooms"
                            type="number"
                            min={1}
                            value={config.bathroomCount || ''}
                            onChange={(e) => updateConfig({ bathroomCount: parseInt(e.target.value) || 0 })}
                        />
                        <Input
                            label="Number of Occupants"
                            type="number"
                            min={1}
                            value={config.occupantCount || ''}
                            onChange={(e) => updateConfig({ occupantCount: parseInt(e.target.value) || 0 })}
                            hint="Used to calculate soakaway volume"
                        />
                    </div>

                    <h3 className="section-title mt-6">Septic Tank & Soakaway</h3>

                    <div className="options-group">
                        <label className="group-label">Septic Tank Type</label>
                        <div className="options-grid">
                            {(['brick', 'precast'] as SepticTankType[]).map(type => (
                                <Card
                                    key={type}
                                    className={`option-card ${config.septicTankType === type ? 'selected' : ''}`}
                                    onClick={() => updateConfig({ septicTankType: type })}
                                >
                                    <span className="capitalize">{type}</span>
                                </Card>
                            ))}
                        </div>
                    </div>

                    <div className="options-group">
                        <label className="group-label">Soakaway Type</label>
                        <div className="options-grid">
                            {(['stone_pit', 'french_drain'] as SoakawayType[]).map(type => (
                                <Card
                                    key={type}
                                    className={`option-card ${config.soakawayType === type ? 'selected' : ''}`}
                                    onClick={() => updateConfig({ soakawayType: type })}
                                >
                                    <span className="capitalize">{type.replace('_', ' ')}</span>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <style jsx>{`
        .wastewater-form-container {
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

        .mt-6 {
           margin-top: 1.5rem;
        }

        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-md);
        }

        .input-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--spacing-md);
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
          background: rgba(100, 116, 139, 0.1);
          color: var(--color-text);
        }

        .capitalize {
          text-transform: capitalize;
        }

        .options-group {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-sm);
            margin-bottom: var(--spacing-md);
        }

        .group-label {
            font-size: 0.9rem;
            font-weight: 500;
            color: var(--color-text-secondary);
        }

        @media (max-width: 640px) {
            .input-grid {
                grid-template-columns: 1fr;
            }
        }
      `}</style>
        </div>
    );
}
