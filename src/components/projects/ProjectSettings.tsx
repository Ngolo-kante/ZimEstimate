'use client';

import { useState } from 'react';
import { Project, BOQCategory } from '@/lib/database.types';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { updateProject } from '@/lib/services/projects';
import {
    MapPin,
    HouseLine,
    FloppyDisk,
    Check,
    EyeSlash
} from '@phosphor-icons/react';

interface ProjectSettingsProps {
    project: Project;
    onUpdate: (updatedProject: Project) => void;
}

const STAGE_CATEGORIES: { id: BOQCategory; label: string; description: string }[] = [
    { id: 'substructure', label: 'Substructure', description: 'Foundation work, excavation, and footing.' },
    { id: 'superstructure', label: 'Superstructure', description: 'Brickwork, lintels, and beams up to roof level.' },
    { id: 'roofing', label: 'Roofing', description: 'Trusses, sheets, tiles, and ceiling.' },
    { id: 'finishing', label: 'Finishing', description: 'Plastering, painting, tiling, and glazing.' },
    { id: 'exterior', label: 'Exterior', description: 'Landscaping, paving, and boundary walls.' },
];

export default function ProjectSettings({ project, onUpdate }: ProjectSettingsProps) {
    const { success, error: showError } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [name, setName] = useState(project.name);
    const [location, setLocation] = useState(project.location || '');
    const [selectedStages, setSelectedStages] = useState<string[]>(
        project.selected_stages || STAGE_CATEGORIES.map(s => s.id)
    );
    const [lowStockAlertsEnabled, setLowStockAlertsEnabled] = useState(
        project.usage_low_stock_alert_enabled ?? false
    );
    const [lowStockThreshold, setLowStockThreshold] = useState(
        project.usage_low_stock_threshold ?? 20
    );

    const handleStageToggle = (stageId: string) => {
        if (selectedStages.includes(stageId)) {
            setSelectedStages(selectedStages.filter(id => id !== stageId));
        } else {
            setSelectedStages([...selectedStages, stageId]);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates = {
                name,
                location,
                scope: project.scope,
                selected_stages: selectedStages,
                usage_low_stock_alert_enabled: lowStockAlertsEnabled,
                usage_low_stock_threshold: lowStockThreshold,
            };

            const { project: updated, error } = await updateProject(project.id, updates);

            if (error) throw error;

            if (updated) {
                // Merge updates into existing project object locally to avoid full refetch requirement
                const updatedProject = { ...project, ...updates };
                onUpdate(updatedProject);
                success('Project configurations saved');
            }
        } catch (err) {
            showError('Failed to save changes');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="settings-page">
            <div className="settings-header">
                <div>
                    <h2>Project Configurations</h2>
                    <p>Manage visibility and core settings for this project.</p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    icon={isSaving ? <div className="spinner-border animate-spin w-4 h-4 border-2 border-white rounded-full" /> : <FloppyDisk size={18} />}
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            {/* General Settings */}
            <div className="settings-card">
                <div className="card-header">
                    <h3>General Parameters</h3>
                </div>
                <div className="card-content">
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Project Name</label>
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                                <HouseLine size={18} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Location</label>
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g. Borrowdale, Harare"
                                />
                                <MapPin size={18} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Substage Manager (Visibility Toggles) */}
            <div className="settings-card">
                <div className="card-header">
                    <h3>Substage Visibility Manager</h3>
                    <p>Toggle stages to hide or show them in the BOQ and Tracking views.</p>
                </div>
                <div className="card-content">
                    <div className="stages-grid">
                        {STAGE_CATEGORIES.map((stage) => {
                            const isVisible = selectedStages.includes(stage.id);
                            return (
                                <div
                                    key={stage.id}
                                    className={`stage-toggle ${isVisible ? 'active' : ''}`}
                                >
                                    <div className="toggle-info">
                                        <div className={`icon-box ${isVisible ? 'active' : ''}`}>
                                            {isVisible ? <Check size={16} weight="bold" /> : <EyeSlash size={16} />}
                                        </div>
                                        <div>
                                            <h4>{stage.label}</h4>
                                            <p>{stage.description}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleStageToggle(stage.id)}
                                        className={`switch ${isVisible ? 'on' : 'off'}`}
                                        role="switch"
                                        aria-checked={isVisible}
                                    >
                                        <span className="slider" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Usage Alerts */}
            <div className="settings-card">
                <div className="card-header">
                    <h3>Usage Alert Settings</h3>
                    <p>Get notified when remaining material drops below a set threshold.</p>
                </div>
                <div className="card-content">
                    <div className="alert-settings">
                        <div className="setting-row">
                            <div className="setting-info">
                                <h4>Low stock alerts</h4>
                                <p>Notify the project owner when stock is low.</p>
                            </div>
                            <button
                                onClick={() => setLowStockAlertsEnabled(!lowStockAlertsEnabled)}
                                className={`switch ${lowStockAlertsEnabled ? 'on' : 'off'}`}
                                role="switch"
                                aria-checked={lowStockAlertsEnabled}
                            >
                                <span className="slider" />
                            </button>
                        </div>

                        {lowStockAlertsEnabled && (
                            <div className="threshold-config">
                                <div className="form-group">
                                    <label>Alert threshold (% remaining)</label>
                                    <div className="input-wrapper small">
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={lowStockThreshold}
                                            onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                                        />
                                        <span className="suffix">%</span>
                                    </div>
                                    <span className="help-text">
                                        Example: 20 means alert when only 20% of the material remains.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .settings-page {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    max-width: 900px;
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

                .settings-card {
                    background: #ffffff;
                    border: 1px solid rgba(226, 232, 240, 0.6);
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01);
                }

                .card-header {
                    padding: 24px;
                    border-bottom: 1px solid #f1f5f9;
                }

                .card-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #0f172a;
                }

                .card-header p {
                    margin: 4px 0 0;
                    font-size: 0.9rem;
                    color: #64748b;
                }

                .card-content {
                    padding: 24px;
                }

                /* Form Styles */
                .form-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 24px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .form-group label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748b;
                }

                .input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .input-wrapper input {
                    width: 100%;
                    padding: 12px 14px;
                    padding-right: 40px;
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    font-size: 0.95rem;
                    outline: none;
                    transition: all 0.2s;
                    color: #0f172a;
                    background: #ffffff;
                }

                .input-wrapper input:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .input-wrapper svg {
                    position: absolute;
                    right: 14px;
                    color: #94a3b8;
                    pointer-events: none;
                }

                /* Stages Grid */
                .stages-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .stage-toggle {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    transition: all 0.2s;
                    background: #f8fafc;
                }

                .stage-toggle.active {
                    background: #ffffff;
                    border-color: #cbd5e1;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .toggle-info {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .icon-box {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #e2e8f0;
                    color: #94a3b8;
                    transition: all 0.2s;
                }

                .icon-box.active {
                    background: #eff6ff;
                    color: #2563eb;
                }

                .toggle-info h4 {
                    margin: 0;
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #0f172a;
                }

                .toggle-info p {
                    margin: 2px 0 0;
                    font-size: 0.8rem;
                    color: #64748b;
                }

                /* Switch Component */
                .switch {
                    position: relative;
                    width: 44px;
                    height: 24px;
                    border-radius: 99px;
                    border: none;
                    cursor: pointer;
                    background: #e2e8f0;
                    transition: background 0.2s;
                    padding: 2px;
                }

                .switch.on {
                    background: #2563eb;
                }

                .slider {
                    display: block;
                    width: 20px;
                    height: 20px;
                    background: white;
                    border-radius: 50%;
                    transition: transform 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }

                .switch.on .slider {
                    transform: translateX(20px);
                }

                /* Alert Settings */
                .alert-settings {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .setting-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 24px;
                    border-bottom: 1px solid #f1f5f9;
                }
                
                .setting-row:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                }

                .setting-info h4 {
                    margin: 0;
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #0f172a;
                }

                .setting-info p {
                    margin: 2px 0 0;
                    font-size: 0.85rem;
                    color: #64748b;
                }

                .threshold-config {
                    animation: slideDown 0.2s ease-out;
                }

                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .input-wrapper.small {
                    max-width: 120px;
                }
                
                .input-wrapper.small input {
                    padding-right: 32px;
                }

                .suffix {
                    position: absolute;
                    right: 12px;
                    color: #64748b;
                    font-size: 0.9rem;
                    font-weight: 500;
                    pointer-events: none;
                }
                
                .help-text {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                @media (max-width: 640px) {
                    .stage-toggle {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 16px;
                    }
                    
                    .switch {
                        align-self: flex-end;
                    }
                }
            `}</style>
        </div>
    );
}
