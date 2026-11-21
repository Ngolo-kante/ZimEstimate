'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DescribeChatBubble from '@/components/estimate/DescribeChatBubble';
import { MobileStartButton } from '@/components/projects/StartOptions';
import TopNavbar from './TopNavbar';
import { CurrencyProvider } from '../ui/CurrencyToggle';
import InstallPromptBanner from '../ui/InstallPromptBanner';
import {
  House,
  Folders,
  Calculator,
  Lightning,
  Gear,
} from '@phosphor-icons/react';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  fullWidth?: boolean;
  hideBottomNav?: boolean;
  mobileNavy?: boolean;
}

function MobileBottomNav() {
  const pathname = usePathname();

  // Budget Estimator earns a slot here because it is a top-level destination in
  // the desktop navigation and the main entry point for someone sizing up a
  // build; reaching it from a phone previously meant going through the header
  // menu. Five items is the practical ceiling at 375px.
  const navItems = [
    { label: 'Home', href: '/home', icon: House },
    { label: 'My projects', href: '/projects', icon: Folders },
    { label: 'Budget', href: '/quick-budget', icon: Calculator },
    { label: 'Quick', href: '/quick-projects', icon: Lightning },
    { label: 'Settings', href: '/settings', icon: Gear },
  ];

  const isActive = (href: string) => {
    if (href === '/home') {
      return pathname === '/home' || pathname === '/';
    }
    if (href === '/projects') {
      return pathname.startsWith('/projects');
    }
    // /quick-budget and /quick-projects share a prefix, so a plain startsWith
    // lights up both whenever either is open.
    if (href === '/quick-budget' || href === '/quick-projects') {
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`mobile-nav-item ${active ? 'active' : ''}`}
          >
            <span className="nav-pill">
              <Icon size={22} weight={active ? 'fill' : 'regular'} />
            </span>
            <span className="nav-text">{item.label}</span>
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
          height: 74px;
          background: rgba(255, 255, 255, 0.96);
          border-top: 1px solid #d8e0eb;
          /* 16px side padding cost 32px that five items cannot spare at 375px. */
          padding: 7px 8px calc(6px + env(safe-area-inset-bottom, 0px));
          z-index: 100;
          box-shadow: 0 -8px 24px rgba(11, 31, 59, 0.09);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        @media (max-width: 900px) {
          .mobile-bottom-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 2px;
          }
        }

        /* Five equal items. The old bar gave one of them a filled accent
           background, which read as a primary action button sitting among plain
           icons — and because the active colour was that same accent, whichever
           item was highlighted lost its active state entirely. Every item is
           now treated the same and only the current one is marked. */
        :global(.mobile-nav-item) {
          display: flex;
          flex: 1 1 0;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-decoration: none;
          color: #5b6b82;
          /* Full-height target: the whole column is tappable, not just the icon. */
          padding: 4px 2px;
          min-width: 0;
          border-radius: 8px;
          -webkit-tap-highlight-color: transparent;
        }

        .nav-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 30px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid transparent;
          transition: none;
        }

        .nav-text {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0;
          line-height: 1;
          white-space: nowrap;
        }

        /* Navy rather than the blue accent: on a white bar in daylight it is
           the higher-contrast pair, and site users are often outdoors. */
        :global(.mobile-nav-item.active) {
          color: var(--color-primary);
        }

        :global(.mobile-nav-item.active) .nav-pill {
          color: white;
          background: var(--color-primary);
          border-color: var(--color-primary);
          box-shadow: 0 3px 8px rgba(11, 31, 59, 0.18);
        }

        :global(.mobile-nav-item.active) .nav-text {
          font-weight: 750;
        }

        /* Press feedback. Touch has no hover, so without this a tap on a slow
           page gives no sign it registered. */
        :global(.mobile-nav-item:active) .nav-pill {
          transform: scale(0.88);
        }

        :global(.mobile-nav-item:focus-visible) {
          outline: 3px solid var(--color-accent);
          outline-offset: -3px;
        }

        @media (prefers-reduced-motion: reduce) {
          .nav-pill {
            transition: none;
          }
          :global(.mobile-nav-item:active) .nav-pill {
            transform: none;
          }
        }

        /* Narrow phones: keep five labels on one line each. */
        @media (max-width: 359px) {
          .nav-text {
            font-size: 12px;
          }
          .nav-pill {
            width: 38px;
          }
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
  mobileNavy = false,
}: MainLayoutProps) {
  return (
    <CurrencyProvider>
      <div className="app-layout">
        <TopNavbar />
        <InstallPromptBanner />
        <main className={`main-content${mobileNavy ? ' mobile-navy' : ''}`}>
          {/* Page Content */}
          <div className={`page-content ${fullWidth ? 'full-width' : ''}`}>
            {title && <h1 className="page-title">{title}</h1>}
            {children}
          </div>
        </main>

        {!hideBottomNav && <><MobileBottomNav /><MobileStartButton /></>}

        <DescribeChatBubble />

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-container">
            <div className="footer-left">
              <div className="footer-logo">
                <Image
                  src="/logo.png"
                  alt="ZimEstimate"
                  width={353}
                  height={314}
                  style={{ width: '24px', height: 'auto', objectFit: 'contain' }}
                />
                <span>ZimEstimate © 2026</span>
              </div>
            </div>
            <div className="footer-right">
              <Link href="/cost-to-build-a-house-in-zimbabwe">House Cost Guide</Link>
              <Link href="/market-insights">Market Reports</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/support">Contact support</Link>
              <a href="https://www.facebook.com/profile.php?id=61593040225635" target="_blank" rel="noopener noreferrer">Facebook</a>
              <a href="https://www.tiktok.com/@zimestimate" target="_blank" rel="noopener noreferrer">TikTok</a>
            </div>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .app-layout {
          min-height: 100dvh;
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
          color: #475569;
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

        .footer-right :global(a),
        .footer-right button {
          min-width: 44px;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #475569;
          background: transparent;
          border: 0;
          padding: 0;
          text-decoration: none;
          font-size: 0.875rem;
          font-family: inherit;
          cursor: pointer;
          transition: none;
        }
        @media (hover: hover) and (pointer: fine) {
        @media (hover: hover) and (pointer: fine) {
            .footer-right :global(a:hover),
          .footer-right button:hover {
                color: var(--color-primary);
          }
        }
        }

        @media (max-width: 900px) {
          .page-content {
            padding-bottom: ${hideBottomNav ? '24px' : '100px'};
          }

          .app-footer {
            padding-bottom: ${hideBottomNav ? '20px' : '88px'};
          }
        }

        @media (max-width: 640px) {
          .main-content {
            background: var(--color-primary);
          }

          .main-content:not(.mobile-navy) {
            background: linear-gradient(var(--color-background), var(--color-background))
              center / calc(100% - 24px) 100% no-repeat var(--color-primary);
          }

          .mobile-navy .page-title {
            color: white;
          }

          .mobile-navy {
            --project-breadcrumb-link: var(--color-link-on-navy);
            --focus-on-navy: var(--color-gold-on-navy);
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
        @media (max-width: 767px) {
          .footer-right :global(a), .footer-right button {
            display: inline-flex;
            align-items: center;
            min-height: 44px;
          }
        }
      `}</style>
    </CurrencyProvider>
  );
}
