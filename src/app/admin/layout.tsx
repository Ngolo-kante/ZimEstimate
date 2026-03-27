'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  ChartLine,
  Users,
  Storefront,
  TrendUp,
  Package,
  ChatCircle,
  FileText,
  SquaresFour,
  ClipboardText,
  Robot,
  MagnifyingGlass,
  SignOut,
  House,
} from '@phosphor-icons/react';

const navItems = [
  { label: 'Revenue', href: '/admin/revenue', icon: ChartLine },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Suppliers', href: '/admin/suppliers', icon: Storefront },
  { label: 'Performance', href: '/admin/performance', icon: TrendUp },
  { label: 'Content', href: '/admin/content', icon: Package },
  { label: 'Tickets', href: '/admin/tickets', icon: ChatCircle },
  { label: 'Agreements', href: '/admin/agreements', icon: FileText },
  { label: 'Packages', href: '/admin/packages', icon: SquaresFour },
  { label: 'Audit Logs', href: '/admin/logs', icon: ClipboardText },
  { label: 'Scraper', href: '/admin/scraper', icon: Robot },
  { label: 'Review Queue', href: '/admin/scraper-review', icon: MagnifyingGlass },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();

  return (
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <Link href="/admin/revenue" className="sidebar-logo">
          <Image src="/logo.png" alt="ZimEstimate" width={28} height={28} />
          <div className="sidebar-logo-text">
            <span className="logo-name">ZimEstimate</span>
            <span className="logo-badge">Admin Hub</span>
          </div>
        </Link>

        <nav className="sidebar-nav">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href);
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
            <House size={15} />
            <span>Back to site</span>
          </Link>
          <div className="user-row">
            <div className="user-info">
              <span className="user-name">{profile?.full_name || user?.email?.split('@')[0]}</span>
              <span className="user-role">Administrator</span>
            </div>
            <button className="sign-out-btn" onClick={() => signOut()} title="Sign out">
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
          min-height: 100vh;
          background: #f1f5f9;
        }

        .admin-sidebar {
          width: 216px;
          min-width: 216px;
          background: #0f172a;
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
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
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
          color: white;
          letter-spacing: -0.02em;
          line-height: 1;
        }

        .logo-badge {
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #60a5fa;
          background: rgba(96, 165, 250, 0.12);
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
          padding: 8px 10px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 0.8125rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.82);
          transition: all 0.15s ease;
        }

        .nav-item:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.06);
        }

        .nav-item.active {
          color: #93c5fd;
          background: rgba(96, 165, 250, 0.12);
        }

        .sidebar-bottom {
          padding: 10px 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
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
          color: rgba(255, 255, 255, 0.35);
          transition: all 0.15s ease;
        }

        .back-site:hover {
          color: rgba(255, 255, 255, 0.65);
          background: rgba(255, 255, 255, 0.05);
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
          color: rgba(255, 255, 255, 0.8);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: 0.65rem;
          color: rgba(255, 255, 255, 0.35);
        }

        .sign-out-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.3);
          cursor: pointer;
          padding: 5px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .sign-out-btn:hover {
          color: #f87171;
          background: rgba(239, 68, 68, 0.1);
        }

        .admin-content {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .admin-sidebar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
