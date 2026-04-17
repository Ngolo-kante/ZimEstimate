import React, { useMemo } from 'react';
import {
    Sun,
    Drop,
    Toilet,
    CloudRain,
    Recycle,
    PencilSimple
} from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import { ProjectUtilityConfig } from '@/lib/database.types';

// Utility helper to format display values
const getSolarSummary = (config: ProjectUtilityConfig) => {
    if (!config.solar_enabled) return null;
    const parts = [];
    if (config.solar_system_type) parts.push(config.solar_system_type === 'off-grid' ? 'Off-Grid' : 'Hybrid');
    if (config.solar_daily_usage) parts.push(`${config.solar_daily_usage} Usage`);
    return parts.join(' • ') || 'Configured';
};

const getWaterSummary = (config: ProjectUtilityConfig) => {
    if (!config.water_enabled) return null;
    const parts = [];
    if (config.water_source) parts.push(config.water_source.replace('_', ' + '));
    if (config.tank_count && config.tank_count > 0) parts.push(`${config.tank_count} Tank(s)`);
    return parts.join(' • ') || 'Configured';
};

const getWastewaterSummary = (config: ProjectUtilityConfig) => {
    if (!config.wastewater_enabled) return null;
    const sanitation = config.sanitation_type ? config.sanitation_type.replace('_', ' ') : '';
    return sanitation ? `${sanitation} System` : 'Configured';
};

interface UtilityBoqPreviewProps {
    config: ProjectUtilityConfig;
    onEdit: (section: 'selection' | 'solar' | 'water' | 'wastewater' | 'rainwater' | 'greywater') => void;
}

export default function UtilityBoqPreview({ config, onEdit }: UtilityBoqPreviewProps) {

    const enabledUtilities = useMemo(() => [
        {
            key: 'solar',
            enabled: config.solar_enabled,
            label: 'Solar Power',
            icon: <Sun size={24} weight="duotone" className="text-amber-500" />,
            summary: getSolarSummary(config),
            editKey: 'solar' as const
        },
        {
            key: 'water',
            enabled: config.water_enabled,
            label: 'Water Supply',
            icon: <Drop size={24} weight="duotone" className="text-blue-500" />,
            summary: getWaterSummary(config),
            editKey: 'water' as const
        },
        {
            key: 'wastewater',
            enabled: config.wastewater_enabled,
            label: 'Wastewater',
            icon: <Toilet size={24} weight="duotone" className="text-slate-500" />,
            summary: getWastewaterSummary(config),
            editKey: 'wastewater' as const
        },
        {
            key: 'rainwater',
            enabled: config.rainwater_enabled,
            label: 'Rainwater',
            icon: <CloudRain size={24} weight="duotone" className="text-cyan-500" />,
            summary: config.roof_area_m2 ? `${config.roof_area_m2}m² Area` : 'Configured',
            editKey: 'rainwater' as const
        },
        {
            key: 'greywater',
            enabled: config.greywater_enabled,
            label: 'Greywater',
            icon: <Recycle size={24} weight="duotone" className="text-emerald-500" />,
            summary: config.greywater_use ? `For ${config.greywater_use.replace('_', ' ')}` : 'Configured',
            editKey: 'greywater' as const
        }
    ].filter(u => u.enabled), [config]);

    if (enabledUtilities.length === 0) {
        return (
            <div className="empty-state">
                <p>No utilities selected for this project.</p>
                <button
                    className="edit-link"
                    onClick={() => onEdit('selection')}
                >
                    Add Utilities
                </button>

                <style jsx>{`
                .empty-state {
                    text-align: center;
                    padding: 40px;
                    background: var(--color-surface-subtle);
                    border-radius: var(--radius-lg);
                    border: 1px dashed var(--color-border);
                }
                .edit-link {
                    color: var(--color-accent);
                    font-weight: 500;
                    margin-top: 8px;
                    text-decoration: underline;
                    cursor: pointer;
                }
              `}</style>
            </div>
        );
    }

    return (
        <div className="preview-container">
            <div className="header">
                <h3>Selected Systems</h3>
                <button className="edit-btn" onClick={() => onEdit('selection')}>
                    <PencilSimple size={16} />
                    Modify Selection
                </button>
            </div>

            <div className="utility-list">
                {enabledUtilities.map((util) => (
                    <Card key={util.key} className="utility-preview-card">
                        <div className="card-content">
                            <div className="icon-box">{util.icon}</div>
                            <div className="info">
                                <h4>{util.label}</h4>
                                <span className="summary">{util.summary}</span>
                            </div>
                            <button
                                className="context-edit-btn"
                                onClick={() => onEdit(util.editKey)}
                                title={`Edit ${util.label} settings`}
                                aria-label={`Edit ${util.label} settings`}
                            >
                                <PencilSimple size={18} />
                            </button>
                        </div>
                    </Card>
                ))}
            </div>

            <style jsx>{`
         .preview-container {
             display: flex;
             flex-direction: column;
             gap: var(--spacing-md);
         }

         .header {
             display: flex;
             justify-content: space-between;
             align-items: center;
             margin-bottom: var(--spacing-sm);
         }

         .header h3 {
             font-size: 1.1rem;
             font-weight: 600;
             color: var(--color-text);
         }

         .edit-btn {
             display: flex;
             align-items: center;
             gap: 6px;
             font-size: 0.875rem;
             color: var(--color-accent);
             background: transparent;
             padding: 4px 8px;
             border-radius: 4px;
             transition: background 0.2s;
         }
         
         .edit-btn:hover {
             background: var(--color-surface-hover);
         }

         .utility-list {
             display: grid;
             grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
             gap: var(--spacing-md);
         }

         :global(.utility-preview-card) {
             padding: 16px !important;
         }

         .card-content {
             display: flex;
             align-items: center;
             gap: 16px;
         }

         .icon-box {
             width: 48px;
             height: 48px;
             border-radius: 12px;
             background: var(--color-surface-subtle);
             display: flex;
             align-items: center;
             justify-content: center;
             flex-shrink: 0;
         }

         .info {
             flex: 1;
             min-width: 0;
         }

         .info h4 {
             font-weight: 600;
             margin-bottom: 2px;
             color: var(--color-text);
         }

         .summary {
             font-size: 0.875rem;
             color: var(--color-text-muted);
             text-transform: capitalize;
             white-space: nowrap;
             overflow: hidden;
             text-overflow: ellipsis;
             display: block;
         }

         .context-edit-btn {
             color: var(--color-text-muted);
             padding: 8px;
             border-radius: 50%;
             transition: all 0.2s;
         }

         .context-edit-btn:hover {
             background: var(--color-surface-hover);
             color: var(--color-accent);
         }
       `}</style>
        </div>
    );
}
