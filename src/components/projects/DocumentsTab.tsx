'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import DocumentUploader from './DocumentUploader';
import DocumentCard from './DocumentCard';
import { useToast } from '@/components/ui/Toast';
import {
    uploadDocument,
    getProjectDocuments,
    deleteDocument,
    getDocumentUrl,
} from '@/lib/services/projects';
import { ProjectDocument, DocumentCategory } from '@/lib/database.types';
import { FunnelSimple, File, Warning } from '@phosphor-icons/react';

interface DocumentsTabProps {
    projectId: string;
}

const FILTER_OPTIONS: { value: DocumentCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All Documents' },
    { value: 'plan', label: 'Plans & Drawings' },
    { value: 'permit', label: 'Permits' },
    { value: 'receipt', label: 'Receipts' },
    { value: 'contract', label: 'Contracts' },
    { value: 'photo', label: 'Photos' },
    { value: 'general', label: 'General' },
];

export default function DocumentsTab({ projectId }: DocumentsTabProps) {
    const { success, error: showError } = useToast();
    const [documents, setDocuments] = useState<ProjectDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [filter, setFilter] = useState<DocumentCategory | 'all'>('all');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
    const [setupRequired, setSetupRequired] = useState(false);

    const loadDocuments = useCallback(async () => {
        setIsLoading(true);
        const { documents: docs, error } = await getProjectDocuments(projectId);
        if (error) {
            // Check if it's a missing table error
            const errorCode = (error as Error & { code?: string }).code;
            if (error.message?.includes('does not exist') || errorCode === '42P01') {
                setSetupRequired(true);
            } else {
                showError('Failed to load documents');
            }
        } else {
            setDocuments(docs);
        }
        setIsLoading(false);
    }, [projectId, showError]);

    useEffect(() => {
        // eslint-disable-next-line
        loadDocuments();
    }, [loadDocuments]);

    const handleUpload = async (file: File, category: DocumentCategory, description?: string) => {
        setIsUploading(true);
        const { document: newDoc, error } = await uploadDocument(projectId, file, category, description);

        if (error) {
            showError(error.message);
        } else if (newDoc) {
            setDocuments((prev) => [newDoc, ...prev]);
            success('Document uploaded successfully');
        }
        setIsUploading(false);
    };

    const handleDelete = async (documentId: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;

        const { error } = await deleteDocument(documentId);
        if (error) {
            showError('Failed to delete document');
        } else {
            setDocuments((prev) => prev.filter((d) => d.id !== documentId));
            success('Document deleted');
        }
    };

    const handleView = async (document: ProjectDocument) => {
        const url = await getDocumentUrl(document.storage_path);
        if (url) {
            setPreviewDoc(document);
            setPreviewUrl(url);
        } else {
            showError('Failed to load document');
        }
    };

    const handleDownload = async (document: ProjectDocument) => {
        const url = await getDocumentUrl(document.storage_path);
        if (url) {
            const link = window.document.createElement('a');
            link.href = url;
            link.download = document.file_name;
            link.click();
        } else {
            showError('Failed to download document');
        }
    };

    const closePreview = () => {
        setPreviewDoc(null);
        setPreviewUrl(null);
    };

    const filteredDocuments = filter === 'all'
        ? documents
        : documents.filter((d) => d.category === filter);

    return (
        <>
            <div className="documents-tab">
                <div className="tab-header">
                    <div className="header-text">
                        <h3>Project Documents</h3>
                        <p>{filteredDocuments.length} files in this view</p>
                    </div>
                    <div className="filter-select">
                        <FunnelSimple size={16} />
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as DocumentCategory | 'all')}
                        >
                            {FILTER_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <DocumentUploader onUpload={handleUpload} isUploading={isUploading} />

                {setupRequired ? (
                    <div className="setup-state">
                        <Warning size={48} weight="light" />
                        <h4>Database Setup Required</h4>
                        <p>The documents feature requires running the database migration.</p>
                        <code>supabase/migrations/004_project_enhancements.sql</code>
                    </div>
                ) : isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading documents...</p>
                    </div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="empty-state">
                        <File size={48} weight="light" />
                        <h4>No documents yet</h4>
                        <p>Upload plans, permits, receipts, and photos for this project.</p>
                    </div>
                ) : (
                    <div className="documents-grid">
                        {filteredDocuments.map((doc) => (
                            <DocumentCard
                                key={doc.id}
                                document={doc}
                                onDelete={handleDelete}
                                onView={handleView}
                                onDownload={handleDownload}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {previewUrl && previewDoc && (
                <div className="preview-overlay" onClick={closePreview}>
                    <div className="preview-content" onClick={(e) => e.stopPropagation()}>
                        <div className="preview-header">
                            <h4>{previewDoc.file_name}</h4>
                            <button onClick={closePreview}>&times;</button>
                        </div>
                        <div className="preview-body">
                            {previewDoc.file_type.startsWith('image/') ? (
                                <div className="preview-image">
                                    <Image
                                        src={previewUrl}
                                        alt={previewDoc.file_name}
                                        fill
                                        sizes="(max-width: 1024px) 90vw, 1024px"
                                        style={{ objectFit: 'contain' }}
                                        unoptimized
                                    />
                                </div>
                            ) : previewDoc.file_type === 'application/pdf' ? (
                                <iframe src={previewUrl} title={previewDoc.file_name} />
                            ) : (
                                <div className="no-preview">
                                    <File size={64} weight="light" />
                                    <p>Preview not available for this file type</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .documents-tab {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                    background: rgba(255, 255, 255, 0.52);
                    border: 1px solid rgba(211, 211, 215, 0.7);
                    border-radius: 22px;
                    padding: 18px;
                    box-shadow: 0 14px 24px rgba(6, 20, 47, 0.04);
                    transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1);
                }

                .documents-tab:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 18px 28px rgba(6, 20, 47, 0.08);
                }

                .tab-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    gap: 16px;
                    flex-wrap: wrap;
                    padding: 6px 2px 4px;
                }

                .tab-header h3 {
                    font-size: 1.35rem;
                    font-weight: 700;
                    color: #0f294b;
                    margin: 0;
                }

                .header-text p {
                    margin: 4px 0 0 0;
                    color: #68809f;
                    font-size: 0.86rem;
                }

                .filter-select {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #6580a4;
                    background: rgba(255, 255, 255, 0.94);
                    border: 1px solid #d3e4f7;
                    border-radius: 10px;
                    padding: 8px 10px;
                }

                .filter-select select {
                    padding: 2px 4px;
                    border: none;
                    border-radius: 6px;
                    background: transparent;
                    font-size: 0.85rem;
                    color: #355981;
                    cursor: pointer;
                    outline: none;
                }

                .filter-select:focus-within {
                    border-color: #83b8ec;
                    box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.14);
                }

                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-2xl);
                    gap: var(--spacing-md);
                }

                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid var(--color-border);
                    border-top-color: var(--color-primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .loading-state p {
                    color: var(--color-text-secondary);
                    margin: 0;
                }

                .setup-state,
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-2xl);
                    text-align: center;
                    color: var(--color-text-muted);
                    background: rgba(247, 251, 255, 0.85);
                    border-radius: 16px;
                    border: 1px dashed #c9ddef;
                }

                .setup-state {
                    border-color: var(--color-warning);
                    background: rgba(245, 158, 11, 0.05);
                }

                .setup-state code {
                    margin-top: var(--spacing-sm);
                    padding: var(--spacing-xs) var(--spacing-sm);
                    background: var(--color-surface);
                    border-radius: var(--radius-sm);
                    font-size: 0.75rem;
                }

                .empty-state h4 {
                    margin: var(--spacing-md) 0 var(--spacing-xs) 0;
                    color: var(--color-text);
                }

                .empty-state p {
                    margin: 0;
                    font-size: 0.875rem;
                }

                .documents-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: 14px;
                }

                /* Preview Modal */
                .preview-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: var(--spacing-lg);
                }

                .preview-content {
                    background: var(--color-surface);
                    border-radius: 16px;
                    max-width: 90vw;
                    max-height: 90vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .preview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing-md);
                    border-bottom: 1px solid var(--color-border-light);
                }

                .preview-header h4 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--color-text);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .preview-header button {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: var(--color-text-muted);
                    line-height: 1;
                }

                .preview-header button:hover {
                    color: var(--color-text);
                }

                .preview-header button:focus-visible {
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.24);
                    border-radius: 8px;
                }

                .preview-body {
                    flex: 1;
                    overflow: auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-md);
                }

                .preview-image {
                    position: relative;
                    width: 100%;
                    height: 80vh;
                }

                .preview-body iframe {
                    width: 800px;
                    max-width: 100%;
                    height: 80vh;
                    border: none;
                }

                .no-preview {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: var(--spacing-md);
                    color: var(--color-text-muted);
                    padding: var(--spacing-2xl);
                }

                @media (max-width: 768px) {
                    .documents-tab {
                        padding: 14px;
                        border-radius: 16px;
                        gap: 14px;
                    }

                    .tab-header h3 {
                        font-size: 1.16rem;
                    }

                    .documents-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .documents-tab {
                        transition: none;
                        transform: none !important;
                    }
                }
            `}</style>
        </>
    );
}
