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
  { label: 'Home', href: '/home' },
  { label: 'My Projects', href: '/projects' },
  { label: 'Insights', href: '/market-insights' },
  { label: 'Templates', href: '/templates' },
  { label: 'Scraper', href: '/scraper' }, // TODO: Restrict to role === 'admin' later
  { label: 'Marketplace', href: '/marketplace' },
];

export default function TopNavbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut, isAuthenticated } = useAuth();

  const isActive = (href: string) => {
    return pathname.startsWith(href);
  };

  /* Notification State */
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  // Mock notifications for now - could be fetched from a store or API
  const notifications = [
    { id: 1, title: 'Project "Harare Home" created', time: '2 mins ago', unread: true },
    { id: 2, title: 'Material prices updated', time: '1 hour ago', unread: false },
    { id: 3, title: 'Welcome to ZimEstimate Pro', time: '1 day ago', unread: false },
  ];

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

          {/* Notification Menu */}
          <div className="menu-container" ref={notificationMenuRef}>
            <button
              className={`icon-btn notification-btn ${notificationMenuOpen ? 'active' : ''}`}
              onClick={() => setNotificationMenuOpen(!notificationMenuOpen)}
            >
              <Bell size={20} weight={notificationMenuOpen ? 'fill' : 'regular'} />
              <span className="notification-dot" />
            </button>

            {notificationMenuOpen && (
              <div className="dropdown-menu notification-dropdown">
                <div className="dropdown-header">
                  <h3>Notifications</h3>
                  <button className="text-xs text-blue-600 font-medium hover:text-blue-700">Mark all read</button>
                </div>
                <div className="notification-list">
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
              <div className="dropdown-menu profile-dropdown">
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
                    <div className="menu-divider" />
                    <Link
                      href="/settings"
                      className="menu-item"
                      onClick={() => setProfileMenuOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                    >
                      <Gear size={18} weight="duotone" className="text-slate-400" />
                      Settings
                    </Link>
                    {profile?.tier === 'free' && (
                      <Link
                        href="/upgrade"
                        className="menu-item upgrade"
                        onClick={() => setProfileMenuOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#2563eb' }}
                      >
                        <Crown size={18} weight="fill" />
                        Upgrade to Pro
                      </Link>
                    )}
                    <div className="menu-divider" />
                    <button className="menu-item logout" onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                      <SignOut size={18} weight="duotone" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/login"
                      className="menu-item"
                      onClick={() => setProfileMenuOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                    >
                      <User size={18} weight="duotone" />
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
          gap: 24px;
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
          width: 280px;
          background: white;
          border: 1px solid rgba(0,0,0,0.08); /* More subtle border */
          border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(0,0,0,0.15); /* Sleek shadow */
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
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: 12px;
          color: var(--color-text);
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
          overflow: hidden;
        }

        .user-btn:hover, .user-btn.active {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .user-btn .user-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Profile Menu Content */
        .profile-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(to bottom, rgba(249, 250, 251, 1), rgba(255, 255, 255, 1));
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
            letter-spacing: 0.05em;
            padding: 2px 6px;
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

        .menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 16px;
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
        
        /* Typography - Concept */
        .logo-text { font-size: 1.25rem; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; }

        @media (max-width: 900px) {
          .desktop-nav { display: none; }
          .mobile-toggle { display: flex; align-items: center; justify-content: center; border: none; background: none; width: 40px; height: 40px; }
          .mobile-menu { display: block; border-top: 1px solid var(--color-border-light); background: #fff; padding: 16px; }
          .notification-btn { display: none; }
        }
      `}</style>
    </header>
  );
}
