'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, X, PencilSimple } from '@phosphor-icons/react';

interface InlineEditProps {
  value: string | number;
  onSave: (value: string | number) => void;
  type?: 'text' | 'number' | 'currency';
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
  formatDisplay?: (value: string | number) => string;
}

export default function InlineEdit({
  value,
  onSave,
  type = 'text',
  placeholder = 'Click to edit',
  prefix = '',
  suffix = '',
  min,
  max,
  step = 1,
  className = '',
  disabled = false,
  formatDisplay,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  const handleSave = () => {
    const newValue = type === 'number' || type === 'currency'
      ? parseFloat(editValue) || 0
      : editValue;
    onSave(newValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(String(value));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const displayValue = formatDisplay
    ? formatDisplay(value)
    : `${prefix}${value}${suffix}`;

  if (disabled) {
    return (
      <span className={`inline-edit-display disabled ${className}`}>
        {displayValue || placeholder}
        <style jsx>{`
          .inline-edit-display.disabled {
            color: var(--color-text-muted);
          }
        `}</style>
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className={`inline-edit-container ${className}`}>
        <div className="input-wrapper">
          {prefix && <span className="prefix">{prefix}</span>}
          <input
            ref={inputRef}
            type={type === 'currency' ? 'number' : type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder={placeholder}
            min={min}
            max={max}
            step={type === 'currency' ? 0.01 : step}
          />
          {suffix && <span className="suffix">{suffix}</span>}
        </div>
        <div className="actions">
          <button
            className="action-btn save"
            onClick={handleSave}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Check size={14} weight="bold" />
          </button>
          <button
            className="action-btn cancel"
            onClick={handleCancel}
            onMouseDown={(e) => e.preventDefault()}
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <style jsx>{`
          .inline-edit-container {
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }

          .input-wrapper {
            display: flex;
            align-items: center;
            background: white;
            border: 2px solid var(--color-accent);
            border-radius: var(--radius-md);
            padding: 4px 8px;
            box-shadow: 0 0 0 3px var(--color-accent-bg);
          }

          .prefix, .suffix {
            font-size: 0.875rem;
            color: var(--color-text-secondary);
          }

          input {
            border: none;
            outline: none;
            font-size: inherit;
            font-weight: inherit;
            color: var(--color-text);
            background: transparent;
            width: auto;
            min-width: 60px;
            max-width: 200px;
          }

          input[type="number"] {
            text-align: right;
          }

          .actions {
            display: flex;
            gap: 4px;
          }

          .action-btn {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .action-btn.save {
            background: var(--color-success);
            color: white;
          }

          .action-btn.save:hover {
            background: var(--color-success-dark, #059669);
          }

          .action-btn.cancel {
            background: var(--color-border-light);
            color: var(--color-text-secondary);
          }

          .action-btn.cancel:hover {
            background: var(--color-error);
            color: white;
          }
        `}</style>
      </div>
    );
  }

  return (
    <span
      className={`inline-edit-display ${className}`}
      onClick={() => setIsEditing(true)}
    >
      {displayValue || <span className="placeholder">{placeholder}</span>}
      <PencilSimple size={14} className="edit-icon" weight="light" />

      <style jsx>{`
        .inline-edit-display {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          padding: 4px 8px;
          margin: -4px -8px;
          border-radius: var(--radius-md);
          transition: all 0.15s ease;
        }

        .inline-edit-display:hover {
          background: var(--color-background);
        }

        .inline-edit-display :global(.edit-icon) {
          opacity: 0;
          color: var(--color-text-muted);
          transition: opacity 0.15s ease;
        }

        .inline-edit-display:hover :global(.edit-icon) {
          opacity: 1;
        }

        .placeholder {
          color: var(--color-text-muted);
          font-style: italic;
        }
      `}</style>
    </span>
  );
}
