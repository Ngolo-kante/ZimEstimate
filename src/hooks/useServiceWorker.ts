'use client';

import { useEffect, useState } from 'react';

interface UseServiceWorkerReturn {
    isSupported: boolean;
    isRegistered: boolean;
    isOnline: boolean;
    registration: ServiceWorkerRegistration | null;
    updateAvailable: boolean;
    update: () => Promise<void>;
    cacheEstimate: (projectId: string, data: unknown) => void;
}

export function useServiceWorker(): UseServiceWorkerReturn {
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
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);

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

                console.log('[App] Service Worker registered:', reg.scope);

                // Check for updates
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New version available
                                setUpdateAvailable(true);
                                console.log('[App] New version available!');
                            }
                        });
                    }
                });
            } catch (error) {
                console.error('[App] Service Worker registration failed:', error);
            }
        };

        registerSW();

        // Online/offline listeners
        const handleOnline = () => {
            setIsOnline(true);
            console.log('[App] Back online');
        };

        const handleOffline = () => {
            setIsOnline(false);
            console.log('[App] Gone offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [isSupported]);

    const update = async () => {
        if (registration?.waiting) {
            // Tell the waiting service worker to skip waiting
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });

            // Reload the page to use the new service worker
            window.location.reload();
        }
    };

    const cacheEstimate = (projectId: string, data: unknown) => {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CACHE_ESTIMATE',
                projectId,
                data,
            });
        }
    };

    return {
        isSupported,
        isRegistered,
        isOnline,
        registration,
        updateAvailable,
        update,
        cacheEstimate,
    };
}
