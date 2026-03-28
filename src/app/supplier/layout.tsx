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
  Package,
  ShoppingCart,
  ChatCircle,
  FileText,
  Bell,
} from '@phosphor-icons/react';

const navItems = [
  { label: 'Dashboard', href: '/supplier/dashboard', icon: House },
  { label: 'Products', href: '/supplier/products', icon: Package },
  { label: 'Orders', href: '/supplier/orders', icon: ShoppingCart },
  { label: 'Leads', href: '/supplier/leads', icon: Funnel },
  { label: 'Messages', href: '/supplier/messages', icon: ChatCircle },
  { label: 'Reviews', href: '/supplier/reviews', icon: Star },
  { label: 'Analytics', href: '/supplier/analytics', icon: ChartLine },
  { label: 'Documents', href: '/supplier/documents', icon: FileText },
  { label: 'Notifications', href: '/supplier/notifications', icon: Bell },
  { label: 'Billing', href: '/supplier/billing', icon: CreditCard },
  { label: 'Upgrade', href: '/supplier/upgrade', icon: UserCircle },
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
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 18px 14px;
          text-decoration: none;
          border-bottom: 1px solid rgba(211,211,215,0.6);
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
          transition: all 0.2s ease;
        }

        .nav-item:hover {
          color: #164d83;
          background: #edf6ff;
          transform: translateX(2px);
        }

        .nav-item.active {
          color: #164d83;
          font-weight: 600;
          background: linear-gradient(135deg, #e9f4ff, #f3f9ff);
          box-shadow: 0 10px 18px rgba(22,77,131,0.14);
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
          transition: all 0.2s ease;
        }

        .back-site:hover {
          color: #255f9b;
          background: rgba(233,244,255,0.65);
        }

        .user-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
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

        @media (max-width: 768px) {
          .supplier-sidebar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
