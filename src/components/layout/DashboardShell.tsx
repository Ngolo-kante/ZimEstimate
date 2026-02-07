'use client';

import { ReactNode } from 'react';
import TopNavbar from './TopNavbar';
import {
  MagnifyingGlass,
  Bell,
  User,
} from '@phosphor-icons/react';
import { CurrencyProvider } from '@/components/ui/CurrencyToggle';

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  showSearch?: boolean;
}



export default function DashboardShell({
  title,
  subtitle,
  actions,
  children,
  showSearch = true,
}: DashboardShellProps) {


  return (
    <CurrencyProvider>
      <div className="dash-shell">
        <TopNavbar />

        <main className="dash-main">
          <header className="dash-header">
            <div className="header-left">
              <div className="title-block">
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
              </div>
            </div>

            <div className="header-right">
              {showSearch && (
                <div className="search-box">
                  <MagnifyingGlass size={16} />
                  <input type="search" placeholder="Search" />
                  <kbd>Cmd K</kbd>
                </div>
              )}
              {actions}
              <button className="icon-btn" aria-label="Notifications">
                <Bell size={18} />
              </button>
              <button className="icon-btn" aria-label="User">
                <User size={18} />
              </button>
            </div>
          </header>

          <div className="dash-content">
            {children}
          </div>
        </main>
      </div>

      <style jsx>{`
        .dash-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f4f6fb;
        }

        .sidebar-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: var(--color-primary);
        }

        .brand-name {
          display: block;
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .brand-sub {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .close-btn {
          display: none;
          background: rgba(6, 20, 47, 0.06);
          border: none;
          border-radius: 10px;
          width: 32px;
          height: 32px;
          align-items: center;
          justify-content: center;
          color: var(--color-text);
        }

        .sidebar-nav,
        .sidebar-footer {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          text-decoration: none;
          color: var(--color-text-secondary);
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .nav-item:hover {
          background: rgba(78, 154, 247, 0.08);
          color: var(--color-primary);
        }

        .nav-item.active {
          background: rgba(78, 154, 247, 0.18);
          color: var(--color-primary);
        }

        .dash-main {
          padding: 32px 36px;
        }

        .dash-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .menu-btn {
          display: none;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid var(--color-border-light);
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(6, 20, 47, 0.08);
        }

        .title-block h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-text);
        }

        .title-block p {
          margin: 4px 0 0;
          color: var(--color-text-secondary);
          font-size: 0.9rem;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #ffffff;
          border: 1px solid var(--color-border-light);
          border-radius: 12px;
          min-width: 220px;
          box-shadow: 0 10px 20px rgba(6, 20, 47, 0.08);
        }

        .search-box input {
          border: none;
          outline: none;
          background: transparent;
          font-size: 0.875rem;
          color: var(--color-text);
          width: 140px;
        }

        .search-box kbd {
          font-size: 0.7rem;
          color: var(--color-text-muted);
          background: rgba(6, 20, 47, 0.06);
          padding: 2px 6px;
          border-radius: 6px;
        }

        .icon-btn {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid var(--color-border-light);
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .dash-content {
          max-width: 1200px;
        }

        .sidebar-backdrop {
          display: none;
        }

        @media (max-width: 1200px) {
          .dash-shell {
            grid-template-columns: 1fr;
          }

          .dash-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            z-index: 200;
            width: 260px;
          }

          .dash-sidebar.open {
            transform: translateX(0);
          }

          .close-btn {
            display: inline-flex;
          }

          .menu-btn {
            display: inline-flex;
          }

          .sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(6, 20, 47, 0.25);
            border: none;
            z-index: 150;
          }

          .dash-main {
            padding: 24px;
          }
        }

        @media (max-width: 900px) {
          .dash-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .header-right {
            width: 100%;
            flex-wrap: wrap;
          }

          .search-box {
            flex: 1;
            min-width: 180px;
          }
        }

        @media (max-width: 640px) {
          .dash-main {
            padding: 20px;
          }

          .title-block h1 {
            font-size: 1.3rem;
          }
        }
      `}</style>
    </CurrencyProvider>
  );
}
