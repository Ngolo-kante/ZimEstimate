'use client';

import { useState } from 'react';
import { Project, ProjectScope, BOQCategory } from '@/lib/database.types';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { updateProject } from '@/lib/services/projects';
import {
    MapPin,
    HouseLine,
    FloppyDisk,
    Check,
    Eye,
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
    const [scope, setScope] = useState<ProjectScope>(project.scope);
    const [selectedStages, setSelectedStages] = useState<string[]>(
        project.selected_stages || STAGE_CATEGORIES.map(s => s.id)
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
                scope,
                selected_stages: selectedStages,
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
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Project Configurations</h2>
                    <p className="text-slate-500">Manage visibility and core settings for this project.</p>
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
            <Card>
                <CardHeader>
                    <CardTitle>General Parameters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="form-group">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Project Name</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-all font-medium"
                                />
                                <HouseLine size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-all"
                                    placeholder="e.g. Borrowdale, Harare"
                                />
                                <MapPin size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Substage Manager (Visibility Toggles) */}
            <Card>
                <CardHeader>
                    <CardTitle>Substage Visibility Manager</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-slate-500 mb-6">
                        Toggle stages to hide or show them in the BOQ and Tracking views. Unchecking a stage will not delete data, only hide it.
                    </p>

                    <div className="space-y-4">
                        {STAGE_CATEGORIES.map((stage) => {
                            const isVisible = selectedStages.includes(stage.id);
                            return (
                                <div
                                    key={stage.id}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isVisible
                                        ? 'bg-white border-slate-200 shadow-sm'
                                        : 'bg-slate-50 border-slate-100 opacity-60'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isVisible ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-400'
                                            }`}>
                                            {isVisible ? <Check size={18} weight="bold" /> : <EyeSlash size={18} />}
                                        </div>
                                        <div>
                                            <h4 className={`font-semibold ${isVisible ? 'text-slate-800' : 'text-slate-500'}`}>
                                                {stage.label}
                                            </h4>
                                            <p className="text-sm text-slate-500">{stage.description}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleStageToggle(stage.id)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isVisible ? 'bg-blue-600' : 'bg-slate-200'
                                            }`}
                                    >
                                        <span
                                            className={`${isVisible ? 'translate-x-6' : 'translate-x-1'
                                                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out`}
                                        />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
