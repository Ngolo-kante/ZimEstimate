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
          background: #ffffff;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 
                      0 2px 4px -1px rgba(0, 0, 0, 0.01),
                      0 10px 15px -3px rgba(0, 0, 0, 0.01),
                      0 0 0 1px rgba(226, 232, 240, 0.6);
          border: none;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .card.clickable {
          cursor: pointer;
        }

        .card.clickable:hover {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05),
                      0 8px 10px -6px rgba(0, 0, 0, 0.01),
                      0 0 0 1px rgba(59, 130, 246, 0.5);
          transform: translateY(-4px);
        }

        .card.selected {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px rgba(78, 154, 247, 0.4), 0 10px 25px -5px rgba(78, 154, 247, 0.15);
        }

        /* Dashboard Card Variant */
        .card-dashboard {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Choice Card Variant (for BOQ selection) */
        .card-choice {
          text-align: center;
          padding: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          background: linear-gradient(145deg, #ffffff, #f8fafc);
        }

        .card-choice:hover {
          background: #ffffff;
        }

        /* Material Card Variant */
        .card-material {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
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
  variant?: 'default' | 'success' | 'warning' | 'accent' | 'error' | 'info';
}) {
  return (
    <>
      <span className={`card-badge badge-${variant}`}>{children}</span>
      <style jsx>{`
        /* One recipe per meaning, each pair at least 4.5:1 on its own
           background (the default badge was #64748B on a translucent grey,
           about 3.9:1). Meaning: neutral = draft or planned; accent = action
           or selection; warning = needs attention; error = blocking or over
           budget; success = done or on track. */
        .card-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 9999px;
          white-space: nowrap;
        }

        .badge-default {
          background: #f1f5f9;
          color: #334155;
        }

        .badge-success {
          background: #dcfce7;
          color: #166534;
        }

        .badge-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .badge-accent {
          background: #e0ebff;
          color: #1e4fc2;
        }

        .badge-error {
          background: #fee2e2;
          color: #b91c1c;
        }

        .badge-info {
          background: #eff6ff;
          color: #1d4ed8;
        }
      `}</style>
    </>
  );
}
