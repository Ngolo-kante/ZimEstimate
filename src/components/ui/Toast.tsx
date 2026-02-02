'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, Warning, Info, X } from '@phosphor-icons/react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const toastConfig: Record<ToastType, { icon: ReactNode; color: string; bgColor: string }> = {
    success: {
        icon: <CheckCircle size={20} weight="fill" />,
        color: '#22c55e',
        bgColor: 'rgba(34, 197, 94, 0.1)',
    },
    error: {
        icon: <XCircle size={20} weight="fill" />,
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.1)',
    },
    warning: {
        icon: <Warning size={20} weight="fill" />,
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.1)',
    },
    info: {
        icon: <Info size={20} weight="fill" />,
        color: '#4E9AF7',
        bgColor: 'rgba(78, 154, 247, 0.1)',
    },
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
        const id = Math.random().toString(36).substring(2, 9);
        const toast: Toast = { id, type, message, duration };

        setToasts((prev) => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => removeToast(id), duration);
        }
    }, [removeToast]);

    const success = useCallback((message: string, duration?: number) => {
        showToast(message, 'success', duration);
    }, [showToast]);

    const error = useCallback((message: string, duration?: number) => {
        showToast(message, 'error', duration);
    }, [showToast]);

    const warning = useCallback((message: string, duration?: number) => {
        showToast(message, 'warning', duration);
    }, [showToast]);

    const info = useCallback((message: string, duration?: number) => {
        showToast(message, 'info', duration);
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
            {children}

            {/* Toast Container */}
            {toasts.length > 0 && (
                <div className="toast-container">
                    {toasts.map((toast) => {
                        const config = toastConfig[toast.type];
                        return (
                            <div
                                key={toast.id}
                                className="toast"
                                style={{
                                    borderLeftColor: config.color,
                                }}
                            >
                                <span className="toast-icon" style={{ color: config.color }}>
                                    {config.icon}
                                </span>
                                <span className="toast-message">{toast.message}</span>
                                <button
                                    className="toast-close"
                                    onClick={() => removeToast(toast.id)}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <style jsx>{`
                .toast-container {
                    position: fixed;
                    bottom: var(--spacing-lg);
                    right: var(--spacing-lg);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    max-width: 400px;
                }

                .toast {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-md) var(--spacing-lg);
                    background: var(--color-surface);
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-lg);
                    border-left: 4px solid;
                    animation: slideIn 0.3s ease;
                }

                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }

                .toast-icon {
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                }

                .toast-message {
                    flex: 1;
                    font-size: 0.875rem;
                    color: var(--color-text);
                    line-height: 1.4;
                }

                .toast-close {
                    background: none;
                    border: none;
                    padding: 4px;
                    cursor: pointer;
                    color: var(--color-text-muted);
                    border-radius: var(--radius-sm);
                    flex-shrink: 0;
                }

                .toast-close:hover {
                    background: var(--color-border-light);
                    color: var(--color-text);
                }

                @media (max-width: 480px) {
                    .toast-container {
                        left: var(--spacing-md);
                        right: var(--spacing-md);
                        bottom: var(--spacing-md);
                        max-width: none;
                    }
                }
            `}</style>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
