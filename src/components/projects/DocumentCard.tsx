'use client';

import { useState } from 'react';
import {
    File,
    FilePdf,
    Image as ImageIcon,
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
        if (isImage) return <ImageIcon size={24} weight="duotone" />;
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
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 20px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                    position: relative;
                }

                .document-card:hover {
                    border-color: #cbd5e1;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
                    transform: translateY(-2px);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .file-icon {
                    width: 48px;
                    height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 12px;
                }

                .file-icon.image {
                    background: linear-gradient(135deg, #ecfdf5, #d1fae5);
                    color: #059669;
                }

                .file-icon.pdf {
                    background: linear-gradient(135deg, #fef2f2, #fee2e2);
                    color: #dc2626;
                }

                .file-icon.default {
                    background: #f1f5f9;
                    color: #64748b;
                }

                .menu-container {
                    position: relative;
                }

                .menu-btn {
                    background: none;
                    border: none;
                    padding: 6px;
                    cursor: pointer;
                    color: #94a3b8;
                    border-radius: 6px;
                    transition: all 0.2s;
                }

                .menu-btn:hover {
                    background: #f1f5f9;
                    color: #475569;
                }

                .menu-dropdown {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 8px;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                    min-width: 140px;
                    z-index: 20;
                    overflow: hidden;
                    padding: 4px;
                }

                .menu-dropdown button {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    width: 100%;
                    padding: 8px 12px;
                    background: none;
                    border: none;
                    font-size: 0.85rem;
                    color: #334155;
                    cursor: pointer;
                    text-align: left;
                    border-radius: 6px;
                }

                .menu-dropdown button:hover {
                    background: #f1f5f9;
                }

                .menu-dropdown button.danger {
                    color: #ef4444;
                }

                .menu-dropdown button.danger:hover {
                    background: #fef2f2;
                }

                .card-body {
                    cursor: pointer;
                    flex: 1;
                }

                .file-name {
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #0f172a;
                    margin: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    line-height: 1.4;
                }

                .file-description {
                    font-size: 0.8rem;
                    color: #64748b;
                    margin: 4px 0 0 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .card-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 16px;
                    border-top: 1px solid #f1f5f9;
                }

                .category-badge {
                    font-size: 0.65rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 4px 8px;
                    background: #f1f5f9;
                    color: #475569;
                    border-radius: 99px;
                }

                .file-meta {
                    font-size: 0.7rem;
                    color: #94a3b8;
                    font-weight: 500;
                }
            `}</style>
        </>
    );
}
