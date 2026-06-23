'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import {
    RocketLaunch,
} from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import MainLayout from '@/components/layout/MainLayout';

function UpgradeContent() {
    return (
        <MainLayout>
            <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                padding: 'var(--spacing-2xl) var(--spacing-xl)',
                textAlign: 'center',
            }}>
                <RocketLaunch size={64} weight="duotone" style={{ color: 'var(--color-primary)', marginBottom: '24px' }} />
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    marginBottom: '16px',
                }}>
                    All Features Are Free!
                </h1>
                <p style={{
                    fontSize: '1.125rem',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.6,
                    marginBottom: '32px',
                }}>
                    During our launch period, every feature on ZimEstimate is completely free.
                    Unlimited projects, AI tools, all export formats, and the full material catalog
                    are available to all users.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/quick-projects">
                        <Button>Start a Quick Project</Button>
                    </Link>
                    <Link href="/projects/dashboard">
                        <Button variant="secondary">Go to Dashboard</Button>
                    </Link>
                </div>
            </div>
        </MainLayout>
    );
}

export default function UpgradePage() {
    return (
        <Suspense fallback={
            <MainLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
                </div>
            </MainLayout>
        }>
            <UpgradeContent />
        </Suspense>
    );
}
