'use client';

import Link from 'next/link';
import Image from 'next/image';
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
  Storefront,
  Briefcase,
  ChartLineUp,
  ChatCircleText,
  Folders,
} from '@phosphor-icons/react';
import { useAuth } from '@/components/providers/AuthProvider';

interface NavItem {
  label: string;
  href: string;
  description?: string;
  /** Highlight when the path starts with this instead of href — lets
      "My Projects" stay lit on /projects and /projects/[id], not only on
      its own landing URL. */
  activePrefix?: string;
  hasDropdown?: boolean;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Home', href: '/home' },
  { label: 'Budget Estimator', href: '/quick-budget' },
  { label: 'My Projects', href: '/projects', activePrefix: '/projects' },
  { label: 'Quick Projects', href: '/quick-projects' },
  { label: 'Market Insights', href: '/market-insights' },
  { label: 'Templates', href: '/templates' },
  { label: 'Marketplace', href: '/marketplace' },
  // Sits beside Marketplace: both are directories of businesses, one of
  // materials and one of the people who fit them.
  { label: 'Contractors Directory', href: '/contractors' },
];

const primaryNavItems = navItems.slice(0, 4);
const exploreNavItems: NavItem[] = [
  { label: 'Market Insights', href: '/market-insights', description: 'Track current material prices' },
  { label: 'Templates', href: '/templates', description: 'Start from a proven build' },
  { label: 'Marketplace', href: '/marketplace', description: 'Find materials and suppliers' },
  { label: 'Contractors', href: '/contractors', description: 'Browse verified professionals' },
];

export default function TopNavbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [exploreMenuOpen, setExploreMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const exploreMenuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut, isAuthenticated } = useAuth();
  const isAdmin = profile?.user_type === 'admin' || profile?.tier === 'admin';

  const isActive = (item: NavItem) => {
    return pathname.startsWith(item.activePrefix ?? item.href);
  };

  /* Notification State */
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  // No live feed is wired to the navbar yet. Until one is, show an honest
  // empty state — the previous hardcoded samples ("Project 'Harare Home'
  // created 2 mins ago") rendered for every visitor, alongside a permanent
  // unread dot signalling activity that did not exist.
  const notifications: { id: number; title: string; time: string; unread: boolean }[] = [];
  const hasUnread = notifications.some((note) => note.unread);

  /* Close menus when clicking outside */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Profile menu
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      // Notification menu
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) {
        setNotificationMenuOpen(false);
      }
      if (exploreMenuRef.current && !exploreMenuRef.current.contains(event.target as Node)) {
        setExploreMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
        setNotificationMenuOpen(false);
        setMobileMenuOpen(false);
        setExploreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Account';
  const tierLabel = profile?.tier === 'pro' ? 'Pro plan' : profile?.tier === 'admin' ? 'Admin' : 'Free plan';

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
            <Image
              src="/logo.png"
              alt="ZimEstimate"
              width={353}
              height={314}
              style={{ width: '36px', height: 'auto' }}
            />
          </div>
          <span className="logo-text">ZimEstimate</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          {primaryNavItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive(item) ? 'active' : ''}`}
            >
              <span className="nav-label">{item.label}</span>
              {item.hasDropdown && <CaretDown size={14} weight="bold" className="dropdown-icon" />}
            </Link>
          ))}
          <div className="nav-menu-container" ref={exploreMenuRef}>
            <button
              className={`nav-link nav-menu-trigger ${exploreNavItems.some(isActive) ? 'active' : ''}`}
              onClick={() => {
                setExploreMenuOpen(!exploreMenuOpen);
                setProfileMenuOpen(false);
                setNotificationMenuOpen(false);
              }}
              aria-expanded={exploreMenuOpen}
              aria-controls="explore-menu"
            >
              Explore
              <CaretDown size={14} weight="bold" aria-hidden="true" />
            </button>
            {exploreMenuOpen && (
              <div className="nav-dropdown" id="explore-menu">
                <span className="nav-dropdown-label">Discover ZimEstimate</span>
                {exploreNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-dropdown-link ${isActive(item) ? 'active' : ''}`}
                    onClick={() => setExploreMenuOpen(false)}
                  >
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Right Section */}
        <div className="navbar-right">
          {/* Notification Menu */}
          <div className="menu-container" ref={notificationMenuRef}>
            <button
              className={`icon-btn notification-btn ${notificationMenuOpen ? 'active' : ''}`}
              onClick={() => {
                setNotificationMenuOpen(!notificationMenuOpen);
                setProfileMenuOpen(false);
                setExploreMenuOpen(false);
              }}
              aria-label="Notifications"
              aria-expanded={notificationMenuOpen}
              aria-controls="notification-menu"
            >
              <Bell size={20} weight={notificationMenuOpen ? 'fill' : 'regular'} />
              {hasUnread && <span className="notification-dot" />}
            </button>

            {notificationMenuOpen && (
              <div className="dropdown-menu notification-dropdown" id="notification-menu">
                <div className="dropdown-header">
                  <h3>Notifications</h3>
                  {hasUnread && (
                    <button className="text-xs text-blue-600 font-medium hover:text-blue-700">Mark all read</button>
                  )}
                </div>
                <div className="notification-list">
                  {notifications.length === 0 && (
                    <div className="notification-empty">
                      <Bell size={20} weight="duotone" aria-hidden="true" />
                      <p>You&apos;re all caught up.</p>
                    </div>
                  )}
                  {notifications.map(note => (
                    <div key={note.id} className={`notification-item ${note.unread ? 'unread' : ''}`}>
                      <div className="notification-icon">
                        <Bell size={14} weight="fill" />
                      </div>
                      <div className="notification-content">
                        <p className="notification-title">{note.title}</p>
                        <span className="notification-time">{note.time}</span>
                      </div>
                      {note.unread && <div className="unread-dot"></div>}
                    </div>
                  ))}
                </div>
                <div className="dropdown-footer">
                  <Link href="/notifications" className="view-all-link">View all activity</Link>
                </div>
              </div>
            )}
          </div>

          {/* Profile Menu */}
          <div className="menu-container" ref={profileMenuRef}>
            <button
              className={`user-btn ${profileMenuOpen ? 'active' : ''}`}
              onClick={() => {
                setProfileMenuOpen(!profileMenuOpen);
                setNotificationMenuOpen(false);
                setMobileMenuOpen(false);
                setExploreMenuOpen(false);
              }}
              aria-label="User menu"
              aria-expanded={profileMenuOpen}
              aria-controls="profile-menu"
            >
              <span className="trigger-avatar">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.full_name ? `${profile.full_name} avatar` : 'User avatar'}
                    width={34}
                    height={34}
                    className="user-avatar-img"
                    unoptimized
                  />
                ) : (
                  <User size={20} weight="fill" />
                )}
              </span>
              <span className="trigger-copy" aria-hidden="true">
                <span className="trigger-name">{isAuthenticated ? displayName : 'Sign in'}</span>
                <span className="trigger-meta">{isAuthenticated ? tierLabel : 'Your account'}</span>
              </span>
              <CaretDown
                size={14}
                weight="bold"
                className={`profile-caret ${profileMenuOpen ? 'open' : ''}`}
                aria-hidden="true"
              />
            </button>

            {profileMenuOpen && (
              <div className="dropdown-menu profile-dropdown" id="profile-menu">
                {isAuthenticated ? (
                  <>
                    <div className="profile-header">
                      <div className="profile-avatar">
                        {profile?.avatar_url ? (
                          <Image
                            src={profile.avatar_url}
                            alt={profile.full_name ? `${profile.full_name} avatar` : 'User avatar'}
                            width={40}
                            height={40}
                            unoptimized
                          />
                        ) : (
                          <User size={20} weight="light" />
                        )}
                      </div>
                      <div className="profile-info">
                        <span className="profile-name">{displayName}</span>
                        <span className="profile-email">{user?.email}</span>
                        <span className={`profile-tier ${profile?.tier || 'free'}`}>{tierLabel}</span>
                      </div>
                    </div>
                    <div className="menu-section">
                      <span className="menu-section-label">Workspace</span>
                      <Link
                        href="/projects"
                        className="quick-link"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <span className="quick-link-icon"><Folders size={17} weight="duotone" /></span>
                        <span className="quick-link-copy">
                          <strong>My projects</strong>
                          <small>Builds, estimates and activity</small>
                        </span>
                      </Link>
                    </div>
                    <div className="menu-divider" />
                    <div className="menu-section compact">
                      <span className="menu-section-label">Account</span>
                    <Link
                      href="/settings"
                      className="quick-link"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                        <span className="quick-link-icon"><Gear size={17} weight="duotone" /></span>
                        <span className="quick-link-copy"><strong>Account settings</strong></span>
                    </Link>
                    <Link
                      href="/support"
                      className="quick-link"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                        <span className="quick-link-icon"><ChatCircleText size={17} weight="duotone" /></span>
                        <span className="quick-link-copy"><strong>Help &amp; support</strong></span>
                    </Link>
                    </div>
                    <div className="menu-divider" />
                    <button className="menu-item logout" onClick={handleSignOut}>
                      <SignOut size={18} weight="duotone" />
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <div className="auth-prompt">
                      <div className="auth-intro">
                        <strong>Keep your estimates moving</strong>
                        <span>Sign in to save projects, BOQs and supplier activity.</span>
                      </div>
                      <Link
                        href="/auth/login"
                        className="auth-btn auth-btn-primary"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/auth/signup"
                        className="auth-btn auth-btn-secondary"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        Create Account
                      </Link>
                    </div>
                    <div className="menu-divider" />
                    <div className="menu-section compact">
                      <span className="menu-section-label">Join the directory</span>
                      <Link
                        href="/supplier/register"
                        className="quick-link"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <span className="quick-link-icon"><Storefront size={17} weight="duotone" /></span>
                        <span className="quick-link-copy"><strong>Register as a supplier</strong></span>
                      </Link>
                      <Link
                        href="/contractor/register"
                        className="quick-link"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <span className="quick-link-icon"><Briefcase size={17} weight="duotone" /></span>
                        <span className="quick-link-copy"><strong>Register as a contractor</strong></span>
                      </Link>
                    </div>
                    <div className="menu-divider" />
                    <div className="menu-section compact">
                      <span className="menu-section-label">Explore</span>
                      <Link
                        href="/marketplace"
                        className="quick-link"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <span className="quick-link-icon"><Storefront size={17} weight="duotone" /></span>
                        <span className="quick-link-copy"><strong>Browse marketplace</strong></span>
                      </Link>
                      <Link
                        href="/market-insights"
                        className="quick-link"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <span className="quick-link-icon"><ChartLineUp size={17} weight="duotone" /></span>
                        <span className="quick-link-copy"><strong>Live material prices</strong></span>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-toggle"
            onClick={() => {
              setMobileMenuOpen(!mobileMenuOpen);
              setProfileMenuOpen(false);
              setNotificationMenuOpen(false);
              setExploreMenuOpen(false);
            }}
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu" id="mobile-navigation">
          <nav className="mobile-nav">
            {navItems
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-nav-link ${isActive(item) ? 'active' : ''}`}
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
          background: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid var(--color-border-light);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
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

        /* Nav links styles */
        .desktop-nav {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .nav-link {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          padding: 20px 0; /* Add vertical padding for clickable area */
          font-size: 0.9375rem; /* Slightly larger for readability */
          font-weight: 500;
          color: var(--color-text-secondary);
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .nav-menu-container {
          position: relative;
        }

        .nav-menu-trigger {
          border: 0;
          background: transparent;
          cursor: pointer;
          font-family: inherit;
        }

        .nav-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: -12px;
          width: 276px;
          padding: 8px;
          background: #fff;
          border: 1px solid #d8e0eb;
          border-radius: 8px;
          box-shadow: 0 18px 44px rgba(11, 31, 59, 0.16);
          animation: slideUpFade 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .nav-dropdown-label {
          display: block;
          padding: 6px 8px 7px;
          color: var(--color-text-muted);
          font-size: 0.66rem;
          font-weight: 750;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        :global(.nav-dropdown-link) {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 10px 9px;
          border-radius: 6px;
          color: var(--color-text-secondary);
          text-decoration: none;
          transition: background 0.15s ease, color 0.15s ease;
        }

        :global(.nav-dropdown-link:hover),
        :global(.nav-dropdown-link.active) {
          color: var(--color-primary);
          background: #f2f6fa;
        }

        :global(.nav-dropdown-link strong) {
          font-size: 0.82rem;
          font-weight: 700;
          line-height: 1.2;
        }

        :global(.nav-dropdown-link small) {
          color: var(--color-text-muted);
          font-size: 0.7rem;
          line-height: 1.3;
        }

        .nav-link::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 2px;
          background-color: var(--color-primary);
          transition: width 0.25s ease;
        }

        .nav-link:hover {
          color: var(--color-text);
        }

        .nav-link:hover::after {
          width: 100%;
        }

        .nav-link.active {
          color: var(--color-primary);
          font-weight: 600;
        }
        
        .nav-link.active::after {
          width: 100%;
        }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Generic Menu Container */
        .menu-container {
          position: relative;
        }

        /* Dropdowns */
        .dropdown-menu {
          position: absolute;
          top: calc(100% + 12px);
          right: -8px;
          width: 300px;
          background: white;
          border: 1px solid #d8e0eb;
          border-radius: 8px;
          box-shadow: 0 18px 44px rgba(11, 31, 59, 0.16);
          z-index: 200;
          overflow: hidden;
          animation: slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          transform-origin: top right;
        }
        
        .notification-dropdown {
          width: 320px;
        }

        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(4px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Icon Buttons */
        .icon-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 12px;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .icon-btn:hover, .icon-btn.active {
          background: rgba(0,0,0,0.04);
          color: var(--color-text);
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
          background: #ef4444;
          border-radius: 50%;
          border: 2px solid white;
        }

        /* User Button */
        .user-btn {
          width: auto;
          min-width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          border: 1px solid var(--color-border-light);
          border-radius: 8px;
          color: var(--color-text);
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0 8px 0 0;
          gap: 8px;
        }

        .user-btn:hover, .user-btn.active {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .trigger-avatar {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          overflow: hidden;
          border-radius: 7px 0 0 7px;
          color: #fff;
          background: var(--color-primary);
        }

        .user-btn .user-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .trigger-copy {
          width: 108px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1px;
          text-align: left;
        }

        .trigger-name,
        .trigger-meta {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .trigger-name {
          color: var(--color-text);
          font-size: 0.78rem;
          font-weight: 700;
          line-height: 1.2;
        }

        .trigger-meta {
          color: var(--color-text-muted);
          font-size: 0.68rem;
          line-height: 1.2;
        }

        .profile-caret {
          color: var(--color-text-muted);
          transition: transform 0.18s ease;
        }

        .profile-caret.open {
          transform: rotate(180deg);
        }

        /* Profile Menu Content */
        .profile-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f7f9fc;
          border-bottom: 1px solid var(--color-border-light);
        }

        .profile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          overflow: hidden;
          font-size: 0.875rem;
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
          font-size: 0.9rem;
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
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0;
            padding: 3px 7px;
            border-radius: 4px;
            width: fit-content;
            margin-top: 2px;
        }
        
        .profile-tier.free { background: #f3f4f6; color: #6b7280; }
        .profile-tier.pro { background: #eff6ff; color: #3b82f6; }
        .profile-tier.admin { background: #1f2937; color: #fff; }

        .menu-divider {
          height: 1px;
          background: var(--color-border-light);
          margin: 4px 0;
        }

        .menu-section {
          padding: 10px 8px;
        }

        .menu-section.compact {
          padding-bottom: 8px;
        }

        .menu-section-label {
          display: block;
          padding: 0 8px 6px;
          color: var(--color-text-muted);
          font-size: 0.66rem;
          font-weight: 750;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        /* Signed-out state — primary/secondary pill buttons, matching a
           two-tier sign-in/create-account hierarchy rather than one small
           text link. */
        .auth-prompt {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .auth-intro {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 3px;
        }

        .auth-intro strong {
          color: var(--color-text);
          font-size: 0.92rem;
          font-weight: 750;
          line-height: 1.25;
        }

        .auth-intro span {
          color: var(--color-text-muted);
          font-size: 0.74rem;
          line-height: 1.4;
        }

        /* Same styled-jsx + <Link> scoping limitation as .mobile-nav-link
           above — these render on Link, so they need :global() to match. */
        :global(.auth-btn) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 12px 16px;
          border-radius: 7px;
          font-size: 0.9rem;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
          box-sizing: border-box;
        }

        :global(.auth-btn-primary) {
          background: var(--color-primary);
          color: #fff;
          border: 1px solid var(--color-primary);
        }

        :global(.auth-btn-primary:hover) {
          background: var(--color-primary-dark);
        }

        :global(.auth-btn-secondary) {
          background: transparent;
          color: var(--color-primary);
          border: 1px solid var(--color-primary);
        }

        :global(.auth-btn-secondary:hover) {
          background: var(--color-primary-bg);
        }

        /* Sign-in-free quick actions below the auth buttons. Dedicated class
           (not a reuse of .menu-item, which has this same Link + styled-jsx
           scoping issue) so padding/font-size/color are guaranteed to apply. */
        :global(.quick-link) {
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          padding: 9px 8px;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          text-decoration: none;
          box-sizing: border-box;
          transition: background 0.15s ease, color 0.15s ease;
          border-radius: 6px;
        }

        :global(.quick-link:hover) {
          background: #f2f6fa;
          color: var(--color-primary);
        }

        .quick-link-icon {
          width: 32px;
          height: 32px;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          color: var(--color-primary);
          background: #eaf0f7;
        }

        .quick-link-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .quick-link-copy strong {
          color: inherit;
          font-size: 0.82rem;
          font-weight: 650;
          line-height: 1.2;
        }

        .quick-link-copy small {
          color: var(--color-text-muted);
          font-size: 0.7rem;
          line-height: 1.25;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 11px 16px;
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

        .menu-item:hover {
          background: #f9fafb;
          color: var(--color-text);
        }

        .menu-item.upgrade { color: #2563eb; }
        .menu-item.logout { color: #ef4444; }
        .menu-item.logout:hover { background: #fef2f2; }
        
        /* Notifications Specific */
        .dropdown-header {
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid var(--color-border-light);
        }
        
        .dropdown-header h3 {
            margin: 0;
            font-size: 0.95rem;
            font-weight: 600;
            color: var(--color-text);
        }
        
        .notification-list {
            max-height: 320px;
            overflow-y: auto;
        }

        .notification-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 28px 16px;
            color: var(--color-text-muted);
        }

        .notification-empty p {
            margin: 0;
            font-size: 0.85rem;
            font-weight: 500;
        }
        
        .notification-item {
            padding: 12px 16px;
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 12px;
            align-items: start;
            border-bottom: 1px solid var(--color-border-light);
            transition: bg 0.2s;
            cursor: pointer;
        }
        
        .notification-item:hover {
            background: #f9fafb;
        }
        
        .notification-item:last-child { border-bottom: none; }
        
        .notification-item.unread {
            background: #f8fafc;
        }
        
        .notification-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #eff6ff;
            color: #3b82f6;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        
        .notification-content {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .notification-title {
            margin: 0;
            font-size: 0.85rem;
            font-weight: 600; /* Bolder title */
            color: var(--color-text);
            line-height: 1.4;
        }
        
        .notification-time {
            font-size: 0.75rem;
            color: var(--color-text-muted);
        }
        
        .unread-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #2563eb;
            margin-top: 6px;
        }
        
        .dropdown-footer {
            padding: 12px;
            text-align: center;
            background: #f9fafb;
            border-top: 1px solid var(--color-border-light);
        }
        
        .view-all-link {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--color-text-secondary);
            text-decoration: none;
        }
        
        .view-all-link:hover {
            color: var(--color-primary);
        }

        .mobile-toggle {
          display: none;
        }

        /* Mobile nav links — previously had no rules at all, so they fell
           back to default inline <a> layout and ran together as one line
           of text with no spacing. */
        .mobile-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        /* styled-jsx can only auto-scope intrinsic HTML tags (div, nav, a);
           it cannot inject its scope class into a custom component like
           next/link's <Link>, so a plain scoped rule here would compile
           correctly but never match the rendered element. :global() opts
           these out of scoping so they apply as plain class selectors. */
        :global(.mobile-nav-link) {
          display: block;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          text-decoration: none;
          transition: background 0.15s ease, color 0.15s ease;
        }

        :global(.mobile-nav-link:hover) {
          background: rgba(0, 0, 0, 0.04);
          color: var(--color-text);
        }

        :global(.mobile-nav-link.active) {
          background: var(--color-primary-bg);
          color: var(--color-primary);
          font-weight: 600;
        }
        
        /* Typography - Concept */
        .logo-text { font-size: 1.25rem; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; }

        @media (max-width: 1100px) {
          .desktop-nav { display: none; }
          .mobile-toggle { display: flex; align-items: center; justify-content: center; border: none; background: none; width: 40px; height: 40px; }
          .mobile-menu { display: block; border-top: 1px solid var(--color-border-light); background: #fff; padding: 16px; }
          .notification-btn { display: none; }
        }

        @media (max-width: 640px) {
          .navbar-container { padding: 0 12px; height: 56px; }
          .navbar-right { gap: 8px; }
          .logo-text { font-size: 1.05rem; }
          .trigger-copy,
          .profile-caret { display: none; }
          .user-btn { width: 40px; padding: 0; gap: 0; }
          .trigger-avatar { border-radius: 7px; }
          .profile-dropdown {
            position: fixed;
            top: 64px;
            left: 12px;
            right: 12px;
            width: auto;
            max-height: calc(100dvh - 148px);
            overflow-y: auto;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dropdown-menu,
          .nav-dropdown { animation: none; }
          .profile-caret { transition: none; }
        }
      `}</style>
    </header>
  );
}
