'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CaretDown,
  List,
  X,
  User,
  Gear,
  SignOut,
  Crown,
} from '@phosphor-icons/react';
import { CurrencyToggle } from '@/components/ui/CurrencyToggle';
import { useAuth } from '@/components/providers/AuthProvider';

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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut, isAuthenticated } = useAuth();

  const isActive = (href: string) => {
    if (href === '/home') {
      return pathname === '/' || pathname === '/home';
    }
    return pathname.startsWith(href);
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setProfileMenuOpen(false);
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

          {/* Profile Menu */}
          <div className="profile-menu-container" ref={profileMenuRef}>
            <button
              className="user-btn"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              aria-label="User menu"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="user-avatar-img" />
              ) : (
                <User size={18} weight="bold" />
              )}
            </button>

            {profileMenuOpen && (
              <div className="profile-dropdown">
                {isAuthenticated ? (
                  <>
                    <div className="profile-header">
                      <div className="profile-avatar">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" />
                        ) : (
                          <User size={20} weight="light" />
                        )}
                      </div>
                      <div className="profile-info">
                        <span className="profile-name">{profile?.full_name || 'User'}</span>
                        <span className="profile-email">{user?.email}</span>
                        {profile?.tier && (
                          <span className={`profile-tier ${profile.tier}`}>
                            {profile.tier === 'pro' && <Crown size={12} weight="fill" />}
                            {profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="profile-divider" />
                    <Link
                      href="/settings"
                      className="profile-menu-item"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      <Gear size={18} weight="light" />
                      Settings
                    </Link>
                    {profile?.tier === 'free' && (
                      <Link
                        href="/upgrade"
                        className="profile-menu-item upgrade"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <Crown size={18} weight="fill" />
                        Upgrade to Pro
                      </Link>
                    )}
                    <div className="profile-divider" />
                    <button className="profile-menu-item logout" onClick={handleSignOut}>
                      <SignOut size={18} weight="light" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/login"
                      className="profile-menu-item"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      <User size={18} weight="light" />
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

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

        .user-btn .user-avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        /* Profile Menu */
        .profile-menu-container {
          position: relative;
        }

        .profile-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 280px;
          background: white;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          z-index: 200;
          overflow: hidden;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .profile-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: var(--color-background);
        }

        .profile-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          overflow: hidden;
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .profile-name {
          font-weight: 600;
          font-size: 0.9375rem;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .profile-email {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .profile-tier {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 6px;
          border-radius: 4px;
          width: fit-content;
          margin-top: 4px;
        }

        .profile-tier.free {
          background: var(--color-border-light);
          color: var(--color-text-secondary);
        }

        .profile-tier.pro {
          background: var(--color-accent);
          color: var(--color-primary);
        }

        .profile-tier.admin {
          background: var(--color-primary);
          color: white;
        }

        .profile-divider {
          height: 1px;
          background: var(--color-border-light);
          margin: 4px 0;
        }

        .profile-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 16px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          background: none;
          border: none;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .profile-menu-item:hover {
          background: var(--color-background);
          color: var(--color-text);
        }

        .profile-menu-item.upgrade {
          color: var(--color-accent-dark);
        }

        .profile-menu-item.upgrade:hover {
          background: rgba(78, 154, 247, 0.1);
        }

        .profile-menu-item.logout {
          color: var(--color-error);
        }

        .profile-menu-item.logout:hover {
          background: rgba(239, 68, 68, 0.1);
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
