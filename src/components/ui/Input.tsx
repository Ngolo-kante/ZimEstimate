import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export default function Input({
  label,
  error,
  hint,
  icon,
  id,
  className = '',
  ...props
}: InputProps) {
  const uniqueId = useId();
  const inputId = id || `input-${uniqueId}`;

  return (
    <>
      <div className={`input-wrapper ${error ? 'has-error' : ''} ${className}`}>
        {label && <label htmlFor={inputId} className="input-label">{label}</label>}
        <div className="input-container">
          {icon && <span className="input-icon">{icon}</span>}
          <input
            id={inputId}
            className={`input-field ${icon ? 'has-icon' : ''}`}
            {...props}
          />
        </div>
        {error && <span className="input-error">{error}</span>}
        {hint && !error && <span className="input-hint">{hint}</span>}
      </div>

      <style jsx>{`
        .input-wrapper {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .input-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
        }

        .input-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 0.75rem;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          pointer-events: none;
        }

        .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          font-size: 0.9375rem;
          font-family: inherit;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          color: var(--color-text);
          transition: all 0.2s ease;
        }

        .input-field.has-icon {
          padding-left: 2.5rem;
        }

        .input-field:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.18);
        }

        .input-field::placeholder {
          color: var(--color-text-muted);
        }

        .has-error .input-field {
          border-color: var(--color-error);
        }

        .has-error .input-field:focus {
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
        }

        .input-error {
          font-size: 0.75rem;
          color: var(--color-error);
        }

        .input-hint {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }
      `}</style>
    </>
  );
}

// Textarea variant
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({
  label,
  error,
  hint,
  id,
  className = '',
  ...props
}: TextareaProps) {
  const uniqueId = useId();
  const textareaId = id || `textarea-${uniqueId}`;

  return (
    <>
      <div className={`input-wrapper ${error ? 'has-error' : ''} ${className}`}>
        {label && <label htmlFor={textareaId} className="input-label">{label}</label>}
        <textarea
          id={textareaId}
          className="textarea-field"
          {...props}
        />
        {error && <span className="input-error">{error}</span>}
        {hint && !error && <span className="input-hint">{hint}</span>}
      </div>

      <style jsx>{`
        .input-wrapper {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .input-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
        }

        .textarea-field {
          width: 100%;
          min-height: 100px;
          padding: 0.75rem 1rem;
          font-size: 0.9375rem;
          font-family: inherit;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          color: var(--color-text);
          resize: vertical;
          transition: all 0.2s ease;
        }

        .textarea-field:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.18);
        }

        .textarea-field::placeholder {
          color: var(--color-text-muted);
        }

        .has-error .textarea-field {
          border-color: var(--color-error);
        }

        .input-error {
          font-size: 0.75rem;
          color: var(--color-error);
        }

        .input-hint {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }
      `}</style>
    </>
  );
}
