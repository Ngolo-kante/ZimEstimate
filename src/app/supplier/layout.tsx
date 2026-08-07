'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  House,
  Funnel,
  ChartLine,
  CreditCard,
  UserCircle,
  SignOut,
  Buildings,
  Package,
  FileText,
  Bell,
  CaretLeft,
  List,
  X,
} from '@phosphor-icons/react';

// Upgrade is gone too. It presented a full checkout — plan cards, a Stripe or
// EcoCash choice — whose button ended in alert("Payment ... coming soon"), for
// a tier whose advertised features are almost entirely ungated in code. Of the
// seven, only api_access is actually enforced, and contact_requests was freed
// outright. Suppliers and contractors are free while the platform is early, so
// there is nothing here to sell yet.
//
// Orders, Messages and Reviews used to sit in here. All three rendered
// hardcoded arrays and touched no database at all: invented conversations,
// invented orders from invented builders, and invented reviews carrying an
// invented average rating for the supplier's own business. There is no
// messages or reviews table to point them at, and "Orders" was a second,
// fictional copy of what Leads already shows for real — so they are gone
// rather than quietly unlinked, which would have left the fabrications a
// URL away.
const navItems = [
  { label: 'Dashboard', href: '/supplier/dashboard', icon: House },
  { label: 'Products', href: '/supplier/products', icon: Package },
  { label: 'Leads', href: '/supplier/leads', icon: Funnel },
  { label: 'Analytics', href: '/supplier/analytics', icon: ChartLine },
  { label: 'Documents', href: '/supplier/documents', icon: FileText },
  { label: 'Notifications', href: '/supplier/notifications', icon: Bell },
  { label: 'Billing', href: '/supplier/billing', icon: CreditCard },
  { label: 'Profile', href: '/supplier/profile/edit', icon: UserCircle },
];

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setMobileOpen(false), 0);
    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  // Close drawer on Escape; lock body scroll while open
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  // Don't show side nav on the register page (onboarding flow)
  if (pathname === '/supplier/register') {
    return <>{children}</>;
  }

  return (
    <div className="supplier-shell">
      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="supplier-sidebar"
        >
          <List size={22} weight="bold" />
        </button>
        <Link href="/supplier/dashboard" className="mobile-topbar-logo">
          <Image src="/logo.png" alt="ZimEstimate" width={24} height={24} />
          <span>Supplier Portal</span>
        </Link>
      </header>

      {/* Backdrop (mobile only) */}
      {mobileOpen && (
        <button
          type="button"
          className="mobile-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="supplier-sidebar"
        className={`supplier-sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
      >
        {/* Close button (mobile only) */}
        <button
          type="button"
          className="mobile-close-btn"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
        >
          <X size={20} weight="bold" />
        </button>
        <Link href="/supplier/dashboard" className="sidebar-logo" title={collapsed ? 'ZimEstimate Supplier Portal' : undefined}>
          <Image src="/logo.png" alt="ZimEstimate" width={28} height={28} className="logo-img" />
          <div className={`sidebar-logo-text${collapsed ? ' hidden' : ''}`}>
            <span className="logo-name">ZimEstimate</span>
            <span className="logo-badge">Supplier Portal</span>
          </div>
        </Link>

        <nav className="sidebar-nav">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/supplier/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item${active ? ' active' : ''}${collapsed ? ' collapsed' : ''}`}
                title={collapsed ? label : undefined}
              >
                <span className="nav-icon-wrap">
                  <Icon size={18} weight={active ? 'fill' : 'regular'} />
                  {active && <span className="active-dot" />}
                </span>
                <span className={`nav-label${collapsed ? ' hidden' : ''}`}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <Link
            href="/home"
            className={`back-site${collapsed ? ' collapsed' : ''}`}
            title={collapsed ? 'Back to site' : undefined}
          >
            <Buildings size={15} />
            <span className={`back-label${collapsed ? ' hidden' : ''}`}>Back to site</span>
          </Link>

          <button
            className="collapse-toggle"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <CaretLeft size={16} className={`toggle-icon${collapsed ? ' collapsed' : ''}`} />
          </button>

          <div className={`user-row${collapsed ? ' collapsed' : ''}`}>
            <div
              className="user-avatar"
              title={(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
            >
              {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className={`user-info${collapsed ? ' hidden' : ''}`}>
              <span className="user-name">{profile?.full_name || user?.email?.split('@')[0]}</span>
              <span className="user-role">{profile?.email || user?.email}</span>
            </div>
            <button
              className="sign-out-btn"
              onClick={() => signOut()}
              title="Sign out"
            >
              <SignOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="supplier-content">
        {children}
      </main>

      <style jsx>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.75); }
        }

        .supplier-shell {
          display: flex;
          min-height: 100vh;
          background: #f1f5f9;
        }

        .supplier-sidebar {
          width: 220px;
          min-width: 220px;
          background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(246,250,255,0.9));
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-right: 1px solid rgba(211,211,215,0.75);
          box-shadow: 18px 0 30px rgba(6,20,47,0.035);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
          transition: width 0.3s cubic-bezier(0.2,0,0,1), min-width 0.3s cubic-bezier(0.2,0,0,1);
        }

        .supplier-sidebar.collapsed {
          width: 64px;
          min-width: 64px;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 18px 14px;
          text-decoration: none;
          border-bottom: 1px solid rgba(211,211,215,0.6);
          flex-shrink: 0;
          overflow: hidden;
          white-space: nowrap;
        }

        .supplier-sidebar.collapsed .sidebar-logo {
          justify-content: center;
          padding: 18px 0;
        }

        .logo-img {
          flex-shrink: 0;
        }

        .sidebar-logo-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
          overflow: hidden;
          transition: opacity 0.3s cubic-bezier(0.2,0,0,1), max-width 0.3s cubic-bezier(0.2,0,0,1);
          max-width: 160px;
          opacity: 1;
        }

        .sidebar-logo-text.hidden {
          opacity: 0;
          max-width: 0;
          pointer-events: none;
        }

        .logo-name {
          font-size: 0.875rem;
          font-weight: 700;
          color: #0f294b;
          letter-spacing: -0.02em;
          line-height: 1;
        }

        .logo-badge {
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #19508a;
          background: linear-gradient(135deg, #ecf4ff, #d6e8ff);
          padding: 2px 6px;
          border-radius: 4px;
          width: fit-content;
        }

        .sidebar-nav {
          flex: 1;
          padding: 10px 10px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          text-decoration: none;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #5a6f8d;
          background: rgba(255,255,255,0.55);
          transition: all 0.3s cubic-bezier(0.2,0,0,1);
          white-space: nowrap;
          overflow: hidden;
          position: relative;
        }

        .nav-item.collapsed {
          justify-content: center;
          padding: 10px 0;
          gap: 0;
        }

        .nav-item:hover {
          color: #164d83;
          background: #edf6ff;
          transform: translateX(2px);
        }

        .nav-item.collapsed:hover {
          transform: none;
        }

        .nav-item.active {
          color: #164d83;
          font-weight: 600;
          background: linear-gradient(135deg, #e9f4ff, #f3f9ff);
          box-shadow: 0 10px 18px rgba(22,77,131,0.14);
        }

        .nav-icon-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .active-dot {
          position: absolute;
          top: -2px;
          right: -3px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #2f76c5;
          box-shadow: 0 0 8px rgba(47,118,197,0.4);
          animation: pulse-dot 2s ease-in-out infinite;
        }

        .nav-label {
          overflow: hidden;
          transition: opacity 0.3s cubic-bezier(0.2,0,0,1), max-width 0.3s cubic-bezier(0.2,0,0,1);
          max-width: 160px;
          opacity: 1;
        }

        .nav-label.hidden {
          opacity: 0;
          max-width: 0;
          pointer-events: none;
        }

        .sidebar-bottom {
          padding: 10px 10px;
          border-top: 1px solid rgba(211,211,215,0.6);
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex-shrink: 0;
        }

        .back-site {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 12px;
          border-radius: 10px;
          text-decoration: none;
          font-size: 0.75rem;
          color: #7689a5;
          transition: all 0.3s cubic-bezier(0.2,0,0,1);
          white-space: nowrap;
          overflow: hidden;
        }

        .back-site.collapsed {
          justify-content: center;
          padding: 7px 0;
        }

        .back-site:hover {
          color: #255f9b;
          background: rgba(233,244,255,0.65);
        }

        .back-label {
          overflow: hidden;
          transition: opacity 0.3s cubic-bezier(0.2,0,0,1), max-width 0.3s cubic-bezier(0.2,0,0,1);
          max-width: 160px;
          opacity: 1;
        }

        .back-label.hidden {
          opacity: 0;
          max-width: 0;
          pointer-events: none;
        }

        .collapse-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 6px 0;
          background: none;
          border: none;
          cursor: pointer;
          color: #6f86a9;
          border-radius: 8px;
          transition: all 0.3s cubic-bezier(0.2,0,0,1);
        }

        .collapse-toggle:hover {
          background: rgba(233,244,255,0.65);
          color: #255f9b;
        }

        .toggle-icon {
          transition: transform 0.3s cubic-bezier(0.2,0,0,1);
        }

        .toggle-icon.collapsed {
          transform: rotate(180deg);
        }

        .user-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          overflow: hidden;
          transition: padding 0.3s cubic-bezier(0.2,0,0,1);
        }

        .user-row.collapsed {
          justify-content: center;
          padding: 8px 0;
          gap: 0;
          flex-direction: column;
        }

        .user-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ecf4ff, #d6e8ff);
          color: #19508a;
          font-weight: 700;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .user-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          overflow: hidden;
          transition: opacity 0.3s cubic-bezier(0.2,0,0,1), max-width 0.3s cubic-bezier(0.2,0,0,1);
          max-width: 120px;
          opacity: 1;
        }

        .user-info.hidden {
          opacity: 0;
          max-width: 0;
          pointer-events: none;
        }

        .user-name {
          font-size: 0.75rem;
          font-weight: 600;
          color: #0f294b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: 0.65rem;
          color: #7689a5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sign-out-btn {
          background: none;
          border: none;
          color: #7891b5;
          cursor: pointer;
          padding: 5px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .sign-out-btn:hover {
          color: #ef4444;
          background: rgba(239,68,68,0.08);
        }

        .supplier-content {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
        }

        /* Mobile top bar — hidden on desktop */
        .mobile-topbar {
          display: none;
          position: sticky;
          top: 0;
          z-index: 40;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(211,211,215,0.75);
        }

        .mobile-menu-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid rgba(211,211,215,0.75);
          background: #fff;
          color: #0f294b;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .mobile-menu-btn:hover { background: #edf6ff; }
        .mobile-menu-btn:active { transform: scale(0.96); }

        .mobile-topbar-logo {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: #0f294b;
          font-weight: 700;
          font-size: 0.9rem;
          letter-spacing: -0.01em;
        }

        .mobile-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 49;
          background: rgba(10,24,48,0.42);
          backdrop-filter: blur(2px);
          border: none;
          padding: 0;
          cursor: pointer;
          animation: backdrop-fade 0.2s ease;
        }

        @keyframes backdrop-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .mobile-close-btn {
          display: none;
          position: absolute;
          top: 14px;
          right: 12px;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: #5a6f8d;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease;
        }

        .mobile-close-btn:hover { background: rgba(233,244,255,0.8); color: #0f294b; }

        @media (max-width: 768px) {
          .supplier-shell {
            flex-direction: column;
          }

          .mobile-topbar {
            display: flex;
          }

          .supplier-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            z-index: 50;
            width: 280px;
            min-width: 280px;
            height: 100dvh;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.2,0,0,1);
            box-shadow: 30px 0 60px rgba(6,20,47,0.25);
          }

          .supplier-sidebar.mobile-open {
            transform: translateX(0);
          }

          .supplier-sidebar.collapsed {
            width: 280px;
            min-width: 280px;
          }

          .mobile-backdrop {
            display: block;
          }

          .mobile-close-btn {
            display: flex;
          }

          .collapse-toggle {
            display: none;
          }

          .supplier-content {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
