'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  ChartLine,
  Users,
  Storefront,
  Gauge,
  Tag,
  Package,
  ChatCircle,
  FileText,
  SquaresFour,
  ClipboardText,
  Robot,
  MagnifyingGlass,
  SignOut,
  House,
  CaretLeft,
  List,
  X,
} from '@phosphor-icons/react';

// Material Prices, Payouts, Featured, Reports and Settings were removed
// because they showed hardcoded arrays or buttons attached to nothing
// (Payouts showed invented money). "Catalog & prices" (/admin/content) is the
// replacement, and it is real: every catalog material with the price the
// public sees, which an admin can override with a confirmed "Admin manual
// price" row in price_observations (lib/pricing/publishedPrice.ts).
// Grouped by the job at hand rather than one list of twelve.
const navGroups = [
  {
    title: 'Insights',
    items: [
      { label: 'Overview', href: '/admin', icon: SquaresFour },
      { label: 'Revenue', href: '/admin/revenue', icon: ChartLine },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Suppliers', href: '/admin/suppliers', icon: Storefront },
      { label: 'Performance', href: '/admin/performance', icon: Gauge },
      { label: 'Agreements', href: '/admin/agreements', icon: FileText },
    ],
  },
  {
    title: 'Catalog & prices',
    items: [
      { label: 'Catalog & prices', href: '/admin/content', icon: Tag },
      { label: 'Packages', href: '/admin/packages', icon: Package },
      { label: 'Scraper', href: '/admin/scraper', icon: Robot },
      { label: 'Review queue', href: '/admin/scraper-review', icon: MagnifyingGlass },
      { label: 'Price matches', href: '/admin/price-matches', icon: Tag },
    ],
  },
  {
    title: 'Support & records',
    items: [
      { label: 'Tickets', href: '/admin/tickets', icon: ChatCircle },
      { label: 'Audit logs', href: '/admin/logs', icon: ClipboardText },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, isLoading, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = profile?.user_type === 'admin' || profile?.tier === 'admin';

  // Admin APIs already enforce requireAdmin server-side; this keeps non-admins
  // from ever seeing the admin shell.
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    // Wait for the profile to load before judging the role.
    if (profile && !isAdmin) {
      router.replace('/home');
    }
  }, [isLoading, user, profile, isAdmin, pathname, router]);

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

  // Don't flash the admin shell while auth resolves or a redirect is pending.
  if (isLoading || !user || !profile || !isAdmin) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          {isLoading || (user && !profile) ? 'Loading…' : 'Redirecting…'}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="admin-sidebar"
        >
          <List size={22} weight="bold" />
        </button>
        <Link href="/admin" className="mobile-topbar-logo">
          <Image src="/logo.png" alt="ZimEstimate" width={24} height={24} />
          <span>Admin Hub</span>
        </Link>
      </header>

      {/* Backdrop (mobile only, when drawer open) */}
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
        id="admin-sidebar"
        className={`admin-sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
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
        <Link href="/admin" className="sidebar-logo" title={collapsed ? 'ZimEstimate Admin Hub' : undefined}>
          <Image src="/logo.png" alt="ZimEstimate" width={28} height={28} className="logo-img" />
          <div className={`sidebar-logo-text${collapsed ? ' hidden' : ''}`}>
            <span className="logo-name">ZimEstimate</span>
            <span className="logo-badge">Admin Hub</span>
          </div>
        </Link>

        <nav className="sidebar-nav" aria-label="Admin sections">
          {navGroups.map((group) => (
            <div key={group.title} className="nav-group">
              {/* Collapsed, the group name gives way to a thin rule. */}
              <span className={`nav-group-title${collapsed ? ' collapsed' : ''}`}>{collapsed ? '' : group.title}</span>
              {group.items.map(({ label, href, icon: Icon }) => {
                const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`nav-item${active ? ' active' : ''}${collapsed ? ' collapsed' : ''}`}
                    title={collapsed ? label : undefined}
                    aria-label={collapsed ? label : undefined}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="nav-icon-wrap">
                      <Icon size={18} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
                      {active && <span className="active-dot" />}
                    </span>
                    <span className={`nav-label${collapsed ? ' hidden' : ''}`}>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <Link
            href="/home"
            className={`back-site${collapsed ? ' collapsed' : ''}`}
            title={collapsed ? 'Back to site' : undefined}
          >
            <House size={15} />
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
              <span className="user-role">Administrator</span>
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
      <main className="admin-content">
        {children}
      </main>

      <style jsx>{`


        .admin-shell {
          display: flex;
          min-height: 100dvh;
          background: var(--color-background);
        }

        .admin-sidebar {
          width: 220px;
          min-width: 220px;
          background: var(--studio-midnight);
          border-right: 1px solid var(--studio-line);
          box-shadow: 18px 0 30px rgba(6,20,47,0.035);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100dvh;
          overflow-y: auto;
          overflow-x: hidden;
          transition: none;
        }

        .admin-sidebar.collapsed {
          width: 64px;
          min-width: 64px;
        }

        .admin-sidebar :global(.sidebar-logo) {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 18px 14px;
          text-decoration: none;
          border-bottom: 1px solid var(--studio-line);
          flex-shrink: 0;
          overflow: hidden;
          white-space: nowrap;
        }

        .admin-sidebar.collapsed :global(.sidebar-logo) {
          justify-content: center;
          padding: 18px 0;
        }

        .logo-img {
          flex-shrink: 0;
          background: white;
          border-radius: 4px;
        }

        .sidebar-logo-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
          overflow: hidden;
          transition: none;
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
          color: var(--studio-ink);
          letter-spacing: -0.02em;
          line-height: 1;
        }

        .logo-badge {
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--studio-brass);
          background: var(--studio-steel);
          padding: 2px 6px;
          border-radius: 4px;
          width: fit-content;
        }

        .sidebar-nav {
          flex: 1;
          padding: 6px 10px 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .nav-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .nav-group-title {
          padding: 8px 12px 4px;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--studio-muted);
          white-space: nowrap;
          overflow: hidden;
        }

        .nav-group-title.collapsed {
          height: 1px;
          padding: 0;
          margin: 6px 12px;
          background: var(--studio-line);
        }

        .sidebar-nav :global(.nav-item) {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          text-decoration: none;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--studio-muted);
          background: transparent;
          transition: none;
          white-space: nowrap;
          overflow: hidden;
          position: relative;
        }

        .sidebar-nav :global(.nav-item.collapsed) {
          justify-content: center;
          padding: 10px 0;
          gap: 0;
        }
      @media (hover: hover) and (pointer: fine) {
          .sidebar-nav :global(.nav-item:hover) {
              color: var(--studio-brass);
              background: var(--studio-steel);
        }
      }
@media (hover: hover) and (pointer: fine) {
    .sidebar-nav :global(.nav-item.collapsed:hover) {
        }
}

        .sidebar-nav :global(.nav-item.active) {
          color: var(--studio-brass);
          font-weight: 600;
          background: var(--studio-steel);
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
          background: var(--studio-brass);
          animation: none;
        }

        .nav-label {
          overflow: hidden;
          transition: none;
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
          border-top: 1px solid var(--studio-line);
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex-shrink: 0;
        }

        .sidebar-bottom :global(.back-site) {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 12px;
          border-radius: 10px;
          text-decoration: none;
          font-size: 0.75rem;
          color: var(--studio-muted);
          transition: none;
          white-space: nowrap;
          overflow: hidden;
        }

        .sidebar-bottom :global(.back-site.collapsed) {
          justify-content: center;
          padding: 7px 0;
        }
      @media (hover: hover) and (pointer: fine) {
          .sidebar-bottom :global(.back-site:hover) {
              color: var(--studio-ink);
              background: var(--studio-steel);
        }
      }

        .back-label {
          overflow: hidden;
          transition: none;
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
          color: var(--studio-muted);
          border-radius: 8px;
          transition: none;
        }
      @media (hover: hover) and (pointer: fine) {
          .collapse-toggle:hover {
              background: var(--studio-steel);
              color: var(--studio-ink);
        }
      }

        .toggle-icon {
          transition: none;
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
          transition: none;
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
          background: var(--studio-steel);
          color: var(--studio-brass);
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
          transition: none;
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
          color: var(--studio-ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: 0.65rem;
          color: var(--studio-muted);
        }

        .sign-out-btn {
          background: none;
          border: none;
          color: var(--studio-muted);
          cursor: pointer;
          padding: 5px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: none;
          flex-shrink: 0;
        }
      @media (hover: hover) and (pointer: fine) {
          .sign-out-btn:hover {
              color: #ef4444;
              background: rgba(239,68,68,0.08);
        }
      }

        .admin-content {
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
          background: var(--studio-midnight);
          border-bottom: 1px solid var(--studio-line);
        }

        .mobile-menu-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid var(--studio-line);
          background: var(--studio-steel);
          color: var(--studio-ink);
          cursor: pointer;
          transition: none;
        }
@media (hover: hover) and (pointer: fine) {
    .mobile-menu-btn:hover {     background: var(--studio-steel); }
}
        .mobile-menu-btn:active { transform: scale(0.96); }

        .mobile-topbar :global(.mobile-topbar-logo) {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: var(--studio-ink);
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
          animation: backdrop-fade 200ms var(--ease-out);
        }

        @keyframes backdrop-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Close button — hidden on desktop */
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
          color: var(--studio-muted);
          cursor: pointer;
          align-items: center;
          justify-content: center;
          transition: none;
        }
@media (hover: hover) and (pointer: fine) {
    .mobile-close-btn:hover {     background: var(--studio-steel); color: var(--studio-ink); }
}

        @media (max-width: 768px) {
          .admin-shell {
            flex-direction: column;
          }

          .mobile-topbar {
            display: flex;
          }

          .admin-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            z-index: 50;
            width: 280px;
            min-width: 280px;
            height: 100dvh;
            transform: translateX(-100%);
            transition: none;
            box-shadow: 30px 0 60px rgba(6,20,47,0.25);
          }

          .admin-sidebar.mobile-open {
            transform: translateX(0);
          }

          /* Collapsed state is desktop-only — ignore on mobile */
          .admin-sidebar.collapsed {
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

          .admin-content {
            width: 100%;
          }
        }

                @media (prefers-reduced-motion: reduce) {
                    @keyframes backdrop-fade { from { opacity: 0; } to { opacity: 1; } }
                }
            `}</style>
    </div>
  );
}
