'use client';

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
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        {...props}
      >
        {icon && iconPosition === 'left' && <span className="btn-icon">{icon}</span>}
        {children && <span className="btn-text">{children}</span>}
        {icon && iconPosition === 'right' && <span className="btn-icon">{icon}</span>}
        {loading && <span className="spinner" aria-hidden="true" />}
      </button>

      <style jsx>{`
        .btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-weight: 600;
          border-radius: var(--radius-md);
          transition: transform var(--duration-fast) var(--ease-out), background-color var(--duration-fast), border-color var(--duration-fast), box-shadow var(--duration-fast);
          cursor: pointer;
          border: none;
          font-family: inherit;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn:active:not(:disabled):not(:focus-visible) { transform: translateY(1px); }

        @media (prefers-reduced-motion: reduce) {
          .btn { transition: none; }
          .btn:active:not(:disabled):not(:focus-visible) { transform: none; }
        }

        .btn:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; transition: none; }

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

        .btn-secondary {
          background: var(--color-info-bg);
          border: 1px solid var(--color-info-border);
          color: var(--color-accent-dark);
        }

        .btn-ghost { background: transparent; color: var(--color-text-secondary); }
        .btn-danger { background: var(--color-danger-fg); color: white; }

        @media (hover: hover) and (pointer: fine) {
          .btn-primary:hover:not(:disabled) {
            background: var(--color-accent-dark);
            box-shadow: 0 2px 6px rgb(24 72 185 / 22%);
          }
          .btn-secondary:hover:not(:disabled) {
            background: #e2ecfc;
            border-color: var(--color-accent);
          }
          .btn-ghost:hover:not(:disabled) {
            background: var(--color-border-light);
            color: var(--color-text);
          }
          .btn-danger:hover:not(:disabled) { background: #991b1b; }
        }

        .btn[aria-busy='true'] { cursor: progress; }
        .btn[aria-busy='true'] :is(.btn-icon, .btn-text) { opacity: 0; }

        .full-width {
          width: 100%;
        }

        .btn-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          position: absolute;
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

        @media (prefers-reduced-motion: reduce) {
          .spinner { animation: none; }
        }
      `}</style>
    </>
  );
}
