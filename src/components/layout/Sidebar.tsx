'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  Folders,
  Sparkle,
  TrendUp,
  Storefront,
  Lightning,
  Gear,
  User,
  SignOut,
} from '@phosphor-icons/react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const mainNavItems: NavItem[] = [
  { label: 'Home', href: '/home', icon: <House size={20} weight="light" /> },
  { label: 'Projects', href: '/projects', icon: <Folders size={20} weight="light" /> },
  { label: 'AI Tools', href: '/ai', icon: <Lightning size={20} weight="fill" /> },
  { label: 'Marketplace', href: '/marketplace', icon: <Storefront size={20} weight="light" /> },
  { label: 'Templates', href: '/templates', icon: <Sparkle size={20} weight="light" /> },
  { label: 'Market Insights', href: '/market-insights', icon: <TrendUp size={20} weight="light" /> },
];

const bottomNavItems: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: <Gear size={20} weight="light" /> },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/home') {
      return pathname === '/home' || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Abstract Z shape formed by trend lines */}
            <path d="M6 24L12 16L18 20L26 8" stroke="#4E9AF7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M26 8H18" stroke="#4E9AF7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M26 8V16" stroke="#4E9AF7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {/* Supporting structure */}
            <rect x="6" y="26" width="4" height="4" rx="2" fill="var(--color-text-inverse)" />
            <rect x="16" y="26" width="4" height="4" rx="2" fill="var(--color-text-inverse)" />
            <rect x="26" y="26" width="4" height="4" rx="2" fill="var(--color-text-inverse)" />
          </svg>
        </div>
        <span className="logo-text">ZimEstimate</span>
      </div>

      {/* Main Navigation */}
      <nav className="sidebar-nav">
        <ul className="nav-list">
          {mainNavItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="sidebar-bottom">
        <ul className="nav-list">
          {bottomNavItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* User Profile */}
        <div className="user-profile">
          <div className="user-avatar">
            <User size={20} weight="light" />
          </div>
          <div className="user-info">
            <span className="user-name">Guest User</span>
            <span className="user-email">Sign in</span>
          </div>
          <button className="logout-btn" aria-label="Sign out">
            <SignOut size={18} weight="light" />
          </button>
        </div>
      </div>

      <style jsx>{`
        .sidebar {
          width: 260px;
          height: 100vh;
          background: var(--color-primary);
          color: var(--color-text-inverse);
          display: flex;
          flex-direction: column;
          padding: var(--spacing-lg);
          position: fixed;
          left: 0;
          top: 0;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding-bottom: var(--spacing-xl);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: var(--spacing-lg);
        }

        .logo-text {
          font-size: 1.25rem;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .sidebar-nav {
          flex: 1;
        }

        .nav-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-md);
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text-inverse);
        }

        .nav-item.active {
          background: var(--color-accent);
          color: var(--color-primary);
        }

        .nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nav-label {
          font-size: 0.9375rem;
          font-weight: 500;
        }

        .sidebar-bottom {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: var(--spacing-lg);
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-md);
          margin-top: var(--spacing-md);
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .user-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .user-name {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .user-email {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.5);
        }

        .logout-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          padding: var(--spacing-xs);
          border-radius: var(--radius-sm);
          transition: all 0.2s ease;
        }

        .logout-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text-inverse);
        }
      `}</style>
    </aside>
  );
}
