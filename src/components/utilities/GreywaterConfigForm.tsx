import React from 'react';
import {
    Shower,
    Drop,
    TShirt,
    Plant,
    Toilet
} from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import {
    GreywaterConfig,
    GreywaterSource,
    GreywaterUse
} from '@/lib/database.types';

interface GreywaterConfigFormProps {
    config: GreywaterConfig;
    onChange: (config: GreywaterConfig) => void;
}

export default function GreywaterConfigForm({ config, onChange }: GreywaterConfigFormProps) {

    const updateConfig = (updates: Partial<GreywaterConfig>) => {
        onChange({ ...config, ...updates });
    };

    const toggleSource = (source: GreywaterSource) => {
        const current = config.sources || [];
        const newSources = current.includes(source)
            ? current.filter(s => s !== source)
            : [...current, source];
        updateConfig({ sources: newSources });
    };

    return (
        <div className="greywater-form-container">
            {/* Sources Section */}
            <section className="form-section">
                <h3 className="section-title">Greywater Sources</h3>
                <p className="section-desc">Select which sources you want to recycle water from.</p>
                <div className="options-grid three-col">
                    {(['shower', 'sink', 'laundry'] as GreywaterSource[]).map(source => (
                        <Card
                            key={source}
                            className={`option-card ${config.sources.includes(source) ? 'selected' : ''}`}
                            onClick={() => toggleSource(source)}
                        >
                            {source === 'shower' && <Shower size={24} />}
                            {source === 'sink' && <Drop size={24} />}
                            {source === 'laundry' && <TShirt size={24} />}
                            <span className="capitalize">{source}</span>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Usage Section */}
            <section className="form-section reveal-section">
                <h3 className="section-title">Intended Use</h3>
                <div className="options-grid">
                    {(['garden', 'toilet_flushing'] as GreywaterUse[]).map(use => (
                        <Card
                            key={use}
                            className={`option-card ${config.use === use ? 'selected' : ''}`}
                            onClick={() => updateConfig({ use })}
                        >
                            {use === 'garden' && <Plant size={24} />}
                            {use === 'toilet_flushing' && <Toilet size={24} />}
                            <span className="capitalize">{use.replace('_', ' ')}</span>
                        </Card>
                    ))}
                </div>
            </section>

            <style jsx>{`
        .greywater-form-container {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
        }

        .section-title {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: var(--spacing-xs);
          color: var(--color-text);
        }

        .section-desc {
          font-size: 0.875rem;
          color: var(--color-text-muted);
          margin-bottom: var(--spacing-md);
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
          background: rgba(16, 185, 129, 0.05); /* Emerald tint */
          color: var(--color-success);
        }

        .capitalize {
          text-transform: capitalize;
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
