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
        onKeyDown={isClickable ? (event) => {
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onClick?.();
          }
        } : undefined}
      >
        {children}
      </div>

      <style jsx>{`
        .card {
          background: var(--card-bg);
          border-radius: var(--card-radius);
          padding: 24px;
          border: var(--card-border);
          box-shadow: var(--card-shadow);
        }

        .card.clickable {
          cursor: pointer;
          transition: border-color var(--duration-fast), background-color var(--duration-fast);
        }
        .card.clickable:focus-visible {
          outline: 3px solid var(--color-focus-ring);
          outline-offset: 2px;
        }
        @media (hover: hover) and (pointer: fine) {
          .card.clickable:hover { border-color: var(--color-accent); }
        }

        .card.selected {
          border-color: var(--color-accent);
          box-shadow: inset 0 0 0 1px var(--color-accent);
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
          background: var(--card-bg);
        }
        .card-choice.selected { background: var(--color-info-bg); }

        /* Material Card Variant */
        .card-material {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
        }


        @media (prefers-reduced-motion: reduce) {
          .card.clickable { transition: none; }
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

export { CardBadge } from './CardBadge';
