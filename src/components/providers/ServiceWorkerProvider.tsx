'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ServiceWorkerContextType {
    isSupported: boolean;
    isRegistered: boolean;
    isOnline: boolean;
    updateAvailable: boolean;
    update: () => Promise<void>;
}

const ServiceWorkerContext = createContext<ServiceWorkerContextType>({
    isSupported: false,
    isRegistered: false,
    isOnline: true,
    updateAvailable: false,
    update: async () => { },
});

export function useServiceWorkerContext() {
    return useContext(ServiceWorkerContext);
}

interface ServiceWorkerProviderProps {
    children: ReactNode;
}

export function ServiceWorkerProvider({ children }: ServiceWorkerProviderProps) {
    const [isSupported] = useState(() => {
        if (typeof window !== 'undefined') {
            return 'serviceWorker' in navigator;
        }
        return false;
    });
    const [isRegistered, setIsRegistered] = useState(false);
    const [isOnline, setIsOnline] = useState(() => {
        if (typeof window !== 'undefined') {
            return navigator.onLine;
        }
        return true;
    });
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !isSupported) return;

        // Register service worker
        const registerSW = async () => {
            try {
                const reg = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                });

                setRegistration(reg);
                setIsRegistered(true);

                // Check for updates
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                setUpdateAvailable(true);
                            }
                        });
                    }
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        };

        registerSW();

        // Online/offline listeners
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [isSupported]);

    const update = async () => {
        if (registration?.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        }
    };

    return (
        <ServiceWorkerContext.Provider
            value={{
                isSupported,
                isRegistered,
                isOnline,
                updateAvailable,
                update,
            }}
        >
            {children}
        </ServiceWorkerContext.Provider>
    );
}
