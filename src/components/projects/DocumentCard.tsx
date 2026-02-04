'use client';

import { useState } from 'react';
import {
    File,
    FilePdf,
    Image,
    Trash,
    DownloadSimple,
    Eye,
    DotsThreeVertical,
} from '@phosphor-icons/react';
import { ProjectDocument } from '@/lib/database.types';

interface DocumentCardProps {
    document: ProjectDocument;
    onDelete: (id: string) => void;
    onView: (document: ProjectDocument) => void;
    onDownload: (document: ProjectDocument) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
    plan: 'Plans',
    permit: 'Permits',
    receipt: 'Receipts',
    contract: 'Contracts',
    photo: 'Photos',
    general: 'General',
};

export default function DocumentCard({ document, onDelete, onView, onDownload }: DocumentCardProps) {
    const [showMenu, setShowMenu] = useState(false);

    const isImage = document.file_type.startsWith('image/');
    const isPdf = document.file_type === 'application/pdf';

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getIcon = () => {
        if (isImage) return <Image size={24} weight="duotone" />;
        if (isPdf) return <FilePdf size={24} weight="duotone" />;
        return <File size={24} weight="duotone" />;
    };

    return (
        <>
            <div className="document-card">
                <div className="card-header">
                    <div className={`file-icon ${isImage ? 'image' : isPdf ? 'pdf' : 'default'}`}>
                        {getIcon()}
                    </div>
                    <div className="menu-container">
                        <button
                            className="menu-btn"
                            onClick={() => setShowMenu(!showMenu)}
                            onBlur={() => setTimeout(() => setShowMenu(false), 150)}
                        >
                            <DotsThreeVertical size={20} weight="bold" />
                        </button>
                        {showMenu && (
                            <div className="menu-dropdown">
                                <button onClick={() => onView(document)}>
                                    <Eye size={16} /> View
                                </button>
                                <button onClick={() => onDownload(document)}>
                                    <DownloadSimple size={16} /> Download
                                </button>
                                <button className="danger" onClick={() => onDelete(document.id)}>
                                    <Trash size={16} /> Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card-body" onClick={() => onView(document)}>
                    <h4 className="file-name" title={document.file_name}>
                        {document.file_name}
                    </h4>
                    {document.description && (
                        <p className="file-description">{document.description}</p>
                    )}
                </div>

                <div className="card-footer">
                    <span className="category-badge">{CATEGORY_LABELS[document.category] || document.category}</span>
                    <span className="file-meta">
                        {formatFileSize(document.file_size)} • {formatDate(document.created_at)}
                    </span>
                </div>
            </div>

            <style jsx>{`
                .document-card {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-lg);
                    padding: var(--spacing-md);
                    transition: all 0.2s ease;
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .document-card:hover {
                    border-color: var(--color-primary);
                    box-shadow: var(--shadow-md);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .file-icon {
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: var(--radius-md);
                }

                .file-icon.image {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                }

                .file-icon.pdf {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                }

                .file-icon.default {
                    background: var(--color-background);
                    color: var(--color-text-muted);
                }

                .menu-container {
                    position: relative;
                }

                .menu-btn {
                    background: none;
                    border: none;
                    padding: var(--spacing-xs);
                    cursor: pointer;
                    color: var(--color-text-muted);
                    border-radius: var(--radius-sm);
                }

                .menu-btn:hover {
                    background: var(--color-background);
                    color: var(--color-text);
                }

                .menu-dropdown {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: var(--spacing-xs);
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-lg);
                    min-width: 140px;
                    z-index: 10;
                    overflow: hidden;
                }

                .menu-dropdown button {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    width: 100%;
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: none;
                    border: none;
                    font-size: 0.875rem;
                    color: var(--color-text);
                    cursor: pointer;
                    text-align: left;
                }

                .menu-dropdown button:hover {
                    background: var(--color-background);
                }

                .menu-dropdown button.danger {
                    color: var(--color-error);
                }

                .menu-dropdown button.danger:hover {
                    background: var(--color-error-bg);
                }

                .card-body {
                    cursor: pointer;
                    flex: 1;
                }

                .file-name {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .file-description {
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                    margin: var(--spacing-xs) 0 0 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .card-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: var(--spacing-sm);
                    border-top: 1px solid var(--color-border-light);
                }

                .category-badge {
                    font-size: 0.625rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 2px 6px;
                    background: var(--color-primary-bg);
                    color: var(--color-primary);
                    border-radius: var(--radius-sm);
                }

                .file-meta {
                    font-size: 0.625rem;
                    color: var(--color-text-muted);
                }
            `}</style>
        </>
    );
}
