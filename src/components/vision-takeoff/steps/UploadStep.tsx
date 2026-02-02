'use client';

import { useState, useCallback } from 'react';
import Card from '@/components/ui/Card';
import {
  CloudArrowUp,
  Image as ImageIcon,
  Warning,
  X,
} from '@phosphor-icons/react';

interface UploadStepProps {
  onFileSelect: (file: File) => void;
  error: string | null;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadStep({ onFileSelect, error }: UploadStepProps) {
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

  const handleFile = useCallback((file: File) => {
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
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const displayError = error || localError;

  return (
    <div className="upload-step">
      <div className="step-header">
        <h1>Upload Floor Plan</h1>
        <p>Upload your architectural floor plan and our AI will analyze it to extract room dimensions and generate a Bill of Quantities.</p>
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

            <span className="drop-text">
              {isDragging ? 'Drop your file here' : 'Drag and drop your floor plan here'}
            </span>

            <span className="or-text">or</span>

            <span className="browse-btn">Browse Files</span>

            <span className="file-types">
              <ImageIcon size={16} weight="light" />
              PNG, JPG, WebP, or PDF (max 10MB)
            </span>
          </label>
        </div>

        {displayError && (
          <div className="error-message">
            <Warning size={18} weight="fill" />
            <span>{displayError}</span>
            <button onClick={() => setLocalError(null)} className="dismiss-btn">
              <X size={16} weight="bold" />
            </button>
          </div>
        )}
      </Card>

      <div className="tips-section">
        <h3>Tips for best results</h3>
        <ul>
          <li>Use a clear, high-resolution floor plan image</li>
          <li>Ensure room dimensions are visible if labeled</li>
          <li>Plans with a scale indicator work best</li>
          <li>Architectural drawings produce more accurate results than sketches</li>
        </ul>
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
          border: 2px dashed var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--spacing-2xl);
          text-align: center;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .drop-zone:hover,
        .drop-zone.dragging {
          border-color: var(--color-accent);
          background: var(--color-accent-bg);
        }

        .file-input {
          display: none;
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
          background: var(--color-background);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent);
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
        }

        .drop-label:hover .browse-btn {
          background: var(--color-primary-dark);
        }

        .file-types {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.75rem;
          color: var(--color-text-muted);
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
          padding: 4px;
          display: flex;
        }

        .tips-section {
          margin-top: var(--spacing-xl);
          padding: var(--spacing-lg);
          background: var(--color-background);
          border-radius: var(--radius-lg);
        }

        .tips-section h3 {
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
      `}</style>
    </div>
  );
}
