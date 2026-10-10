'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { Camera, CloudArrowUp, File, X } from '@phosphor-icons/react';
import type { DocumentCategory } from '@/lib/database.types';
import { DOCUMENT_ACCEPT, validateDocumentFile } from '@/lib/documentFiles';

interface DocumentUploaderProps {
    onUpload: (file: File, category: DocumentCategory, description?: string) => Promise<void>;
    isUploading?: boolean;
}
const CATEGORIES: { value: DocumentCategory; label: string }[] = [
    { value: 'plan', label: 'Plans & Drawings' }, { value: 'permit', label: 'Permits & Approvals' },
    { value: 'receipt', label: 'Receipts' }, { value: 'contract', label: 'Contracts' },
    { value: 'photo', label: 'Site Photos' }, { value: 'general', label: 'General' },
];

export default function DocumentUploader({ onUpload, isUploading }: DocumentUploaderProps) {
    const id = useId();
    const fileInput = useRef<HTMLInputElement>(null);
    const cameraInput = useRef<HTMLInputElement>(null);
    const busy = useRef(false);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [category, setCategory] = useState<DocumentCategory>('general');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState('');
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const disabled = uploading || isUploading;

    useEffect(() => {
        if (!file || !file.type.startsWith('image/')) { setPreview(null); return; }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const chooseFile = (chosen?: File) => {
        if (!chosen || busy.current || isUploading) return;
        const message = validateDocumentFile(chosen);
        setError(message);
        setStatus('');
        if (!message) setFile(chosen);
    };
    const upload = async () => {
        if (!file || busy.current || isUploading) return;
        busy.current = true;
        setUploading(true);
        setError(null);
        setStatus('Uploading your document…');
        try {
            await onUpload(file, category, description.trim() || undefined);
            setStatus(`${file.name} saved to this project.`);
            setFile(null);
            setDescription('');
            setCategory('general');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed. Your file is still selected—try again.');
            setStatus('');
        } finally {
            busy.current = false;
            setUploading(false);
        }
    };
    return (
        <section className={`uploader ${dragging ? 'dragging' : ''}`} aria-label="Upload project document" aria-busy={disabled}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]); }}>
            <input ref={fileInput} type="file" accept={DOCUMENT_ACCEPT} hidden onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = ''; }} />
            {file ? <>
                <div className="selected-file">
                    {preview ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={preview} alt="Selected document preview" /> : <File size={36} />}
                    <div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to upload</span></div>
                    <button type="button" disabled={disabled} aria-label="Remove selected file" onClick={() => { setFile(null); setError(null); setStatus(''); }}><X size={20} /></button>
                </div>
                <div className="fields">
                    <label htmlFor={`${id}-category`}>Category<select id={`${id}-category`} value={category} disabled={disabled} onChange={e => setCategory(e.target.value as DocumentCategory)}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
                    <label htmlFor={`${id}-description`}>Description (optional)<input id={`${id}-description`} value={description} disabled={disabled} onChange={e => setDescription(e.target.value)} placeholder="e.g. Foundation delivery receipt" /></label>
                </div>
                <div className="actions"><Button variant="secondary" disabled={disabled} onClick={() => fileInput.current?.click()}>Choose another</Button><Button onClick={upload} loading={disabled} icon={<CloudArrowUp size={18} />}>{error ? 'Retry upload' : 'Upload document'}</Button></div>
            </> : <>
                <CloudArrowUp size={32} weight="duotone" />
                <h3>Keep your project paperwork together</h3>
                <p>Drop a file here, choose a document, or take a photo.</p>
                <div className="actions"><Button disabled={disabled} onClick={() => fileInput.current?.click()}>Choose file</Button><Button variant="secondary" disabled={disabled} icon={<Camera size={18} />} onClick={() => cameraInput.current?.click()}>Take photo</Button></div>
                <small>Images or PDFs · Up to 10 MB per file</small>
            </>}
            <p role="status" className="status">{status}</p>
            {error && <p role="alert" className="error">{error}</p>}
            <style jsx>{`
                .uploader { padding: 24px; border: 1px dashed #aebed0; border-radius: 12px; background: #f8fafc; text-align: center; color: #334155; }
                .dragging { border-color: #2563eb; background: #eff6ff; }
                h3 { font-size: 1rem; margin: 10px 0 6px; color: #0b1f3b; }
                p { margin: 6px 0 16px; font-size: .9rem; }
                small { display: block; font-size: .8rem; margin-top: 14px; }
                .actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
                .selected-file { display: flex; align-items: center; gap: 14px; text-align: left; }
                .selected-file img { width: 64px; height: 72px; object-fit: cover; border-radius: 6px; }
                .selected-file div { flex: 1; min-width: 0; overflow-wrap: anywhere; }
                .selected-file span { display: block; font-size: .8rem; margin-top: 4px; }
                .selected-file button { min-width: 44px; min-height: 44px; display: grid; place-items: center; border: 1px solid #cbd5e1; border-radius: 6px; background: white; cursor: pointer; }
                .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 20px 0; text-align: left; }
                label { display: grid; gap: 6px; font-size: .875rem; font-weight: 600; }
                input, select { width: 100%; min-width: 0; min-height: 46px; padding: 10px; border: 1px solid #b8c7d8; border-radius: 6px; background: white; font: inherit; }
                :is(input, select, button):focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
                .error { color: #b91c1c; margin: 14px 0 0; }
                .status { color: #166534; margin: 12px 0 0; }
                .status:empty { display: none; }
                @media(max-width: 600px) { .uploader { padding: 18px 14px; } .fields { grid-template-columns: 1fr; } input, select { font-size: 16px; } }
            `}</style>
        </section>
    );
}
