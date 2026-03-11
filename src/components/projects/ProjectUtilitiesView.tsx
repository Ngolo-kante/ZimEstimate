'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ProjectUtilityConfig } from '@/lib/database.types';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { upsertProjectUtilityConfig } from '@/lib/services/projects';
import {
    FloppyDisk,
    Lightning,
    Drop,
    Toilet,
    CloudRain,
    Recycle
} from '@phosphor-icons/react';

import SolarConfigForm from '@/components/utilities/SolarConfigForm';
import WaterConfigForm from '@/components/utilities/WaterConfigForm';
import WastewaterConfigForm from '@/components/utilities/WastewaterConfigForm';
import RainwaterConfigForm from '@/components/utilities/RainwaterConfigForm';
import GreywaterConfigForm from '@/components/utilities/GreywaterConfigForm';

interface ProjectUtilitiesViewProps {
    projectId: string;
    initialConfig: ProjectUtilityConfig;
}

type UtilityTab = 'solar' | 'water' | 'wastewater' | 'rainwater' | 'greywater';

export default function ProjectUtilitiesView({ projectId, initialConfig }: ProjectUtilitiesViewProps) {
    const { success, error: showError } = useToast();
    const [config, setConfig] = useState<ProjectUtilityConfig>(initialConfig);
    const [activeTab, setActiveTab] = useState<UtilityTab>('solar');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        const { config: saved, error } = await upsertProjectUtilityConfig({
            ...config,
            project_id: projectId
        });
        setIsSaving(false);
        if (error) {
            showError('Failed to save configuration');
        } else {
            success('Utilities configuration saved');
            if (saved) setConfig(saved);
        }
    };

    const updateUtilityConfig = (section: UtilityTab, data: any) => {
        setConfig(prev => {
            const updates: any = {};
            // Map form data to flat config structure
            if (section === 'solar') {
                updates.solar_enabled = prev.solar_enabled; // Keep enabled state or allow toggle inside form?
                // The forms handle config updates, but enabled state is usually passed in config
                // Wait, in wizard, enabled state was managed in Selection step mainly.
                // Here we want to configure details.
                // The forms render based on 'config' prop.

                updates.solar_system_type = data.systemType ?? prev.solar_system_type;
                updates.solar_appliances = data.appliances ?? prev.solar_appliances;
                updates.solar_daily_usage = data.dailyUsage ?? prev.solar_daily_usage;
                updates.solar_roof_type = data.roofType ?? prev.solar_roof_type;
                // If the form passes 'enabled', we should update it too.
                if (data.enabled !== undefined) updates.solar_enabled = data.enabled;
            }
            else if (section === 'water') {
                updates.water_source = data.source ?? prev.water_source;
                updates.borehole_exists = data.boreholeExists ?? prev.borehole_exists;
                updates.borehole_depth_m = data.boreholeDepthM ?? prev.borehole_depth_m;
                updates.pump_type = data.pumpType ?? prev.pump_type;
                updates.tank_count = data.tankCount ?? prev.tank_count;
                updates.tank_size_litres = data.tankSizeLitres ?? prev.tank_size_litres;
                updates.tank_stand_required = data.tankStandRequired ?? prev.tank_stand_required;
                if (data.enabled !== undefined) updates.water_enabled = data.enabled;
            }
            else if (section === 'wastewater') {
                updates.sanitation_type = data.sanitationType ?? prev.sanitation_type;
                updates.bathroom_count = data.bathroomCount ?? prev.bathroom_count;
                updates.occupant_count = data.occupantCount ?? prev.occupant_count;
                updates.septic_tank_type = data.septicTankType ?? prev.septic_tank_type;
                updates.soakaway_type = data.soakawayType ?? prev.soakaway_type;
                if (data.enabled !== undefined) updates.wastewater_enabled = data.enabled;
            }
            else if (section === 'rainwater') {
                updates.roof_area_m2 = data.roofAreaM2 ?? prev.roof_area_m2;
                updates.rainwater_gutter_type = data.gutterType ?? prev.rainwater_gutter_type;
                updates.rainwater_tank_size_litres = data.tankSizeLitres ?? prev.rainwater_tank_size_litres;
                updates.rainwater_first_flush = data.firstFlush ?? prev.rainwater_first_flush;
                updates.rainwater_sand_filter = data.sandFilter ?? prev.rainwater_sand_filter;
                if (data.enabled !== undefined) updates.rainwater_enabled = data.enabled;
            }
            else if (section === 'greywater') {
                updates.greywater_sources = data.sources ?? prev.greywater_sources;
                updates.greywater_use = data.use ?? prev.greywater_use;
                if (data.enabled !== undefined) updates.greywater_enabled = data.enabled;
            }

            return { ...prev, ...updates };
        });
    };

    // Toggle Enabled State Handler
    const toggleEnabled = (tab: UtilityTab) => {
        setConfig(prev => {
            const key = `${tab}_enabled` as keyof ProjectUtilityConfig;
            return { ...prev, [key]: !prev[key as keyof ProjectUtilityConfig] };
        });
    }

    const tabs: { id: UtilityTab; label: string; icon: ReactNode }[] = [
        { id: 'solar', label: 'Solar Power', icon: <Lightning size={20} weight={activeTab === 'solar' ? 'fill' : 'regular'} /> },
        { id: 'water', label: 'Water Supply', icon: <Drop size={20} weight={activeTab === 'water' ? 'fill' : 'regular'} /> },
        { id: 'wastewater', label: 'Septic Tanks', icon: <Toilet size={20} weight={activeTab === 'wastewater' ? 'fill' : 'regular'} /> },
        { id: 'rainwater', label: 'Rainwater', icon: <CloudRain size={20} weight={activeTab === 'rainwater' ? 'fill' : 'regular'} /> },
        { id: 'greywater', label: 'Greywater', icon: <Recycle size={20} weight={activeTab === 'greywater' ? 'fill' : 'regular'} /> },
    ];

    return (
        <div className="utilities-page">
            <div className="settings-header">
                <div>
                    <h2>Utility Systems</h2>
                    <p>Configure and manage utility specifications for your project.</p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    icon={isSaving ? <div className="spinner-border animate-spin w-4 h-4 border-2 border-white rounded-full" /> : <FloppyDisk size={18} />}
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            <div className="utilities-container">
                {/* Sidebar Navigation */}
                <div className="utilities-nav">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className={`icon-box ${activeTab === tab.id ? 'active' : ''}`}>{tab.icon}</span>
                            <span className="tab-label">{tab.label}</span>
                            {/* Status Indicator */}
                            <span className={`status-dot ${config[`${tab}_enabled` as keyof ProjectUtilityConfig] ? 'enabled' : 'disabled'}`} />
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="utilities-content">
                    <div className="content-header">
                        <div className="flex items-center justify-between">
                            <h3>{tabs.find(t => t.id === activeTab)?.label} Configuration</h3>
                            <button
                                className={`toggle-btn ${config[`${activeTab}_enabled` as keyof ProjectUtilityConfig] ? 'active' : ''}`}
                                onClick={() => toggleEnabled(activeTab)}
                            >
                                {config[`${activeTab}_enabled` as keyof ProjectUtilityConfig] ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>
                    </div>

                    <div className={`config-form-wrapper ${!config[`${activeTab}_enabled` as keyof ProjectUtilityConfig] ? 'disabled' : ''}`}>
                        {activeTab === 'solar' && (
                            <SolarConfigForm
                                config={{
                                    enabled: config.solar_enabled,
                                    systemType: config.solar_system_type,
                                    dailyUsage: config.solar_daily_usage,
                                    appliances: config.solar_appliances || [],
                                    roofType: config.solar_roof_type
                                }}
                                onChange={(data) => updateUtilityConfig('solar', data)}
                            />
                        )}
                        {activeTab === 'water' && (
                            <WaterConfigForm
                                config={{
                                    enabled: config.water_enabled,
                                    source: config.water_source,
                                    boreholeExists: config.borehole_exists,
                                    boreholeDepthM: config.borehole_depth_m,
                                    pumpType: config.pump_type,
                                    tankCount: config.tank_count,
                                    tankSizeLitres: config.tank_size_litres,
                                    tankStandRequired: config.tank_stand_required
                                }}
                                onChange={(data) => updateUtilityConfig('water', data)}
                            />
                        )}
                        {activeTab === 'wastewater' && (
                            <WastewaterConfigForm
                                config={{
                                    enabled: config.wastewater_enabled,
                                    sanitationType: config.sanitation_type,
                                    bathroomCount: config.bathroom_count,
                                    occupantCount: config.occupant_count,
                                    septicTankType: config.septic_tank_type,
                                    soakawayType: config.soakaway_type
                                }}
                                onChange={(data) => updateUtilityConfig('wastewater', data)}
                            />
                        )}
                        {activeTab === 'rainwater' && (
                            <RainwaterConfigForm
                                config={{
                                    enabled: config.rainwater_enabled,
                                    roofAreaM2: config.roof_area_m2,
                                    gutterType: config.rainwater_gutter_type,
                                    tankSizeLitres: config.rainwater_tank_size_litres,
                                    firstFlush: config.rainwater_first_flush,
                                    sandFilter: config.rainwater_sand_filter
                                }}
                                onChange={(data) => updateUtilityConfig('rainwater', data)}
                            />
                        )}
                        {activeTab === 'greywater' && (
                            <GreywaterConfigForm
                                config={{
                                    enabled: config.greywater_enabled,
                                    sources: config.greywater_sources || [],
                                    use: config.greywater_use
                                }}
                                onChange={(data) => updateUtilityConfig('greywater', data)}
                            />
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .utilities-page {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    max-width: 1000px;
                    margin: 0 auto;
                }

                .settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 8px;
                }

                .settings-header h2 {
                    margin: 0;
                    font-size: 1.75rem;
                    color: #0f172a;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                }

                .settings-header p {
                    margin: 4px 0 0;
                    font-size: 1rem;
                    color: #64748b;
                }

                .utilities-container {
                    display: grid;
                    grid-template-columns: 240px 1fr;
                    gap: 32px;
                    align-items: start;
                }

                .utilities-nav {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    background: white;
                    padding: 12px;
                    border-radius: 16px;
                    border: 1px solid #e2e8f0;
                }

                .nav-tab {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    border-radius: 12px;
                    text-align: left;
                    transition: all 0.2s;
                    color: #64748b;
                    position: relative;
                }

                .nav-tab:hover {
                    background: #f8fafc;
                    color: #0f172a;
                }

                .nav-tab.active {
                    background: #eff6ff;
                    color: #2563eb;
                    font-weight: 500;
                }

                .icon-box {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: #f1f5f9;
                    color: #94a3b8;
                    transition: all 0.2s;
                }

                .nav-tab.active .icon-box {
                    background: white;
                    color: #2563eb;
                    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.1);
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-left: auto;
                }

                .status-dot.enabled {
                    background: #22c55e;
                    box-shadow: 0 0 0 2px #dcfce7;
                }

                .status-dot.disabled {
                    background: #e2e8f0;
                }

                .utilities-content {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 32px;
                    min-height: 500px;
                }

                .content-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 24px;
                    margin-bottom: 24px;
                    border-bottom: 1px solid #f1f5f9;
                }

                .content-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    color: #0f172a;
                    font-weight: 600;
                }

                .toggle-btn {
                    padding: 6px 16px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    transition: all 0.2s;
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                    background: #f8fafc;
                }

                .toggle-btn.active {
                    background: #dcfce7;
                    color: #166534;
                    border-color: #bbf7d0;
                }
                
                .config-form-wrapper.disabled {
                    opacity: 0.5;
                    pointer-events: none;
                    filter: grayscale(1);
                }

                @media (max-width: 768px) {
                    .utilities-container {
                        grid-template-columns: 1fr;
                    }
                    
                    .utilities-nav {
                        flex-direction: row;
                        overflow-x: auto;
                        padding: 8px;
                    }
                    
                    .nav-tab {
                        flex: 0 0 auto;
                        padding: 8px 12px;
                    }
                    
                    .tab-label {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
}
