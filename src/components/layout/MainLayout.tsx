'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TopNavbar from './TopNavbar';
import { CurrencyProvider } from '../ui/CurrencyToggle';
import InstallPromptBanner from '../ui/InstallPromptBanner';
import {
  House,
  Folders,
  Lightning,
  Gear,
} from '@phosphor-icons/react';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  fullWidth?: boolean;
  hideBottomNav?: boolean;
}

function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/home', icon: House },
    { label: 'Projects', href: '/projects/dashboard', icon: Folders },
    { label: 'Quick', href: '/quick-projects', icon: Lightning, isAction: true },
    { label: 'Settings', href: '/settings', icon: Gear },
  ];

  const isActive = (href: string) => {
    if (href === '/home') {
      return pathname === '/home' || pathname === '/';
    }
    if (href === '/projects/dashboard') {
      return pathname.startsWith('/projects');
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav-item ${active ? 'active' : ''} ${item.isAction ? 'action' : ''}`}
          >
            <Icon size={24} weight={active ? 'fill' : 'regular'} />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <style jsx>{`
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 72px;
          background: white;
          border-top: 1px solid var(--color-border-light);
          padding: 8px 16px calc(8px + env(safe-area-inset-bottom, 0px));
          z-index: 100;
          box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
        }

        @media (max-width: 900px) {
          .mobile-bottom-nav {
            display: flex;
            justify-content: space-around;
            align-items: center;
          }
        }

        .mobile-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          text-decoration: none;
          color: var(--color-text-secondary);
          padding: 8px 16px;
          border-radius: 12px;
          transition: all 0.2s;
          min-width: 64px;
        }

        .mobile-nav-item span {
          font-size: 0.7rem;
          font-weight: 500;
        }

        .mobile-nav-item.active {
          color: var(--color-accent);
        }

        .mobile-nav-item.active span {
          font-weight: 600;
        }

        .mobile-nav-item.action {
          background: var(--color-accent);
          color: white;
          border-radius: 16px;
          padding: 8px 20px;
        }

        .mobile-nav-item.action:hover {
          background: var(--color-accent-dark);
        }
      `}</style>
    </nav>
  );
}

export default function MainLayout({
  children,
  title,
  fullWidth = false,
  hideBottomNav = false,
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

        <InstallPromptBanner />
        {!hideBottomNav && <MobileBottomNav />}

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
              <Link href="/market-insights">Market Reports</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/support">Support</Link>
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

        @media (max-width: 900px) {
          .page-content {
            padding-bottom: ${hideBottomNav ? '24px' : '100px'};
          }

          .app-footer {
            padding-bottom: ${hideBottomNav ? '20px' : '88px'};
          }
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
