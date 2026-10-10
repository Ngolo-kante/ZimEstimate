'use client';

import { useEffect, useState } from 'react';
import {
    File,
    FilePdf,
    Image as ImageIcon,
    Trash,
    DownloadSimple,
    Eye,
} from '@phosphor-icons/react';
import { getDocumentUrl } from '@/lib/services/projects';
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
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        if (document.file_type.startsWith('image/')) {
            void getDocumentUrl(document.storage_path).then(url => { if (active) setThumbnail(url); }).catch(() => {});
        }
        return () => { active = false; };
    }, [document.storage_path, document.file_type]);

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
                    <span className="saved-label">Saved</span>
                </div>

                {thumbnail && <button type="button" className="thumbnail" onClick={() => onView(document)} aria-label={`Preview ${document.file_name}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnail} alt="" loading="lazy" />
                </button>}
                <div className="card-body">
                    <h4 className="file-name" title={document.file_name}>
                        {document.file_name}
                    </h4>
                    {document.description && (
                        <p className="file-description">{document.description}</p>
                    )}
                </div>

                <div className="document-actions">
                    <button type="button" onClick={() => onView(document)}><Eye size={16} /> Open</button>
                    <button type="button" onClick={() => onDownload(document)}><DownloadSimple size={16} /> Download</button>
                    <button type="button" className="danger" onClick={() => onDelete(document.id)}><Trash size={16} /> Remove</button>
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
                    border: 1px solid #d7e6f5;
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
                    border-color: #b9d4ef;
                    box-shadow: 0 12px 20px -8px rgba(22, 77, 131, 0.24), 0 4px 8px -2px rgba(22, 77, 131, 0.08);
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
                    background: var(--color-accent-muted);
                    color: var(--color-accent);
                }

                .file-icon.pdf {
                    background: linear-gradient(135deg, #fef2f2, #fee2e2);
                    color: #dc2626;
                }

                .file-icon.default {
                    background: #f1f5f9;
                    color: #64748b;
                }

                .saved-label { font-size: .8rem; color: #166534; background: #f0fdf4; padding: 4px 8px; border-radius: 4px; }
                .thumbnail { padding: 0; border: 0; background: #f1f5f9; border-radius: 6px; cursor: pointer; overflow: hidden; }
                .thumbnail img { display: block; width: 100%; height: 120px; object-fit: cover; }
                .document-actions { display: flex; gap: 6px; flex-wrap: wrap; }
                .document-actions button { display: inline-flex; align-items: center; gap: 5px; min-height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; background: white; color: #0b1f3b; font-size: .8rem; cursor: pointer; }
                .document-actions .danger { color: #b91c1c; }
                button:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
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
                    flex-wrap: wrap;
                    gap: 8px;
                    padding-top: 16px;
                    border-top: 1px solid #f1f5f9;
                }

                .category-badge {
                    font-size: 0.65rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 4px 8px;
                    background: #ecf4ff;
                    color: #356a9f;
                    border-radius: 99px;
                }

                .file-meta {
                    font-size: 0.8rem;
                    color: #475569;
                    font-weight: 500;
                }
            `}</style>
        </>
    );
}
