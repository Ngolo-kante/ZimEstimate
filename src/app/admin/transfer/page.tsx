'use client';

// TEMPORARY: file transfer to the owner's Mac (TM Data). Remove with
// src/app/api/admin/transfer and scripts/tm-transfer-download.mjs once done.

import { useCallback, useRef, useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { supabase } from '@/lib/supabase';

const BUCKET = 'tm-transfer';
const PART_BYTES = 40 * 1024 * 1024;

type Row = { key: string; name: string; size: number; sent: number; state: 'waiting' | 'sending' | 'done' | 'failed'; error?: string };

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

export default function AdminTransferPage() {
  const { adminId, checking } = useAdminAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const call = useCallback(async (body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Your session expired. Please sign in again.');
    const response = await fetch('/api/admin/transfer', {
      method: 'POST', cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }, []);

  const update = (key: string, patch: Partial<Row>) => setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));

  const sendFile = useCallback(async (file: File, key: string) => {
    const id = crypto.randomUUID();
    const name = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = Math.max(1, Math.ceil(file.size / PART_BYTES));
    update(key, { state: 'sending' });
    for (let part = 0; part < parts; part++) {
      const piece = file.slice(part * PART_BYTES, Math.min(file.size, (part + 1) * PART_BYTES));
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const signed = await call({ action: 'sign', id, part });
          const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(signed.path, signed.token, piece, { contentType: 'application/octet-stream' });
          if (error) throw error;
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        }
      }
      if (lastError) throw lastError instanceof Error ? lastError : new Error('Upload failed.');
      update(key, { sent: Math.min(file.size, (part + 1) * PART_BYTES) });
    }
    await call({ action: 'complete', id, name, size: file.size, parts });
    update(key, { state: 'done', sent: file.size });
  }, [call]);

  const start = useCallback(async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = [...list];
    const added = files.map((file, index) => ({ key: `${Date.now()}-${index}`, name: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, size: file.size, sent: 0, state: 'waiting' as const }));
    setRows((current) => [...added, ...current]);
    setBusy(true);
    for (let i = 0; i < files.length; i++) {
      try {
        await sendFile(files[i], added[i].key);
      } catch (error) {
        update(added[i].key, { state: 'failed', error: error instanceof Error ? error.message : 'Upload failed.' });
      }
    }
    setBusy(false);
    if (fileInput.current) fileInput.current.value = '';
    if (folderInput.current) folderInput.current.value = '';
  }, [sendFile]);

  if (checking || !adminId) return <div style={{ padding: 32 }}>Checking access…</div>;

  const done = rows.filter((row) => row.state === 'done').length;
  const failed = rows.filter((row) => row.state === 'failed');

  return (
    <div className="transfer">
      <h1>Transfer files</h1>
      <p className="lede">Temporary. Files go to private storage and are saved automatically to <strong>Documents › TM Data</strong> on the office Mac, then removed from storage. Keep this tab open until every file shows ✓.</p>

      <div className="actions">
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>Choose files</button>
        <button type="button" disabled={busy} onClick={() => folderInput.current?.click()}>Choose a folder</button>
        <input ref={fileInput} type="file" multiple hidden onChange={(event) => void start(event.target.files)} />
        <input ref={folderInput} type="file" multiple hidden onChange={(event) => void start(event.target.files)} {...{ webkitdirectory: '', directory: '' }} />
      </div>

      {rows.length > 0 && (
        <p className="summary">{busy ? 'Uploading… do not close this tab.' : 'Finished.'} {done} of {rows.length} uploaded{failed.length ? `, ${failed.length} failed` : ''}.</p>
      )}
      {failed.length > 0 && !busy && (
        <p className="warn">Some files failed. Choose them again to retry.</p>
      )}

      <ul className="rows">
        {rows.map((row) => (
          <li key={row.key} className={row.state}>
            <span className="name">{row.name}</span>
            <span className="size">{row.state === 'sending' ? `${mb(row.sent)} / ${mb(row.size)}` : mb(row.size)}</span>
            <span className="state">{row.state === 'done' ? '✓' : row.state === 'failed' ? `✗ ${row.error ?? ''}` : row.state === 'sending' ? '…' : ''}</span>
          </li>
        ))}
      </ul>

      <style jsx>{`
        .transfer { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
        h1 { font-size: 1.4rem; font-weight: 800; color: var(--color-primary); margin: 0 0 8px; }
        .lede { color: #475569; font-size: 0.9rem; line-height: 1.5; margin: 0 0 18px; }
        .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
        .actions button { min-height: 44px; padding: 0 18px; border-radius: 10px; border: 1px solid #2e6cf6; background: #2e6cf6; color: white; font-weight: 700; cursor: pointer; }
        .actions button:last-of-type { background: white; color: #2e6cf6; }
        .actions button:disabled { opacity: 0.5; cursor: not-allowed; }
        .summary { font-weight: 700; color: #0f172a; margin: 0 0 6px; }
        .warn { color: #b45309; font-size: 0.85rem; margin: 0 0 8px; }
        .rows { list-style: none; padding: 0; margin: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
        .rows li { display: grid; grid-template-columns: 1fr auto 80px; gap: 10px; align-items: center; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem; }
        .rows li:last-child { border-bottom: none; }
        .name { overflow-wrap: anywhere; }
        .size { color: #64748b; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .state { text-align: right; font-weight: 700; }
        li.done .state { color: #15803d; }
        li.failed .state { color: #b91c1c; font-size: 0.75rem; }
      `}</style>
    </div>
  );
}
