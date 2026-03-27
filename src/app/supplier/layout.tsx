'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  House,
  Funnel,
  ChartLine,
  Plus,
  CreditCard,
  Star,
  UserCircle,
  SignOut,
  Buildings,
} from '@phosphor-icons/react';

const navItems = [
  { label: 'Dashboard', href: '/supplier/dashboard', icon: House },
  { label: 'Leads', href: '/supplier/leads', icon: Funnel },
  { label: 'Analytics', href: '/supplier/analytics', icon: ChartLine },
  { label: 'Add Product', href: '/supplier/products/add', icon: Plus },
  { label: 'Billing', href: '/supplier/billing', icon: CreditCard },
  { label: 'Upgrade', href: '/supplier/upgrade', icon: Star },
  { label: 'Profile', href: '/supplier/profile/edit', icon: UserCircle },
];

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();

  // Don't show side nav on the register page (onboarding flow)
  if (pathname === '/supplier/register') {
    return <>{children}</>;
  }

  return (
    <div className="supplier-shell">
      {/* Sidebar */}
      <aside className="supplier-sidebar">
        <Link href="/supplier/dashboard" className="sidebar-logo">
          <Image src="/logo.png" alt="ZimEstimate" width={28} height={28} />
          <div className="sidebar-logo-text">
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
                className={`nav-item ${active ? 'active' : ''}`}
              >
                <Icon size={18} weight={active ? 'fill' : 'regular'} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <Link href="/home" className="back-site">
            <Buildings size={15} />
            <span>Back to site</span>
          </Link>
          <div className="user-row">
            <div className="user-info">
              <span className="user-name">{profile?.full_name || user?.email?.split('@')[0]}</span>
              <span className="user-role">{profile?.email || user?.email}</span>
            </div>
            <button className="sign-out-btn" onClick={() => signOut()} title="Sign out">
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
        .supplier-shell {
          display: flex;
          min-height: 100vh;
          background: #f8fafc;
        }

        .supplier-sidebar {
          width: 216px;
          min-width: 216px;
          background: white;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 18px 14px;
          text-decoration: none;
          border-bottom: 1px solid #f1f5f9;
          flex-shrink: 0;
        }

        .sidebar-logo-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .logo-name {
          font-size: 0.875rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1;
        }

        .logo-badge {
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #2563eb;
          background: #eff6ff;
          padding: 2px 6px;
          border-radius: 4px;
          width: fit-content;
        }

        .sidebar-nav {
          flex: 1;
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          gap: 1px;
          overflow-y: auto;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 10px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #64748b;
          transition: all 0.15s ease;
        }

        .nav-item:hover {
          color: #1e293b;
          background: #f1f5f9;
        }

        .nav-item.active {
          color: #2563eb;
          background: #eff6ff;
          font-weight: 600;
        }

        .sidebar-bottom {
          padding: 10px 8px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex-shrink: 0;
        }

        .back-site {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border-radius: 7px;
          text-decoration: none;
          font-size: 0.75rem;
          color: #94a3b8;
          transition: all 0.15s ease;
        }

        .back-site:hover {
          color: #475569;
          background: #f1f5f9;
        }

        .user-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
        }

        .user-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .user-name {
          font-size: 0.75rem;
          font-weight: 600;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: 0.65rem;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sign-out-btn {
          background: none;
          border: none;
          color: #cbd5e1;
          cursor: pointer;
          padding: 5px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .sign-out-btn:hover {
          color: #ef4444;
          background: #fef2f2;
        }

        .supplier-content {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .supplier-sidebar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
