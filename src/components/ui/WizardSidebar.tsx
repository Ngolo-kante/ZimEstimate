'use client';

import React, { useState } from 'react';
import {
    CheckCircle,
    CaretRight,
} from '@phosphor-icons/react';

export type StepStatus = 'locked' | 'available' | 'current' | 'completed' | 'skipped';

export interface WizardStep {
    id: string;
    label: string;
    shortLabel?: string;
    description?: string;
    icon: React.ComponentType<any>;
    status: StepStatus;
    isOptional?: boolean;
    isIncluded?: boolean;
    itemCount?: number;
    subtotal?: number;
}

export interface ProjectSummaryData {
    name?: string;
    location?: string;
    floorArea?: string;
    buildingType?: string;
    scope?: string;
    labor?: string;
    rooms?: { label: string; count: number }[];
    nextHint?: string;
}

interface WizardSidebarProps {
    steps: WizardStep[];
    currentStepId: string;
    currentStepNumber: number;
    totalSetupSteps: number;
    onStepClick: (stepId: string) => void;
    onToggleStep?: (stepId: string, included: boolean) => void;
    totalUSD: number;
    totalZWG?: number;
    projectSummary?: ProjectSummaryData;
    completionPercentage?: number;
    formatPrice: (usd: number, zwg: number) => string;
}

export function WizardSidebar({
    steps,
    currentStepId,
    currentStepNumber,
    onStepClick,
    totalUSD,
    totalZWG,
    projectSummary,
    formatPrice,
}: WizardSidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleStepClick = (step: WizardStep) => {
        if (step.status === 'locked') return;
        onStepClick(step.id);
    };

    if (isCollapsed) {
        return (
            <div className="wizard-sidebar-compact">
                <button
                    className="expand-btn"
                    onClick={() => setIsCollapsed(false)}
                    title="Expand"
                >
                    <CaretRight size={20} />
                </button>
                <div className="compact-steps">
                    {steps.map((step, index) => {
                        const isCurrent = step.id === currentStepId;
                        const isCompleted = step.status === 'completed';
                        return (
                            <button
                                key={step.id}
                                className={`compact-step ${isCurrent ? 'current' : ''} ${step.status}`}
                                onClick={() => handleStepClick(step)}
                                disabled={step.status === 'locked'}
                            >
                                {isCompleted ? (
                                    <CheckCircle size={20} weight="fill" className="text-green-500" />
                                ) : (
                                    <span className={`text-xs font-bold ${isCurrent ? 'text-blue-600' : 'text-slate-400'}`}>{index + 1}</span>
                                )}
                            </button>
                        )
                    })}
                </div>
                <style jsx>{`
                    .wizard-sidebar-compact { width: 64px; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; align-items: center; padding: 16px 8px; gap: 8px; height: 100vh; position: sticky; top: 0; }
                    .expand-btn { width: 36px; height: 36px; border: none; background: #f1f5f9; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; margin-bottom: 8px; }
                    .compact-steps { display: flex; flex-direction: column; gap: 8px; width: 100%; align-items: center; }
                    .compact-step { width: 40px; height: 40px; border: 1px solid #e2e8f0; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #94a3b8; transition: all 0.2s; background: white; }
                    .compact-step:hover:not(:disabled) { border-color: #cbd5e1; }
                    .compact-step.current { background: #eff6ff; color: #3b82f6; border-color: #3b82f6; }
                    .compact-step.completed { background: #dcfce7; border-color: #22c55e; }
                    .compact-step:disabled { opacity: 0.5; cursor: not-allowed; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="wizard-sidebar">
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 leading-none">Project Builder</h2>
                        <span className="text-xs font-medium text-slate-500 mt-1 block">
                            Step {currentStepNumber} of {steps.length}
                        </span>
                    </div>
                    <button
                        className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-lg transition-colors"
                        onClick={() => setIsCollapsed(true)}
                    >
                        <CaretRight size={18} className="rotate-180" />
                    </button>
                </div>

                {/* Steps Navigation */}
                <div className="flex-1 overflow-y-auto py-8 pl-6 pr-4 relative">
                    {/* Connecting Line (Only spans partially, ideally dynamically sized, but strict CSS layout easier) */}
                    {/* We will draw lines between items instead of a full absolute line to handle spacing better */}

                    <div className="flex flex-col gap-0">
                        {steps.map((step, index) => {
                            const isCurrent = step.id === currentStepId;
                            const isCompleted = step.status === 'completed';
                            const isLocked = step.status === 'locked';
                            const isLast = index === steps.length - 1;

                            return (
                                <div key={step.id} className="relative flex gap-4 pb-8 last:pb-0 group">
                                    {/* Connecting Line */}
                                    {!isLast && (
                                        <div
                                            className={`absolute left-[19px] top-10 bottom-0 w-[2px] 
                                                ${isCompleted ? 'bg-green-500' : 'bg-slate-100'}
                                            `}
                                            style={{ height: 'calc(100% - 10px)' }}
                                        />
                                    )}

                                    {/* Step Indicator */}
                                    <button
                                        onClick={() => handleStepClick(step)}
                                        disabled={isLocked}
                                        className="relative z-10 flex-shrink-0"
                                    >
                                        <div
                                            className={`
                                                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-white
                                                ${isCompleted
                                                    ? 'border-green-500 bg-green-500 text-white'
                                                    : isCurrent
                                                        ? 'border-blue-600 text-blue-600 shadow-md shadow-blue-100 scale-110'
                                                        : 'border-slate-200 text-slate-400 group-hover:border-slate-300'
                                                }
                                            `}
                                        >
                                            {isCompleted ? (
                                                <CheckCircle size={20} weight="fill" className="text-white" />
                                            ) : (
                                                <span className={`text-sm font-bold`}>
                                                    {index + 1}
                                                </span>
                                            )}
                                        </div>
                                    </button>

                                    {/* Step Content */}
                                    <button
                                        onClick={() => handleStepClick(step)}
                                        disabled={isLocked}
                                        className={`text-left pt-1 flex-1 min-w-0 transition-opacity duration-300
                                            ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}
                                            ${isCurrent ? 'opacity-100' : isCompleted ? 'opacity-70' : 'opacity-50'}
                                        `}
                                    >
                                        <span className={`block text-sm font-bold truncate transition-colors ${isCurrent ? 'text-slate-900' : 'text-slate-600'}`}>
                                            {step.label}
                                        </span>
                                        <p className="text-xs text-slate-400 font-medium mt-0.5 leading-relaxed">
                                            {step.description}
                                        </p>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Total Footer */}
                <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 border-t border-slate-200 mt-auto">
                    <div>
                        <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Estimated Total</span>
                        <div className="text-2xl font-bold text-slate-900 tracking-tight">
                            {formatPrice(totalUSD, totalZWG || totalUSD * 30)}
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .wizard-sidebar {
                    width: 320px;
                    background: white;
                    border-right: 1px solid #e2e8f0;
                    height: 100vh;
                    position: sticky;
                    top: 0;
                }
            `}</style>
        </div>
    );
}
