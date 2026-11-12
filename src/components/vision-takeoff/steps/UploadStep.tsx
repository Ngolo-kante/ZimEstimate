'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import {
  CloudArrowUp,
  Image as ImageIcon,
  Warning,
  X,
} from '@phosphor-icons/react';
import { prepareImageForUpload } from '@/lib/compressImage';

interface UploadStepProps {
  onFileSelect: (file: File) => void;
  error: string | null;
  /** Clears an error that came from the wizard rather than from this screen. */
  onDismissError?: () => void;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadStep({ onFileSelect, error, onDismissError }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Please upload a PNG, JPG, WebP, or PDF file';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 10MB';
    }
    return null;
  };

  const handleFile = useCallback(async (chosen: File) => {
    // Shrunk before the size check: a 12 MB phone photo of a plan is about
    // 1 MB once scaled, and used to be turned away for no reason.
    const file = await prepareImageForUpload(chosen, 'reading');
    const validationError = validateFile(file);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError(null);
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared so that choosing the same file again is still a change.
    e.target.value = '';
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const displayError = error || localError;

  return (
    <div className="upload-step">
      <div className="step-header">
        <h1>Upload your floor plan</h1>
        <p>We read the rooms and their sizes from your plan, then price the materials and labour. You check the rooms before anything is priced.</p>
      </div>

      <Card className="upload-card">
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            id="file-input"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleInputChange}
            className="file-input"
          />

          <label htmlFor="file-input" className="drop-label">
            <div className="upload-icon">
              <CloudArrowUp size={48} weight="light" />
            </div>

            {/* Phones cannot drag a file in: they are asked to choose or photograph one. */}
            <span className="drop-text for-pointer">
              {isDragging ? 'Drop your file here' : 'Drag and drop your floor plan here'}
            </span>
            <span className="drop-text for-touch">Choose your plan, or take a photo of it</span>

            <span className="or-text for-pointer">or</span>

            <span className="browse-btn"><span className="for-pointer">Browse files</span><span className="for-touch">Choose a file</span></span>

            <span className="file-types">
              <ImageIcon size={16} weight="light" aria-hidden="true" />
              PDF, PNG, JPG or WebP, up to 10 MB
            </span>
          </label>
        </div>

        {displayError && (
          <div className="error-message" role="alert">
            <Warning size={18} weight="fill" aria-hidden="true" />
            <span>{displayError}</span>
            <button type="button" onClick={() => { setLocalError(null); onDismissError?.(); }} className="dismiss-btn" aria-label="Dismiss this message">
              <X size={16} weight="bold" aria-hidden="true" />
            </button>
          </div>
        )}
      </Card>

      <div className="tips-section">
        <h2>For a good reading</h2>
        <ul>
          <li><strong>Upload the floor plan page</strong>, the one with the room names and sizes. Septic, column and elevation sheets cannot be priced as a house.</li>
          <li><strong>A PDF from your architect reads best.</strong> If it has several pages, the first page is the one checked against its printed sizes.</li>
          <li><strong>For a screenshot or photo</strong>, fill the frame with the plan and make sure the room sizes can be read.</li>
        </ul>
        <p className="no-plan">No plan to hand? <Link href="/boq/new?method=manual">Build the estimate from the floor area</Link>.</p>
      </div>

      <style jsx>{`
        .upload-step {
          max-width: 700px;
          margin: 0 auto;
        }

        .step-header {
          text-align: center;
          margin-bottom: var(--spacing-xl);
        }

        .step-header h1 {
          font-size: 1.75rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .step-header p {
          font-size: 1rem;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.6;
        }

        .drop-zone {
          position: relative;
          border: 2px dashed var(--color-border-dark);
          border-radius: var(--radius-lg);
          padding: var(--spacing-2xl);
          text-align: center;
          transition: all 0.2s ease;
          cursor: pointer;
          background: rgba(6, 20, 47, 0.02);
        }

        .drop-zone:hover,
        .drop-zone.dragging {
          border-color: var(--color-accent);
          background: rgba(78, 154, 247, 0.08);
        }

        /* Hidden from sight but still reachable by keyboard: display: none
           took the upload out of the tab order altogether. */
        .file-input {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
        }

        .drop-zone:focus-within {
          border-color: var(--color-accent);
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .for-touch {
          display: none;
        }

        @media (hover: none) and (pointer: coarse) {
          .for-pointer {
            display: none;
          }

          .for-touch {
            display: inline;
          }
        }

        .drop-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-md);
          cursor: pointer;
        }

        .upload-icon {
          width: 80px;
          height: 80px;
          border-radius: var(--radius-full);
          background: rgba(78, 154, 247, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent);
          border: 1px solid rgba(78, 154, 247, 0.2);
        }

        .drop-text {
          font-size: 1rem;
          font-weight: 500;
          color: var(--color-text);
        }

        .or-text {
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }

        .browse-btn {
          padding: var(--spacing-sm) var(--spacing-lg);
          background: var(--color-primary);
          color: var(--color-text-inverse);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
          box-shadow: 0 10px 20px rgba(6, 20, 47, 0.12);
        }

        .drop-label:hover .browse-btn {
          background: var(--color-primary-dark);
        }

        .file-types {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--color-error-bg);
          border-radius: var(--radius-md);
          margin-top: var(--spacing-md);
          color: var(--color-error);
          font-size: 0.875rem;
        }

        .dismiss-btn {
          margin-left: auto;
          background: none;
          border: none;
          color: var(--color-error);
          cursor: pointer;
          padding: 10px;
          margin: -6px -6px -6px auto;
          display: flex;
        }

        .tips-section {
          margin-top: var(--spacing-xl);
          padding: var(--spacing-lg);
          background: var(--color-background);
          border-radius: var(--radius-lg);
        }

        .tips-section h2 {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-md) 0;
        }

        .tips-section ul {
          margin: 0;
          padding-left: var(--spacing-lg);
        }

        .tips-section li {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin-bottom: var(--spacing-xs);
        }

        .tips-section li:last-child {
          margin-bottom: 0;
        }

        .tips-section li {
          line-height: 1.5;
        }

        .tips-section strong {
          color: var(--color-text);
          font-weight: 600;
        }

        .no-plan {
          margin: var(--spacing-md) 0 0;
          color: var(--color-text-secondary);
          font-size: 0.875rem;
        }

        .no-plan :global(a) {
          color: var(--color-accent-dark);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
