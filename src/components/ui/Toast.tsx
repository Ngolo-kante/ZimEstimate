'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Toaster } from '@/components/shadcn/sonner';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Stable callbacks preserve callers' effect dependencies. A nonpositive duration
// retains the previous API's persistent-until-dismissed behavior.
const showToast: ToastContextType['showToast'] = (message, type = 'info', duration) => {
    toast[type](message, {
        duration: duration === undefined ? (type === 'error' ? 6000 : 4000) : duration > 0 ? duration : Infinity,
        closeButton: true,
    });
};
const notifications: ToastContextType = {
    showToast,
    success: (message, duration) => showToast(message, 'success', duration),
    error: (message, duration) => showToast(message, 'error', duration),
    warning: (message, duration) => showToast(message, 'warning', duration),
    info: (message, duration) => showToast(message, 'info', duration),
};

export function ToastProvider({ children }: { children: ReactNode }) {
    return (
        <ToastContext.Provider value={notifications}>
            {children}
            <Toaster position="bottom-center" closeButton />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) throw new Error('useToast must be used within a ToastProvider');
    return context;
}
