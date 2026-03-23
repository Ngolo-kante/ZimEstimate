'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type {
    GreywaterConfig,
    ProjectUtilityConfig,
    RainwaterConfig,
    SolarConfig,
    WastewaterConfig,
    WaterConfig,
} from '@/lib/database.types';
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

type UtilityConfigByTab = {
    solar: SolarConfig;
    water: WaterConfig;
    wastewater: WastewaterConfig;
    rainwater: RainwaterConfig;
    greywater: GreywaterConfig;
};

const utilityConfigUpdaters: {
    [K in UtilityTab]: (
        current: ProjectUtilityConfig,
        next: UtilityConfigByTab[K]
    ) => Partial<ProjectUtilityConfig>;
} = {
    solar: (_current, next) => ({
        solar_enabled: next.enabled,
        solar_system_type: next.systemType,
        solar_appliances: next.appliances,
        solar_daily_usage: next.dailyUsage,
        solar_roof_type: next.roofType,
    }),
    water: (_current, next) => ({
        water_enabled: next.enabled,
        water_source: next.source,
        borehole_exists: next.boreholeExists,
        borehole_depth_m: next.boreholeDepthM,
        pump_type: next.pumpType,
        tank_count: next.tankCount,
        tank_size_litres: next.tankSizeLitres,
        tank_stand_required: next.tankStandRequired,
    }),
    wastewater: (_current, next) => ({
        wastewater_enabled: next.enabled,
        sanitation_type: next.sanitationType,
        bathroom_count: next.bathroomCount,
        occupant_count: next.occupantCount,
        septic_tank_type: next.septicTankType,
        soakaway_type: next.soakawayType,
    }),
    rainwater: (_current, next) => ({
        rainwater_enabled: next.enabled,
        roof_area_m2: next.roofAreaM2,
        rainwater_gutter_type: next.gutterType,
        rainwater_tank_size_litres: next.tankSizeLitres,
        rainwater_first_flush: next.firstFlush,
        rainwater_sand_filter: next.sandFilter,
    }),
    greywater: (_current, next) => ({
        greywater_enabled: next.enabled,
        greywater_sources: next.sources,
        greywater_use: next.use,
    }),
};

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

    const updateUtilityConfig = <T extends UtilityTab>(section: T, data: UtilityConfigByTab[T]) => {
        setConfig(prev => {
            const updates = utilityConfigUpdaters[section](prev, data);
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
