'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
    X,
    EnvelopeSimple,
    Link as LinkIcon,
    Copy,
    Check,
    UserPlus,
} from '@phosphor-icons/react';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectName: string;
    projectId: string;
}

interface SharedUser {
    email: string;
    accessLevel: 'view' | 'collaborate';
    status: 'pending' | 'accepted';
}

export default function ShareModal({ isOpen, onClose, projectName, projectId }: ShareModalProps) {
    const [email, setEmail] = useState('');
    const [accessLevel, setAccessLevel] = useState<'view' | 'collaborate'>('view');
    const [copied, setCopied] = useState(false);
    const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([
        { email: 'contractor@example.com', accessLevel: 'view', status: 'accepted' },
    ]);

    if (!isOpen) return null;

    const shareLink = `https://zimestimate.app/shared/${projectId}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleInvite = () => {
        if (email && email.includes('@')) {
            setSharedUsers([...sharedUsers, { email, accessLevel, status: 'pending' }]);
            setEmail('');
        }
    };

    const handleRemoveUser = (emailToRemove: string) => {
        setSharedUsers(sharedUsers.filter((u) => u.email !== emailToRemove));
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
                            />
                            <select
                                value={accessLevel}
                                onChange={(e) => setAccessLevel(e.target.value as 'view' | 'collaborate')}
                                className="access-select"
                            >
                                <option value="view">Can View</option>
                                <option value="collaborate">Can Collaborate</option>
                            </select>
                            <Button icon={<UserPlus size={18} />} onClick={handleInvite}>
                                Invite
                            </Button>
                        </div>
                    </div>

                    {/* Shared Users List */}
                    {sharedUsers.length > 0 && (
                        <div className="shared-users">
                            <label className="section-label">People with Access</label>
                            <ul className="users-list">
                                {sharedUsers.map((user) => (
                                    <li key={user.email} className="user-item">
                                        <div className="user-avatar">
                                            {user.email[0].toUpperCase()}
                                        </div>
                                        <div className="user-info">
                                            <span className="user-email">{user.email}</span>
                                            <span className={`user-status ${user.status}`}>
                                                {user.status === 'pending' ? 'Pending' : user.accessLevel === 'view' ? 'View Only' : 'Collaborator'}
                                            </span>
                                        </div>
                                        <button className="remove-btn" onClick={() => handleRemoveUser(user.email)}>
                                            <X size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

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
                        <p className="link-hint">Anyone with this link can view the project summary</p>
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
        }

        .user-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .user-email {
          font-size: 0.875rem;
          color: var(--color-text);
        }

        .user-status {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .user-status.pending {
          color: var(--color-warning);
        }

        .remove-btn {
          background: none;
          border: none;
          padding: var(--spacing-xs);
          cursor: pointer;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
        }

        .remove-btn:hover {
          background: var(--color-border-light);
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
      `}</style>
        </>
    );
}
