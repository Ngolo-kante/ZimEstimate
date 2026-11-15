import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <>
      <button
        className={`btn btn-${variant} btn-${size} ${fullWidth ? 'full-width' : ''} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="spinner" />
        ) : (
          <>
            {icon && iconPosition === 'left' && <span className="btn-icon">{icon}</span>}
            {children && <span className="btn-text">{children}</span>}
            {icon && iconPosition === 'right' && <span className="btn-icon">{icon}</span>}
          </>
        )}
      </button>

      <style jsx>{`
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-weight: 500;
          border-radius: var(--radius-md);
          transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease;
          cursor: pointer;
          border: none;
          font-family: inherit;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn:active:not(:disabled) { transform: scale(0.97); }

        @media (prefers-reduced-motion: reduce) {
          .btn { transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease; }
          .btn:active:not(:disabled) { transform: none; }
        }

        /* Sizes */
        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }

        .btn-md {
          padding: 0.75rem 1.5rem;
          font-size: 0.9375rem;
        }

        .btn-lg {
          padding: 1rem 2rem;
          font-size: 1rem;
        }

        /* Variants */
        .btn-primary {
          background: var(--color-accent);
          color: white;
        }
        @media (hover: hover) and (pointer: fine) {
          .btn-primary:hover:not(:disabled) {
            background: var(--color-accent-dark);
          }
        }

        .btn-secondary {
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text);
        }
        @media (hover: hover) and (pointer: fine) {
          .btn-secondary:hover:not(:disabled) {
            background: var(--color-surface);
            border-color: var(--color-primary);
          }
        }

        .btn-ghost {
          background: transparent;
          color: var(--color-text-secondary);
        }
        @media (hover: hover) and (pointer: fine) {
          .btn-ghost:hover:not(:disabled) {
            background: var(--color-border-light);
            color: var(--color-text);
          }
        }

        .btn-danger {
          background: var(--color-error);
          color: white;
        }
        @media (hover: hover) and (pointer: fine) {
          .btn-danger:hover:not(:disabled) {
            background: #dc2626;
          }
        }

        .full-width {
          width: 100%;
        }

        .btn-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          width: 1rem;
          height: 1rem;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
