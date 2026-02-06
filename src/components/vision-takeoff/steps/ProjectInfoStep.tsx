'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import {
  ArrowLeft,
  ArrowRight,
  House,
  MapPin,
} from '@phosphor-icons/react';
import { ProjectInfo } from '@/lib/vision/types';

interface ProjectInfoStepProps {
  projectInfo: ProjectInfo;
  onUpdate: (info: Partial<ProjectInfo>) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export default function ProjectInfoStep({
  projectInfo,
  onUpdate,
  onConfirm,
  onBack,
}: ProjectInfoStepProps) {
  const [errors, setErrors] = useState<{ name?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectInfo.name.trim()) {
      setErrors({ name: 'Project name is required' });
      return;
    }

    setErrors({});
    onConfirm();
  };

  return (
    <div className="project-info-step">
      <div className="step-header">
        <h1>Project Details</h1>
        <p>Give your project a name and location to help organize your estimates.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="project-name">
              <House size={18} weight="light" />
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              value={projectInfo.name}
              onChange={(e) => {
                onUpdate({ name: e.target.value });
                if (errors.name) setErrors({});
              }}
              placeholder="e.g., Borrowdale 4-Bedroom House"
              className={errors.name ? 'error' : ''}
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="project-location">
              <MapPin size={18} weight="light" />
              Location (Optional)
            </label>
            <div className="select-wrapper">
              <select
                id="project-location"
                value={projectInfo.location}
                onChange={(e) => onUpdate({ location: e.target.value })}
              >
                <option value="">Select Location</option>
                <option value="Harare">Harare</option>
                <option value="Bulawayo">Bulawayo</option>
                <option value="Chitungwiza">Chitungwiza</option>
                <option value="Mutare">Mutare</option>
                <option value="Gweru">Gweru</option>
                <option value="Masvingo">Masvingo</option>
                <option value="Kwekwe">Kwekwe</option>
                <option value="Kadoma">Kadoma</option>
                <option value="Marondera">Marondera</option>
                <option value="Norton">Norton</option>
                <option value="Ruwa">Ruwa</option>
              </select>
            </div>
            <span className="hint-text">
              Location helps you track projects and may affect material pricing in future versions.
            </span>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              <ArrowLeft size={18} weight="bold" />
              Back to Editor
            </button>

            <button type="submit" className="btn btn-primary">
              Continue to Configuration
              <ArrowRight size={18} weight="bold" />
            </button>
          </div>
        </form>
      </Card>

      <style jsx>{`
        .project-info-step {
          max-width: 600px;
          margin: 0 auto;
        }

        .step-header {
          text-align: center;
          margin-bottom: var(--spacing-xl);
        }

        .step-header h1 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .step-header p {
          font-size: 1rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        label {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
        }

        input {
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          font-size: 1rem;
          color: var(--color-text);
          background: #ffffff;
          transition: all 0.2s ease;
        }

        input:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.18);
        }

        input.error {
          border-color: var(--color-error);
        }

        input::placeholder {
          color: var(--color-text-muted);
        }

        .select-wrapper {
          position: relative;
        }

        select {
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          font-size: 1rem;
          color: var(--color-text);
          background: #ffffff;
          transition: all 0.2s ease;
          appearance: none;
          cursor: pointer;
        }

        select:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.18);
        }

        .error-text {
          font-size: 0.75rem;
          color: var(--color-error);
        }

        .hint-text {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .form-actions {
          display: flex;
          justify-content: space-between;
          gap: var(--spacing-md);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--color-border-light);
        }

        .btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-lg);
          border-radius: var(--radius-md);
          font-size: 0.9375rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-primary {
          background: var(--color-primary);
          color: var(--color-text-inverse);
        }

        .btn-primary:hover {
          background: var(--color-primary-dark);
        }

        .btn-secondary {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
        }

        .btn-secondary:hover {
          border-color: var(--color-text-muted);
          color: var(--color-text);
        }

        @media (max-width: 640px) {
          .form-actions {
            flex-direction: column;
          }

          .btn {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
