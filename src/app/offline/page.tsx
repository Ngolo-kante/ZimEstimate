'use client';

import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  WifiSlash,
  ArrowClockwise,
  House,
  Folders,
  FileText,
} from '@phosphor-icons/react';

export default function OfflinePage() {
  const refreshPage = () => {
    window.location.reload();
  };

  return (
    <MainLayout title="Offline">
      <div className="offline-page">
        <Card className="offline-card">
          <CardContent>
            <div className="offline-icon">
              <WifiSlash size={48} weight="light" />
            </div>

            <h1>You&apos;re Offline</h1>
            <p className="offline-message">
              It looks like you&apos;ve lost your internet connection. Some features may be unavailable,
              but you can still access cached content.
            </p>

            <Button onClick={refreshPage} icon={<ArrowClockwise size={18} />}>
              Try Again
            </Button>
          </CardContent>
        </Card>

        <div className="available-offline">
          <h2>Available Offline</h2>
          <p>You can still access these features:</p>

          <div className="offline-features">
            <Link href="/home" className="feature-link">
              <Card className="feature-card">
                <CardContent>
                  <House size={24} weight="light" />
                  <span>Home</span>
                </CardContent>
              </Card>
            </Link>
            <Link href="/projects" className="feature-link">
              <Card className="feature-card">
                <CardContent>
                  <Folders size={24} weight="light" />
                  <span>Saved Projects</span>
                </CardContent>
              </Card>
            </Link>
            <Link href="/templates" className="feature-link">
              <Card className="feature-card">
                <CardContent>
                  <FileText size={24} weight="light" />
                  <span>Templates</span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        <div className="offline-tips">
          <h3>Tips for Working Offline</h3>
          <ul>
            <li>Previously viewed projects are cached automatically</li>
            <li>Saved estimates can be exported as PDF even offline</li>
            <li>New changes will sync when you&apos;re back online</li>
            <li>Market prices may be outdated; check when reconnected</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .offline-page {
          max-width: 600px;
          margin: 0 auto;
          padding: var(--spacing-xl) 0;
        }

        .offline-card {
          text-align: center;
          margin-bottom: var(--spacing-xl);
        }

        .offline-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--spacing-lg);
          color: var(--color-error);
        }

        h1 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .offline-message {
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-lg) 0;
          line-height: 1.6;
        }

        .available-offline {
          margin-bottom: var(--spacing-xl);
        }

        .available-offline h2 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .available-offline p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-md) 0;
        }

        .offline-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-md);
        }

        .feature-link {
          text-decoration: none;
        }

        .feature-card {
          text-align: center;
          transition: all 0.2s ease;
        }

        .feature-card:hover {
          transform: translateY(-2px);
          border-color: var(--color-accent);
        }

        .feature-card :global(.card-content) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-sm);
          color: var(--color-text-secondary);
        }

        .feature-card:hover :global(.card-content) {
          color: var(--color-accent);
        }

        .feature-card span {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .offline-tips {
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
        }

        .offline-tips h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-md) 0;
        }

        .offline-tips ul {
          margin: 0;
          padding-left: var(--spacing-lg);
        }

        .offline-tips li {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin-bottom: var(--spacing-xs);
        }

        @media (max-width: 480px) {
          .offline-features {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </MainLayout>
  );
}
