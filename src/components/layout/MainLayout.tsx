'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import TopNavbar from './TopNavbar';
import { CurrencyProvider } from '../ui/CurrencyToggle';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  fullWidth?: boolean;
}

export default function MainLayout({
  children,
  title,
  fullWidth = false
}: MainLayoutProps) {
  return (
    <CurrencyProvider>
      <div className="app-layout">
        <TopNavbar />
        <main className="main-content">
          {/* Page Content */}
          <div className={`page-content ${fullWidth ? 'full-width' : ''}`}>
            {title && <h1 className="page-title">{title}</h1>}
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-container">
            <div className="footer-left">
              <div className="footer-logo">
                <Image src="/logo.png" alt="ZimEstimate" width={24} height={24} style={{ objectFit: 'contain' }} />
                <span>ZimEstimate © 2026</span>
              </div>
            </div>
            <div className="footer-right">
              <a href="#">Market Reports</a>
              <a href="#">Privacy Policy</a>
              <a href="#">Contact Support</a>
            </div>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .app-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--color-background);
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .page-content {
          flex: 1;
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .page-content.full-width {
          max-width: 100%;
        }

        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-primary);
          margin: 0 0 24px 0;
        }

        .app-footer {
          background: #f4f6fb;
          color: var(--color-text-secondary);
          padding: 20px 0;
          margin-top: auto;
          border-top: 1px solid var(--color-border-light);
        }

        .footer-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .footer-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.875rem;
        }

        .footer-right {
          display: flex;
          gap: 24px;
        }

        .footer-right a {
          color: var(--color-text-secondary);
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.2s ease;
        }

        .footer-right a:hover {
          color: var(--color-primary);
        }

        @media (max-width: 768px) {
          .footer-container {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }

          .footer-right {
            flex-wrap: wrap;
            justify-content: center;
            gap: 16px;
          }
        }
      `}</style>
    </CurrencyProvider>
  );
}
