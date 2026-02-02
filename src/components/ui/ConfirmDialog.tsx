'use client';

import Button from '@/components/ui/Button';
import { Warning, Trash, Info } from '@phosphor-icons/react';

type DialogVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: DialogVariant;
    isLoading?: boolean;
}

const variantConfig: Record<DialogVariant, { icon: React.ReactNode; color: string; bgColor: string }> = {
    danger: {
        icon: <Trash size={24} weight="duotone" />,
        color: 'var(--color-error)',
        bgColor: 'rgba(239, 68, 68, 0.1)',
    },
    warning: {
        icon: <Warning size={24} weight="duotone" />,
        color: 'var(--color-warning)',
        bgColor: 'rgba(245, 158, 11, 0.1)',
    },
    info: {
        icon: <Info size={24} weight="duotone" />,
        color: 'var(--color-primary)',
        bgColor: 'rgba(78, 154, 247, 0.1)',
    },
};

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false,
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    const config = variantConfig[variant];

    const handleConfirm = () => {
        onConfirm();
    };

    return (
        <>
            <div className="dialog-overlay" onClick={onClose}>
                <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
                    {/* Icon */}
                    <div className="dialog-icon" style={{ background: config.bgColor, color: config.color }}>
                        {config.icon}
                    </div>

                    {/* Content */}
                    <h3 className="dialog-title">{title}</h3>
                    <p className="dialog-message">{message}</p>

                    {/* Actions */}
                    <div className="dialog-actions">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {cancelText}
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            loading={isLoading}
                            style={variant === 'danger' ? {
                                background: 'var(--color-error)',
                                borderColor: 'var(--color-error)',
                            } : undefined}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .dialog-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 200;
                    padding: var(--spacing-lg);
                }

                .dialog-content {
                    background: var(--color-surface);
                    border-radius: var(--radius-xl);
                    width: 100%;
                    max-width: 400px;
                    padding: var(--spacing-xl);
                    text-align: center;
                    box-shadow: var(--shadow-lg);
                }

                .dialog-icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto var(--spacing-lg);
                }

                .dialog-title {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0 0 var(--spacing-sm) 0;
                }

                .dialog-message {
                    font-size: 0.9375rem;
                    color: var(--color-text-secondary);
                    margin: 0 0 var(--spacing-xl) 0;
                    line-height: 1.5;
                }

                .dialog-actions {
                    display: flex;
                    gap: var(--spacing-sm);
                    justify-content: center;
                }

                .dialog-actions :global(button) {
                    flex: 1;
                    max-width: 140px;
                }
            `}</style>
        </>
    );
}
