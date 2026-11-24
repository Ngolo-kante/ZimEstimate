'use client';

import BrickLoader from './BrickLoader';
import { CircleNotch, CheckCircle, Circle } from '@phosphor-icons/react';

interface SavingOverlayProps {
    isVisible: boolean;
    message?: string;
    success?: boolean;
    steps?: Array<{ label: string; status: 'pending' | 'active' | 'done' }>;
}

export default function SavingOverlay({
    isVisible,
    message = 'Creating your project...',
    success = false,
    steps = [],
}: SavingOverlayProps) {
    if (!isVisible) return null;

    return (
        <>
            <div className="saving-overlay">
                <div className="saving-content" role="status">
                    <div className="saving-icon">
                        {success ? (
                            <CheckCircle size={48} weight="fill" className="success-icon" />
                        ) : (
                            <BrickLoader />
                        )}
                    </div>
                    <p className="saving-message">{message}</p>
                    {steps.length > 0 && (
                        <div className="saving-steps">
                            {steps.map((step, index) => (
                                <div key={`${step.label}-${index}`} className={`step-row ${step.status}`}>
                                    <span className="step-icon">
                                        {step.status === 'done' && <CheckCircle size={16} weight="fill" />}
                                        {step.status === 'active' && <CircleNotch size={16} weight="bold" className="spinner" />}
                                        {step.status === 'pending' && <Circle size={12} weight="fill" />}
                                    </span>
                                    <span className="step-label">{step.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .saving-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(6, 20, 47, 0.85);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    animation: fadeIn 200ms var(--ease-out);
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                .saving-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: var(--spacing-lg);
                    padding: var(--spacing-2xl);
                    background: var(--color-surface);
                    border-radius: var(--radius-xl);
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    animation: slideUp 200ms var(--ease-out);
                    min-width: 280px;
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                .saving-icon {
                    font-size: 1.75rem;
                    color: var(--color-heading);
                }

                .saving-icon :global(.spinner) {
                    animation: spin 1s linear infinite;
                }

                .saving-icon :global(.success-icon) {
                    color: var(--color-success);
                    animation: none;
                }

                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }



                .saving-message {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0;
                    text-align: center;
                }

                .saving-steps {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                }

                .step-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                }

                .step-row.done {
                    color: var(--pw-ink-15803d);
                }

                .step-row.active {
                    color: var(--color-heading);
                }

                .step-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 18px;
                }

                @media (prefers-reduced-motion: reduce) {
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes slideUp { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes spin { from { opacity: .5; } to { opacity: 1; } }
                }
            `}</style>
        </>
    );
}
