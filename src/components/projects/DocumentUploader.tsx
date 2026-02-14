'use client';

import { useState, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { CloudArrowUp, File, X, CircleNotch } from '@phosphor-icons/react';
import { DocumentCategory } from '@/lib/database.types';

interface DocumentUploaderProps {
    onUpload: (file: File, category: DocumentCategory, description?: string) => Promise<void>;
    isUploading?: boolean;
}

const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const CATEGORIES: { value: DocumentCategory; label: string }[] = [
    { value: 'plan', label: 'Plans & Drawings' },
    { value: 'permit', label: 'Permits & Approvals' },
    { value: 'receipt', label: 'Receipts' },
    { value: 'contract', label: 'Contracts' },
    { value: 'photo', label: 'Site Photos' },
    { value: 'general', label: 'General' },
];

export default function DocumentUploader({ onUpload, isUploading }: DocumentUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [category, setCategory] = useState<DocumentCategory>('general');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFile = (file: File): string | null => {
        if (!ALLOWED_TYPES.includes(file.type)) {
            return 'Invalid file type. Please upload an image or PDF.';
        }
        if (file.size > MAX_SIZE) {
            return 'File too large. Maximum size is 10MB.';
        }
        return null;
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        setError(null);

        const file = e.dataTransfer.files[0];
        if (file) {
            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
            } else {
                setSelectedFile(file);
            }
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const file = e.target.files?.[0];
        if (file) {
            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
            } else {
                setSelectedFile(file);
            }
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        await onUpload(selectedFile, category, description || undefined);
        setSelectedFile(null);
        setDescription('');
        setCategory('general');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCancel = () => {
        setSelectedFile(null);
        setDescription('');
        setCategory('general');
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <>
            <div className="document-uploader">
                {!selectedFile ? (
                    <div
                        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <CloudArrowUp size={40} weight="light" className="upload-icon" />
                        <p className="drop-text">
                            Drag & drop a file here, or <span className="browse-link">browse</span>
                        </p>
                        <p className="drop-hint">Images (PNG, JPEG) or PDF up to 10MB</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={ALLOWED_TYPES.join(',')}
                            onChange={handleFileSelect}
                            className="file-input"
                        />
                    </div>
                ) : (
                    <div className="file-preview">
                        <div className="file-info">
                            <div className="file-icon">
                                <File size={24} weight="light" />
                            </div>
                            <div className="file-details">
                                <span className="file-name">{selectedFile.name}</span>
                                <span className="file-size">{formatFileSize(selectedFile.size)}</span>
                            </div>
                            <button className="remove-btn" onClick={handleCancel}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="upload-options">
                            <div className="form-group">
                                <label>Category</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                                    className="category-select"
                                >
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Description (optional)</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Add a description..."
                                    className="description-input"
                                />
                            </div>

                            <div className="upload-actions">
                                <Button variant="secondary" onClick={handleCancel} disabled={isUploading}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleUpload}
                                    loading={isUploading}
                                    icon={isUploading ? <CircleNotch size={18} className="spinner" /> : <CloudArrowUp size={18} />}
                                >
                                    {isUploading ? 'Uploading...' : 'Upload'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {error && <div className="upload-error">{error}</div>}
            </div>

            <style jsx>{`
                .document-uploader {
                    width: 100%;
                }

                .drop-zone {
                    border: 2px dashed #c9ddf1;
                    border-radius: 14px;
                    padding: var(--spacing-2xl);
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: rgba(248, 252, 255, 0.9);
                }

                .drop-zone:hover,
                .drop-zone.dragging {
                    border-color: #7eafe3;
                    background: rgba(78, 154, 247, 0.08);
                }

                .drop-zone :global(.upload-icon) {
                    color: var(--color-text-muted);
                    margin-bottom: var(--spacing-md);
                }

                .drop-text {
                    color: var(--color-text-secondary);
                    margin: 0 0 var(--spacing-xs) 0;
                }

                .browse-link {
                    color: var(--color-primary);
                    text-decoration: underline;
                }

                .drop-hint {
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                    margin: 0;
                }

                .file-input {
                    display: none;
                }

                .file-preview {
                    border: 1px solid #d3e4f4;
                    border-radius: 14px;
                    padding: var(--spacing-lg);
                    background: var(--color-surface);
                }

                .file-info {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                    padding-bottom: var(--spacing-md);
                    border-bottom: 1px solid var(--color-border-light);
                    margin-bottom: var(--spacing-md);
                }

                .file-icon {
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-primary-bg);
                    color: var(--color-primary);
                    border-radius: var(--radius-md);
                }

                .file-details {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }

                .file-name {
                    font-weight: 500;
                    color: var(--color-text);
                    word-break: break-all;
                }

                .file-size {
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
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
                    background: var(--color-error-bg);
                    color: var(--color-error);
                }

                .upload-options {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-xs);
                }

                .form-group label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--color-text-secondary);
                }

                .category-select,
                .description-input {
                    padding: var(--spacing-sm) var(--spacing-md);
                    border: 1px solid #d3e4f4;
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    background: var(--color-surface);
                    color: var(--color-text);
                }

                .category-select:focus,
                .description-input:focus {
                    outline: none;
                    border-color: #7fb3ea;
                    box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.12);
                }

                .upload-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: var(--spacing-sm);
                    margin-top: var(--spacing-sm);
                }

                .upload-error {
                    margin-top: var(--spacing-sm);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--color-error-bg);
                    color: var(--color-error);
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                }

                :global(.spinner) {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
}
