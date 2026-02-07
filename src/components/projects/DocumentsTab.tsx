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
                    <h3>Documents</h3>
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
                    gap: var(--spacing-lg);
                }

                .tab-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .tab-header h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0;
                }

                .filter-select {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    color: var(--color-text-secondary);
                }

                .filter-select select {
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    font-size: 0.875rem;
                    color: var(--color-text);
                    cursor: pointer;
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
                    background: var(--color-background);
                    border-radius: var(--radius-lg);
                    border: 1px dashed var(--color-border);
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
                    gap: var(--spacing-md);
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
                    border-radius: var(--radius-lg);
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
                    .documents-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </>
    );
}
