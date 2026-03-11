import React from 'react';
import { SunDim, Drop, Toilet, CloudRain, Recycle, CheckCircle } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import { useReveal } from '@/hooks/useReveal';

export type UtilitySelection = {
    solar_enabled: boolean;
    water_enabled: boolean;
    wastewater_enabled: boolean;
    rainwater_enabled: boolean;
    greywater_enabled: boolean;
};

interface UtilitySelectionStepProps {
    selection: UtilitySelection;
    onToggle: (key: keyof UtilitySelection) => void;
}

export default function UtilitySelectionStep({ selection, onToggle }: UtilitySelectionStepProps) {
    useReveal({ selector: '.reveal-card', threshold: 0.1 });

    const utilities = [
        {
            key: 'solar_enabled' as const,
            label: 'Solar Power',
            icon: <SunDim size={32} weight="duotone" color="#F59E0B" />, // Amber-500
            description: 'Solar panels, inverters, and battery backup systems.',
        },
        {
            key: 'water_enabled' as const,
            label: 'Water Supply',
            icon: <Drop size={32} weight="duotone" color="#3B82F6" />, // Blue-500
            description: 'Boreholes, pumps, tanks, and stands.',
        },
        {
            key: 'wastewater_enabled' as const,
            label: 'Wastewater',
            icon: <Toilet size={32} weight="duotone" color="#64748B" />, // Slate-500
            description: 'Septic tanks, soakaways, and sewer connections.',
        },
        {
            key: 'rainwater_enabled' as const,
            label: 'Rainwater',
            icon: <CloudRain size={32} weight="duotone" color="#06B6D4" />, // Cyan-500
            description: 'Gutters, downpipes, and harvesting tanks.',
        },
        {
            key: 'greywater_enabled' as const,
            label: 'Greywater',
            icon: <Recycle size={32} weight="duotone" color="#10B981" />, // Emerald-500
            description: 'Recycling systems for garden irrigation.',
        },
    ];

    return (
        <div className="utility-grid">
            {utilities.map((util, index) => (
                <div
                    key={util.key}
                    className="reveal-card"
                    style={{ transitionDelay: `${index * 100}ms` }}
                >
                    <Card
                        className={`utility-card ${selection[util.key] ? 'selected' : ''}`}
                        onClick={() => onToggle(util.key)}
                        variant="default"
                    >
                        <div className="card-inner">
                            <div className="icon-wrapper">
                                {util.icon}
                            </div>
                            <div className="content">
                                <h3 className="title">{util.label}</h3>
                                <p className="description">{util.description}</p>
                            </div>
                            <div className={`checkbox ${selection[util.key] ? 'checked' : ''}`}>
                                {selection[util.key] && <CheckCircle size={24} weight="fill" />}
                            </div>
                        </div>
                    </Card>
                </div>
            ))}

            <style jsx>{`
        .utility-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--spacing-md);
          margin-top: var(--spacing-lg);
        }

        .reveal-card {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }

        .reveal-card.in-view {
          opacity: 1;
          transform: translateY(0);
        }

        /* Utility Card specific overrides */
        :global(.utility-card) {
          height: 100%;
          cursor: pointer;
          border: 2px solid transparent !important; /* Force override */
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        :global(.utility-card:hover) {
          border-color: var(--color-border) !important;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        :global(.utility-card.selected) {
          border-color: var(--color-accent) !important;
          background-color: rgba(78, 154, 247, 0.05); /* Slight blue tint */
          box-shadow: 0 4px 6px -1px rgba(78, 154, 247, 0.2);
        }

        .card-inner {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-md);
        }

        .icon-wrapper {
          flex-shrink: 0;
          padding: var(--spacing-sm);
          background: var(--color-surface); 
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border-light);
        }

        .content {
          flex: 1;
        }

        .title {
          font-weight: 600;
          margin-bottom: var(--spacing-xs);
          color: var(--color-text);
          font-size: 1.1rem;
        }

        .description {
          font-size: 0.875rem;
          color: var(--color-text-muted);
          line-height: 1.5;
        }

        .checkbox {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent);
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .checkbox.checked {
          border-color: var(--color-accent);
          background: transparent;
        }

        @media (max-width: 640px) {
          .utility-grid {
             grid-template-columns: 1fr;
          }
        }
      `}</style>
        </div>
    );
}
