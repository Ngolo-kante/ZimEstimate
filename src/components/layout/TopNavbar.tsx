'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Bell,
  CaretDown,
  List,
  X,
  User,
} from '@phosphor-icons/react';
import { CurrencyToggle } from '@/components/ui/CurrencyToggle';

interface NavItem {
  label: string;
  href: string;
  hasDropdown?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/home' },
  { label: 'Projects', href: '/projects' },
  { label: 'Market Insights', href: '/market-insights', hasDropdown: true },
  { label: 'Materials', href: '/marketplace' },
  { label: 'AI Tools', href: '/ai' },
];

export default function TopNavbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/home') {
      return pathname === '/' || pathname === '/home';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="top-navbar">
      <div className="navbar-container">
        {/* Logo - PropTech Trend Concept */}
        <Link href="/home" className="logo">
          <div className="logo-icon">
            <img src="/logo.png" alt="ZimEstimate" width={36} height={36} />
          </div>
          <span className="logo-text">ZimEstimate</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive(item.href) ? 'active' : ''}`}
            >
              <span className="nav-label">{item.label}</span>
              {item.hasDropdown && <CaretDown size={14} weight="bold" className="dropdown-icon" />}
            </Link>
          ))}
        </nav>

        {/* Right Section */}
        <div className="navbar-right">
          <CurrencyToggle />
          <button className="icon-btn notification-btn">
            <Bell size={20} weight="regular" />
            <span className="notification-dot" />
          </button>
          <button className="user-btn">
            <User size={18} weight="bold" />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <nav className="mobile-nav">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-nav-link ${isActive(item.href) ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <style jsx>{`
        .top-navbar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: white;
          border-bottom: 1px solid var(--color-border);
        }

        .navbar-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }

        .logo-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-text {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--color-primary);
          letter-spacing: -0.02em;
        }

        .desktop-nav {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          padding: 8px 16px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .nav-link:hover {
          color: var(--color-primary);
          background: var(--color-border-light);
        }

        .nav-link.active {
          color: var(--color-primary);
          font-weight: 600;
          background: rgba(78, 154, 247, 0.15);
        }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .icon-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          border-radius: 8px;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .icon-btn:hover {
          background: var(--color-border-light);
          color: var(--color-primary);
        }

        .notification-btn {
          position: relative;
        }

        .notification-dot {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 8px;
          height: 8px;
          background: var(--color-error);
          border-radius: 50%;
          border: 2px solid white;
        }

        .user-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-primary);
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .user-btn:hover {
          background: var(--color-primary-light);
        }

        .mobile-toggle {
          display: none;
          width: 40px;
          height: 40px;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: var(--color-text);
          cursor: pointer;
        }

        .mobile-menu {
          display: none;
          background: white;
          border-top: 1px solid var(--color-border);
          padding: 16px 24px;
        }

        .mobile-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mobile-nav-link {
          padding: 12px 16px;
          font-size: 1rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .mobile-nav-link:hover,
        .mobile-nav-link.active {
          background: var(--color-border-light);
          color: var(--color-primary);
        }

        @media (max-width: 900px) {
          .desktop-nav {
            display: none;
          }

          .mobile-toggle {
            display: flex;
          }

          .mobile-menu {
            display: block;
          }

          .notification-btn {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
