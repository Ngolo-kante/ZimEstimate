'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
    FileArrowUp,
    PencilSimple,
    Camera,
    ArrowRight,
    ArrowLeft,
    MapPin,
    Buildings,
    House,
    Storefront,
    Wrench,
    Plus,
    CurrencyDollar,
    Medal,
    Lightning,
    CheckCircle,
} from '@phosphor-icons/react';

type BOQMethod = 'upload' | 'manual' | 'photo' | null;
type ProjectType = 'new-house' | 'extension' | 'renovation' | 'commercial' | null;
type Priority = 'budget' | 'quality' | 'speed' | null;

interface ProjectFormData {
    name: string;
    location: string;
    projectType: ProjectType;
    priority: Priority;
    boqMethod: BOQMethod;
}

import { createProject } from '@/lib/services/projects';
import { useToast } from '@/components/ui/Toast';

export default function NewProject() {
    const router = useRouter();
    const { error: showError, success: showSuccess } = useToast();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<ProjectFormData>({
        name: '',
        location: '',
        projectType: null,
        priority: null,
        boqMethod: null,
    });

    const handleInputChange = (field: keyof ProjectFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleTypeSelect = (type: ProjectType) => {
        setFormData((prev) => ({ ...prev, projectType: type }));
    };

    const handlePrioritySelect = (priority: Priority) => {
        setFormData((prev) => ({ ...prev, priority: priority }));
    };

    const handleMethodSelect = (method: BOQMethod) => {
        setFormData((prev) => ({ ...prev, boqMethod: method }));
    };

    const handleContinue = async () => {
        if (step === 1 && formData.projectType) {
            setStep(2);
        } else if (step === 2 && formData.priority) {
            setStep(3);
        } else if (step === 3 && formData.name && formData.location) {
            setStep(4);
        } else if (step === 4 && formData.boqMethod) {
            if (formData.boqMethod === 'manual') {
                // Manual builder: store form data in sessionStorage and redirect (no auth required)
                try {
                    sessionStorage.setItem('zimestimate_new_project', JSON.stringify({
                        name: formData.name,
                        location: formData.location,
                        type: formData.projectType,
                        priority: formData.priority,
                    }));
                } catch {}
                showSuccess('Great choice! Let\'s build your estimate.');
                router.push('/boq/new');
                return;
            }

            // Upload / Photo methods: create project in DB (requires auth)
            setIsLoading(true);
            try {
                const { project, error } = await createProject({
                    name: formData.name,
                    location: formData.location,
                    description: `Type: ${formData.projectType}, Priority: ${formData.priority}`,
                    scope: 'entire_house',
                    labor_preference: 'materials_only',
                });

                if (error) {
                    showError(error.message || 'Failed to create project');
                    setIsLoading(false);
                    return;
                }

                if (project) {
                    try {
                        sessionStorage.setItem('zimestimate_optimistic_project', JSON.stringify({
                            id: project.id,
                            name: formData.name,
                            location: formData.location,
                            type: formData.projectType,
                        }));
                    } catch {}
                    router.push(`/projects?created=1`);
                }
            } catch (err) {
                console.error('Error creating project:', err);
                showError('An unexpected error occurred');
                setIsLoading(false);
            }
        }
    };

    const canContinue =
        (step === 1 && formData.projectType !== null) ||
        (step === 2 && formData.priority !== null) ||
        (step === 3 && formData.name && formData.location) ||
        (step === 4 && formData.boqMethod !== null);

    const getStepTitle = () => {
        switch (step) {
            case 1: return { title: "What are you building?", subtitle: "This helps us personalize your experience" };
            case 2: return { title: "What's most important to you?", subtitle: "We'll optimize recommendations based on your priority" };
            case 3: return { title: "Tell us about your project", subtitle: "A few details to get started" };
            case 4: return { title: "How would you like to build your estimate?", subtitle: "Choose the method that works best for you" };
            default: return { title: "", subtitle: "" };
        }
    };

    const stepInfo = getStepTitle();

    return (
        <MainLayout title="New Project">
            <div className="new-project">
                {/* Progress Bar */}
                <div className="progress-container">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${(step / 4) * 100}%` }} />
                    </div>
                    <div className="progress-steps">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className={`progress-step ${step >= s ? 'active' : ''} ${step === s ? 'current' : ''}`}>
                                {step > s ? <CheckCircle size={20} weight="fill" /> : s}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step Header */}
                <div className="step-header">
                    <h1>{stepInfo.title}</h1>
                    <p>{stepInfo.subtitle}</p>
                </div>

                {/* Step 1: Project Type Selection */}
                {step === 1 && (
                    <div className="step-content">
                        <div className="tiles-grid four-cols">
                            <div
                                className={`tile ${formData.projectType === 'new-house' ? 'selected' : ''}`}
                                onClick={() => handleTypeSelect('new-house')}
                            >
                                <div className="tile-icon">
                                    <House size={36} weight="duotone" />
                                </div>
                                <h3>New House</h3>
                                <p>Building from scratch</p>
                            </div>

                            <div
                                className={`tile ${formData.projectType === 'extension' ? 'selected' : ''}`}
                                onClick={() => handleTypeSelect('extension')}
                            >
                                <div className="tile-icon">
                                    <Plus size={36} weight="duotone" />
                                </div>
                                <h3>Extension</h3>
                                <p>Adding to existing structure</p>
                            </div>

                            <div
                                className={`tile ${formData.projectType === 'renovation' ? 'selected' : ''}`}
                                onClick={() => handleTypeSelect('renovation')}
                            >
                                <div className="tile-icon">
                                    <Wrench size={36} weight="duotone" />
                                </div>
                                <h3>Renovation</h3>
                                <p>Upgrading or remodeling</p>
                            </div>

                            <div
                                className={`tile ${formData.projectType === 'commercial' ? 'selected' : ''}`}
                                onClick={() => handleTypeSelect('commercial')}
                            >
                                <div className="tile-icon">
                                    <Storefront size={36} weight="duotone" />
                                </div>
                                <h3>Commercial</h3>
                                <p>Shop, office, or business</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Priority Selection */}
                {step === 2 && (
                    <div className="step-content">
                        <div className="tiles-grid three-cols">
                            <div
                                className={`tile priority-tile ${formData.priority === 'budget' ? 'selected' : ''}`}
                                onClick={() => handlePrioritySelect('budget')}
                            >
                                <div className="tile-icon budget">
                                    <CurrencyDollar size={40} weight="duotone" />
                                </div>
                                <h3>Budget-Focused</h3>
                                <p>Find the most cost-effective materials and alternatives</p>
                                <span className="tile-hint">Best for tight budgets</span>
                            </div>

                            <div
                                className={`tile priority-tile ${formData.priority === 'quality' ? 'selected' : ''}`}
                                onClick={() => handlePrioritySelect('quality')}
                            >
                                <div className="tile-icon quality">
                                    <Medal size={40} weight="duotone" />
                                </div>
                                <h3>Quality-First</h3>
                                <p>Premium materials and trusted suppliers</p>
                                <span className="tile-hint">Best for long-term value</span>
                            </div>

                            <div
                                className={`tile priority-tile ${formData.priority === 'speed' ? 'selected' : ''}`}
                                onClick={() => handlePrioritySelect('speed')}
                            >
                                <div className="tile-icon speed">
                                    <Lightning size={40} weight="duotone" />
                                </div>
                                <h3>Fast Track</h3>
                                <p>Readily available materials for quick completion</p>
                                <span className="tile-hint">Best for tight deadlines</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Project Details */}
                {step === 3 && (
                    <div className="step-content">
                        <Card className="form-card">
                            <div className="form-grid">
                                <div className="form-field">
                                    <label className="field-label">What would you like to call this project?</label>
                                    <Input
                                        placeholder="e.g., Borrowdale 4-Bed House"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        icon={<Buildings size={18} weight="light" />}
                                    />
                                    <span className="field-hint">Give it a memorable name you'll recognize</span>
                                </div>

                                <div className="form-field">
                                    <label className="field-label">Where is your project located?</label>
                                    <Input
                                        placeholder="e.g., Harare, Zimbabwe"
                                        value={formData.location}
                                        onChange={(e) => handleInputChange('location', e.target.value)}
                                        icon={<MapPin size={18} weight="light" />}
                                    />
                                    <span className="field-hint">Helps us show local supplier prices</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Step 4: BOQ Method Selection */}
                {step === 4 && (
                    <div className="step-content">
                        <div className="tiles-grid three-cols">
                            <div
                                className={`tile method-tile ${formData.boqMethod === 'manual' ? 'selected' : ''}`}
                                onClick={() => handleMethodSelect('manual')}
                            >
                                <div className="tile-icon">
                                    <PencilSimple size={40} weight="duotone" />
                                </div>
                                <h3>Manual Builder</h3>
                                <p>Build your BOQ step by step with guided inputs</p>
                                <CardBadge variant="accent">Recommended</CardBadge>
                            </div>

                            <div
                                className={`tile method-tile ${formData.boqMethod === 'upload' ? 'selected' : ''}`}
                                onClick={() => handleMethodSelect('upload')}
                            >
                                <div className="tile-icon">
                                    <FileArrowUp size={40} weight="duotone" />
                                </div>
                                <h3>Upload Floor Plan</h3>
                                <p>AI analyzes your blueprint to extract measurements</p>
                                <CardBadge variant="success">Best for Accuracy</CardBadge>
                            </div>

                            <div
                                className={`tile method-tile ${formData.boqMethod === 'photo' ? 'selected' : ''}`}
                                onClick={() => handleMethodSelect('photo')}
                            >
                                <div className="tile-icon">
                                    <Camera size={40} weight="duotone" />
                                </div>
                                <h3>Photo Quote</h3>
                                <p>Scan a handwritten quote from your hardware store</p>
                                <CardBadge variant="default">OCR Powered</CardBadge>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="step-navigation">
                    {step > 1 && (
                        <Button
                            variant="secondary"
                            icon={<ArrowLeft size={18} weight="bold" />}
                            onClick={() => setStep(step - 1)}
                        >
                            Back
                        </Button>
                    )}
                    <div className="nav-spacer" />
                    <Button
                        icon={<ArrowRight size={18} weight="bold" />}
                        iconPosition="right"
                        onClick={handleContinue}
                        disabled={!canContinue}
                        loading={isLoading}
                    >
                        {step === 4 ? 'Create Project' : 'Continue'}
                    </Button>
                </div>
            </div>

            <style jsx>{`
                .new-project {
                    max-width: 900px;
                    margin: 0 auto;
                    padding-bottom: 40px;
                }

                /* Progress Bar */
                .progress-container {
                    margin-bottom: 48px;
                }

                .progress-bar {
                    height: 4px;
                    background: #e2e8f0;
                    border-radius: 2px;
                    overflow: hidden;
                    margin-bottom: 16px;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #FCA311, #f59e0b);
                    border-radius: 2px;
                    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .progress-steps {
                    display: flex;
                    justify-content: space-between;
                    padding: 0 10%;
                }

                .progress-step {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: #e2e8f0;
                    color: #64748b;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.875rem;
                    font-weight: 600;
                    transition: all 0.3s;
                }

                .progress-step.active {
                    background: #FCA311;
                    color: #0f172a;
                }

                .progress-step.current {
                    box-shadow: 0 0 0 4px rgba(252, 163, 17, 0.2);
                }

                /* Step Header */
                .step-header {
                    text-align: center;
                    margin-bottom: 40px;
                }

                .step-header h1 {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #0f172a;
                    margin: 0 0 8px 0;
                    letter-spacing: -0.02em;
                }

                .step-header p {
                    font-size: 1.125rem;
                    color: #64748b;
                    margin: 0;
                }

                /* Tiles Grid */
                .tiles-grid {
                    display: grid;
                    gap: 20px;
                }

                .tiles-grid.four-cols {
                    grid-template-columns: repeat(4, 1fr);
                }

                .tiles-grid.three-cols {
                    grid-template-columns: repeat(3, 1fr);
                }

                .tile {
                    background: white;
                    border: 2px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 28px 24px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .tile:hover {
                    border-color: #cbd5e1;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1);
                }

                .tile.selected {
                    border-color: #FCA311;
                    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
                    box-shadow: 0 0 0 4px rgba(252, 163, 17, 0.15);
                }

                .tile-icon {
                    width: 72px;
                    height: 72px;
                    margin: 0 auto 16px auto;
                    border-radius: 50%;
                    background: #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748b;
                    transition: all 0.2s;
                }

                .tile.selected .tile-icon {
                    background: #FCA311;
                    color: #0f172a;
                }

                .tile-icon.budget { color: #16a34a; }
                .tile-icon.quality { color: #2563eb; }
                .tile-icon.speed { color: #dc2626; }

                .tile.selected .tile-icon.budget,
                .tile.selected .tile-icon.quality,
                .tile.selected .tile-icon.speed {
                    background: #FCA311;
                    color: #0f172a;
                }

                .tile h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: #0f172a;
                    margin: 0 0 8px 0;
                }

                .tile p {
                    font-size: 0.875rem;
                    color: #64748b;
                    margin: 0;
                    line-height: 1.5;
                }

                .tile-hint {
                    display: inline-block;
                    margin-top: 12px;
                    padding: 4px 10px;
                    background: #f1f5f9;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    color: #475569;
                    font-weight: 500;
                }

                .tile.selected .tile-hint {
                    background: rgba(252, 163, 17, 0.3);
                    color: #92400e;
                }

                /* Form Card */
                .form-card {
                    max-width: 560px;
                    margin: 0 auto;
                }

                .form-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 28px;
                }

                .form-field {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .field-label {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #0f172a;
                }

                .field-hint {
                    font-size: 0.813rem;
                    color: #94a3b8;
                }

                /* Navigation */
                .step-navigation {
                    display: flex;
                    align-items: center;
                    padding-top: 32px;
                    margin-top: 40px;
                    border-top: 1px solid #e2e8f0;
                }

                .nav-spacer {
                    flex: 1;
                }

                .step-content {
                    min-height: 300px;
                }

                /* Responsive */
                @media (max-width: 900px) {
                    .tiles-grid.four-cols {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 768px) {
                    .tiles-grid.three-cols {
                        grid-template-columns: 1fr;
                    }

                    .step-header h1 {
                        font-size: 1.5rem;
                    }

                    .step-header p {
                        font-size: 1rem;
                    }

                    .progress-steps {
                        padding: 0;
                    }
                }

                @media (max-width: 480px) {
                    .tiles-grid.four-cols {
                        grid-template-columns: 1fr;
                    }

                    .tile {
                        padding: 20px 16px;
                    }

                    .tile-icon {
                        width: 56px;
                        height: 56px;
                    }
                }
            `}</style>
        </MainLayout>
    );
}
