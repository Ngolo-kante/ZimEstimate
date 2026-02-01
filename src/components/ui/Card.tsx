import React from 'react';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'dashboard' | 'choice' | 'material';
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export default function Card({
  children,
  variant = 'default',
  className = '',
  onClick,
  selected = false,
}: CardProps) {
  const isClickable = !!onClick;

  return (
    <>
      <div
        className={`card card-${variant} ${selected ? 'selected' : ''} ${isClickable ? 'clickable' : ''} ${className}`}
        onClick={onClick}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      >
        {children}
      </div>

      <style jsx>{`
        .card {
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--color-border-light);
          transition: all 0.2s ease;
        }

        .card.clickable {
          cursor: pointer;
        }

        .card.clickable:hover {
          box-shadow: var(--shadow-md);
          border-color: var(--color-border);
        }

        .card.selected {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px var(--color-accent);
        }

        /* Dashboard Card Variant */
        .card-dashboard {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        /* Choice Card Variant (for BOQ selection) */
        .card-choice {
          text-align: center;
          padding: var(--spacing-xl);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-md);
        }

        .card-choice:hover {
          transform: translateY(-2px);
        }

        /* Material Card Variant */
        .card-material {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
        }
      `}</style>
    </>
  );
}

// Sub-components for structured card content
export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <>
      <div className={`card-header ${className}`}>{children}</div>
      <style jsx>{`
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--spacing-md);
        }
      `}</style>
    </>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <>
      <h3 className={`card-title ${className}`}>{children}</h3>
      <style jsx>{`
        .card-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }
      `}</style>
    </>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <>
      <div className={`card-content ${className}`}>{children}</div>
      <style jsx>{`
        .card-content {
          flex: 1;
        }
      `}</style>
    </>
  );
}

export function CardBadge({
  children,
  variant = 'default'
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'accent';
}) {
  return (
    <>
      <span className={`card-badge badge-${variant}`}>{children}</span>
      <style jsx>{`
        .card-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 500;
          border-radius: 9999px;
        }

        .badge-default {
          background: var(--color-border-light);
          color: var(--color-text-secondary);
        }

        .badge-success {
          background: rgba(16, 185, 129, 0.1);
          color: var(--color-success);
        }

        .badge-warning {
          background: rgba(78, 154, 247, 0.15);
          color: var(--color-warning);
        }

        .badge-accent {
          background: rgba(78, 154, 247, 0.15);
          color: var(--color-accent-dark);
        }
      `}</style>
    </>
  );
}
