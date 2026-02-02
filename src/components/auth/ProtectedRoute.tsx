'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAuth?: boolean;
    requireTier?: 'free' | 'pro' | 'admin';
    requireAIAccess?: boolean;
    fallbackUrl?: string;
}

export default function ProtectedRoute({
    children,
    requireAuth = true,
    requireTier,
    requireAIAccess = false,
    fallbackUrl = '/auth/login',
}: ProtectedRouteProps) {
    const router = useRouter();
    const { isAuthenticated, isLoading, profile, canUseAIFeatures } = useAuth();

    useEffect(() => {
        if (isLoading) return;

        // Check authentication
        if (requireAuth && !isAuthenticated) {
            router.push(fallbackUrl);
            return;
        }

        // Check tier requirement
        if (requireTier && profile) {
            const tierHierarchy = { free: 0, pro: 1, admin: 2 };
            const userTierLevel = tierHierarchy[profile.tier];
            const requiredTierLevel = tierHierarchy[requireTier];

            if (userTierLevel < requiredTierLevel) {
                router.push('/upgrade');
                return;
            }
        }

        // Check AI access
        if (requireAIAccess && !canUseAIFeatures()) {
            router.push('/upgrade?feature=ai');
            return;
        }
    }, [isAuthenticated, isLoading, profile, requireAuth, requireTier, requireAIAccess, canUseAIFeatures, router, fallbackUrl]);

    // Show loading state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
                    <p className="text-[var(--color-text-secondary)]">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render if not authenticated (when required)
    if (requireAuth && !isAuthenticated) {
        return null;
    }

    // Don't render if tier requirement not met
    if (requireTier && profile) {
        const tierHierarchy = { free: 0, pro: 1, admin: 2 };
        const userTierLevel = tierHierarchy[profile.tier];
        const requiredTierLevel = tierHierarchy[requireTier];

        if (userTierLevel < requiredTierLevel) {
            return null;
        }
    }

    // Don't render if AI access required but not available
    if (requireAIAccess && !canUseAIFeatures()) {
        return null;
    }

    return <>{children}</>;
}

// Higher-order component for page-level protection
export function withAuth<P extends object>(
    Component: React.ComponentType<P>,
    options: Omit<ProtectedRouteProps, 'children'> = {}
) {
    return function ProtectedPage(props: P) {
        return (
            <ProtectedRoute {...options}>
                <Component {...props} />
            </ProtectedRoute>
        );
    };
}
