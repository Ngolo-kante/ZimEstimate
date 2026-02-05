'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import {
  shareProject,
  getProjectShares,
  updateShareAccess,
  removeShare,
} from '@/lib/services/projects';
import { ProjectShare, AccessLevel } from '@/lib/database.types';
import {
  X,
  EnvelopeSimple,
  Link as LinkIcon,
  Copy,
  Check,
  UserPlus,
  CircleNotch,
  Trash,
} from '@phosphor-icons/react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectId: string;
}

export default function ShareModal({ isOpen, onClose, projectName, projectId }: ShareModalProps) {
  const { success, error: showError } = useToast();
  const [email, setEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('view');
  const [copied, setCopied] = useState(false);
  const [shares, setShares] = useState<ProjectShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const loadShares = useCallback(async () => {
    setIsLoading(true);
    const { shares: loadedShares, error } = await getProjectShares(projectId);
    if (error) {
      showError('Failed to load shares');
    } else {
      setShares(loadedShares);
    }
    setIsLoading(false);
  }, [projectId, showError]);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line
      loadShares();
    }
  }, [isOpen, loadShares]);

  if (!isOpen) return null;

  const shareLink = `${window.location.origin}/projects/${projectId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async () => {
    if (!email || !email.includes('@')) {
      showError('Please enter a valid email address');
      return;
    }

    setIsInviting(true);
    const { share, error } = await shareProject(projectId, email, accessLevel);

    if (error) {
      showError(error.message);
    } else if (share) {
      setShares([share, ...shares]);
      setEmail('');
      success('Invitation sent!');
    }
    setIsInviting(false);
  };

  const handleUpdateAccess = async (shareId: string, newAccess: AccessLevel) => {
    const { share, error } = await updateShareAccess(shareId, newAccess);
    if (error) {
      showError('Failed to update access level');
    } else if (share) {
      setShares(shares.map((s) => (s.id === shareId ? share : s)));
      success('Access level updated');
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    const { error } = await removeShare(shareId);
    if (error) {
      showError('Failed to remove share');
    } else {
      setShares(shares.filter((s) => s.id !== shareId));
      success('Share removed');
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="modal-header">
            <h2>Share Project</h2>
            <button className="close-btn" onClick={onClose}>
              <X size={20} weight="bold" />
            </button>
          </div>

          {/* Project Name */}
          <p className="project-name">{projectName}</p>

          {/* Invite by Email */}
          <div className="invite-section">
            <label className="section-label">Invite by Email</label>
            <div className="invite-row">
              <Input
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<EnvelopeSimple size={18} weight="light" />}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
                className="access-select"
              >
                <option value="view">Can View</option>
                <option value="edit">Can Edit</option>
              </select>
              <Button
                icon={isInviting ? <CircleNotch size={18} className="spin" /> : <UserPlus size={18} />}
                onClick={handleInvite}
                loading={isInviting}
              >
                Invite
              </Button>
            </div>
          </div>

          {/* Shared Users List */}
          <div className="shared-users">
            <label className="section-label">People with Access</label>
            {isLoading ? (
              <div className="loading-state">
                <CircleNotch size={20} className="spin" />
                <span>Loading...</span>
              </div>
            ) : shares.length === 0 ? (
              <p className="no-shares">No one has access yet. Invite someone above.</p>
            ) : (
              <ul className="users-list">
                {shares.map((share) => (
                  <li key={share.id} className="user-item">
                    <div className="user-avatar">
                      {share.shared_with_email[0].toUpperCase()}
                    </div>
                    <div className="user-info">
                      <span className="user-email">{share.shared_with_email}</span>
                      <span className={`user-status ${share.shared_with_user_id ? 'accepted' : 'pending'}`}>
                        {share.shared_with_user_id ? '' : 'Pending signup'}
                      </span>
                    </div>
                    <select
                      value={share.access_level}
                      onChange={(e) => handleUpdateAccess(share.id, e.target.value as AccessLevel)}
                      className="access-select-sm"
                    >
                      <option value="view">View</option>
                      <option value="edit">Edit</option>
                    </select>
                    <button className="remove-btn" onClick={() => handleRemoveShare(share.id)}>
                      <Trash size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Share Link */}
          <div className="link-section">
            <label className="section-label">
              <LinkIcon size={16} weight="light" />
              Share Link
            </label>
            <div className="link-row">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="link-input"
              />
              <Button
                variant="secondary"
                icon={copied ? <Check size={18} /> : <Copy size={18} />}
                onClick={handleCopyLink}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="link-hint">Anyone with this link can view the project summary (requires login)</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: var(--spacing-lg);
        }

        .modal-content {
          background: var(--color-surface);
          border-radius: var(--radius-xl);
          width: 100%;
          max-width: 500px;
          padding: var(--spacing-xl);
          box-shadow: var(--shadow-lg);
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-sm);
        }

        .modal-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          padding: var(--spacing-xs);
          cursor: pointer;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
        }

        .close-btn:hover {
          background: var(--color-border-light);
          color: var(--color-text);
        }

        .project-name {
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-xl) 0;
        }

        .section-label {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          margin-bottom: var(--spacing-sm);
        }

        .invite-section {
          margin-bottom: var(--spacing-xl);
        }

        .invite-row {
          display: flex;
          gap: var(--spacing-sm);
        }

        .access-select {
          padding: 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          font-size: 0.875rem;
          color: var(--color-text);
          cursor: pointer;
        }

        .shared-users {
          margin-bottom: var(--spacing-xl);
        }

        .loading-state {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          color: var(--color-text-secondary);
        }

        .no-shares {
          color: var(--color-text-muted);
          font-size: 0.875rem;
          margin: 0;
          padding: var(--spacing-md);
          background: var(--color-background);
          border-radius: var(--radius-md);
          text-align: center;
        }

        .users-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .user-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm);
          background: var(--color-background);
          border-radius: var(--radius-md);
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--color-primary);
          color: var(--color-text-inverse);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
          flex-shrink: 0;
        }

        .user-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .user-email {
          font-size: 0.875rem;
          color: var(--color-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .user-status {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .user-status.pending {
          color: var(--color-warning);
        }

        .access-select-sm {
          padding: var(--spacing-xs) var(--spacing-sm);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          font-size: 0.75rem;
          color: var(--color-text);
          cursor: pointer;
        }

        .remove-btn {
          background: none;
          border: none;
          padding: var(--spacing-xs);
          cursor: pointer;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }

        .remove-btn:hover {
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .link-section {
          padding-top: var(--spacing-lg);
          border-top: 1px solid var(--color-border-light);
        }

        .link-row {
          display: flex;
          gap: var(--spacing-sm);
        }

        .link-input {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-background);
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .link-hint {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin: var(--spacing-sm) 0 0 0;
        }

        :global(.spin) {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .invite-row {
            flex-direction: column;
          }

          .user-item {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </>
  );
}
