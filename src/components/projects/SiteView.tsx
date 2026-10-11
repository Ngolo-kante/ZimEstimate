'use client';

// What someone invited to a project sees: the site, not the money.
//
// Progress (stages and their tasks), site photos, and the materials list
// with quantities and how much has been used — never prices, the budget,
// purchases, documents or any of the owner's other projects. All of it
// comes from get_site_view and the photo route, which check the share in
// the database (migration 058); this page cannot ask for more than that.
//
// "edit" invitees (builders, site managers) can tick tasks, move stages
// along, log usage and add photos, and the owner is notified each time.
// "view" invitees follow along.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { prepareImageForUpload } from '@/lib/compressImage';
import {
  getSitePhotos, getSiteView, siteLogUsage, siteSetStageStatus, siteSetTask, uploadSitePhoto,
  type SitePhoto, type SiteView as SiteViewData,
} from '@/lib/services/site';
import { ArrowLeft, Camera, CheckCircle, Circle, CircleNotch, Image as ImageIcon, MapPin, Package } from '@phosphor-icons/react';

const STATUS_LABELS: Record<string, string> = {
  planning: 'Not started',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Done',
  pending_approval: 'Awaiting approval',
};

const fmt = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function SiteView({ projectId }: { projectId: string }) {
  const { success, error: showError } = useToast();
  const [view, setView] = useState<SiteViewData | null | undefined>(undefined);
  const [photos, setPhotos] = useState<SitePhoto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [usage, setUsage] = useState({ itemId: '', quantity: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const [caption, setCaption] = useState('');
  const [photoStage, setPhotoStage] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [nextView, nextPhotos] = await Promise.all([getSiteView(projectId), getSitePhotos(projectId)]);
    setView(nextView);
    setPhotos(nextPhotos.photos);
  }, [projectId]);

  useEffect(() => {
    let active = true;
    void Promise.all([getSiteView(projectId), getSitePhotos(projectId)]).then(([nextView, nextPhotos]) => {
      if (!active) return;
      setView(nextView);
      setPhotos(nextPhotos.photos);
    });
    return () => { active = false; };
  }, [projectId]);

  if (view === undefined) {
    return <div className="site-loading"><CircleNotch size={20} className="spin" /> Loading the project…</div>;
  }
  if (view === null) {
    return (
      <div className="site-empty">
        <h1>Project not found</h1>
        <p>It may have been removed, or the owner may have stopped sharing it with you.</p>
        <Link href="/projects">Back to projects</Link>
      </div>
    );
  }

  const canEdit = view.access === 'edit' || view.access === 'owner';

  const toggleTask = async (taskId: string, completed: boolean) => {
    setBusy(`task:${taskId}`);
    const { error } = await siteSetTask(taskId, completed);
    if (error) showError(error); else await refresh();
    setBusy(null);
  };

  const setStage = async (stageId: string, status: string) => {
    setBusy(`stage:${stageId}`);
    const { error } = await siteSetStageStatus(stageId, status);
    if (error) showError(error); else { success('Progress updated — the owner has been told.'); await refresh(); }
    setBusy(null);
  };

  const logUsage = async () => {
    const quantity = Number(usage.quantity);
    if (!usage.itemId || !(quantity > 0)) { showError('Choose a material and enter how much was used.'); return; }
    setBusy('usage');
    const { error } = await siteLogUsage(projectId, usage.itemId, quantity, usage.date, usage.notes);
    if (error) showError(error);
    else {
      success('Usage logged — the owner has been told.');
      setUsage((u) => ({ ...u, itemId: '', quantity: '', notes: '' }));
      await refresh();
    }
    setBusy(null);
  };

  const addPhoto = async (chosen: File | undefined) => {
    if (!chosen) return;
    setBusy('photo');
    const file = await prepareImageForUpload(chosen, 'record');
    const { error } = await uploadSitePhoto(projectId, file, caption.trim(), photoStage || null);
    if (error) showError(error);
    else { success('Photo added — the owner has been told.'); setCaption(''); await refresh(); }
    setBusy(null);
  };

  return (
    <div className="site">
      <span className="crumb-wrap"><Link href="/projects" className="crumb"><ArrowLeft size={16} /> Projects</Link></span>

      <header className="site-head">
        <h1>{view.project.name}</h1>
        {view.project.location && <p className="loc"><MapPin size={15} /> {view.project.location}</p>}
        <p className="who">
          Shared with you by {view.project.owner_name}.{' '}
          {canEdit ? 'You can report progress, log materials used and add site photos.' : 'You can follow progress.'}
        </p>
      </header>

      {/* Progress */}
      <section className="block">
        <h2>Progress</h2>
        {view.stages.length === 0 && <p className="muted">No stages have been set up yet.</p>}
        <div className="stages">
          {view.stages.map((stage) => {
            const done = stage.tasks.filter((t) => t.is_completed).length;
            return (
              <div key={stage.id} className="stage">
                <div className="stage-top">
                  <div>
                    <strong>{stage.name}</strong>
                    {stage.tasks.length > 0 && <span className="muted"> · {done}/{stage.tasks.length} tasks done</span>}
                  </div>
                  {canEdit ? (
                    <select
                      value={stage.status}
                      disabled={busy === `stage:${stage.id}`}
                      onChange={(e) => void setStage(stage.id, e.target.value)}
                      aria-label={`Status of ${stage.name}`}
                    >
                      {['planning', 'in_progress', 'on_hold', 'completed'].map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  ) : (
                    <span className={`chip ${stage.status}`}>{STATUS_LABELS[stage.status] ?? stage.status}</span>
                  )}
                </div>
                {stage.tasks.length > 0 && (
                  <ul className="tasks">
                    {stage.tasks.map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          className={`task ${task.is_completed ? 'done' : ''}`}
                          disabled={!canEdit || busy === `task:${task.id}`}
                          onClick={() => void toggleTask(task.id, !task.is_completed)}
                          aria-pressed={task.is_completed}
                        >
                          {busy === `task:${task.id}` ? <CircleNotch size={18} className="spin" /> : task.is_completed ? <CheckCircle size={18} weight="fill" /> : <Circle size={18} />}
                          <span>{task.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Photos */}
      <section className="block">
        <h2>Site photos</h2>
        {canEdit && (
          <div className="photo-form">
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What does it show? (optional)" maxLength={300} />
            {view.stages.length > 0 && (
              <select value={photoStage} onChange={(e) => setPhotoStage(e.target.value)} aria-label="Stage this photo is for">
                <option value="">Any stage</option>
                {view.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            <div className="row">
              <button type="button" className="primary" onClick={() => cameraRef.current?.click()} disabled={busy === 'photo'}>
                {busy === 'photo' ? <CircleNotch size={16} className="spin" /> : <Camera size={16} />} Take photo
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()} disabled={busy === 'photo'}>
                <ImageIcon size={16} /> Choose photo
              </button>
            </div>
          </div>
        )}
        {photos.length === 0 ? (
          <p className="muted">No photos yet.</p>
        ) : (
          <div className="photos">
            {photos.map((photo) => (
              <figure key={photo.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photo.url && <a href={photo.url} target="_blank" rel="noopener noreferrer"><img src={photo.url} alt={photo.caption || 'Site photo'} loading="lazy" /></a>}
                <figcaption>
                  {photo.caption && <span>{photo.caption}</span>}
                  <span className="muted">{photo.uploadedBy} · {new Date(photo.createdAt).toLocaleDateString()}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* Materials */}
      <section className="block">
        <h2>Materials</h2>
        {canEdit && view.materials.length > 0 && (
          <div className="usage-form">
            <select value={usage.itemId} onChange={(e) => setUsage((u) => ({ ...u, itemId: e.target.value }))} aria-label="Material used">
              <option value="">Material used…</option>
              {view.materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
            </select>
            <input type="number" min="0" step="any" inputMode="decimal" placeholder="Quantity" value={usage.quantity}
              onChange={(e) => setUsage((u) => ({ ...u, quantity: e.target.value }))} aria-label="Quantity used" />
            <input type="date" value={usage.date} onChange={(e) => setUsage((u) => ({ ...u, date: e.target.value }))} aria-label="Date used" />
            <input placeholder="Note (optional)" value={usage.notes} maxLength={200} onChange={(e) => setUsage((u) => ({ ...u, notes: e.target.value }))} />
            <button type="button" className="primary" onClick={() => void logUsage()} disabled={busy === 'usage'}>
              {busy === 'usage' ? <CircleNotch size={16} className="spin" /> : <Package size={16} />} Log usage
            </button>
          </div>
        )}
        {view.materials.length === 0 ? (
          <p className="muted">No materials listed yet.</p>
        ) : (
          <ul className="materials">
            {view.materials.map((m) => {
              const pct = m.quantity > 0 ? Math.min(100, (m.used / m.quantity) * 100) : 0;
              return (
                <li key={m.id}>
                  <div className="m-top">
                    <span>{m.name}</span>
                    <span className="muted">{fmt(m.used)} of {fmt(m.quantity)} {m.unit} used</span>
                  </div>
                  <div className="bar"><span style={{ width: `${pct}%` }} className={pct >= 80 ? 'low' : ''} /></div>
                </li>
              );
            })}
          </ul>
        )}

        {view.recent_usage.length > 0 && (
          <>
            <h3>Recently logged</h3>
            <ul className="log">
              {view.recent_usage.slice(0, 10).map((u) => (
                <li key={u.id}>
                  <span>{fmt(u.quantity_used)} {u.unit} {u.material_name}</span>
                  <span className="muted">{u.recorded_by} · {new Date(u.usage_date).toLocaleDateString()}{u.notes ? ` · ${u.notes}` : ''}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <style jsx>{`
        .site { max-width: 820px; margin: 0 auto; padding: 24px 16px 40px; }
        .crumb-wrap :global(.crumb) { display: inline-flex; align-items: center; gap: 6px; font-size: 0.875rem; color: var(--color-text-secondary); text-decoration: none; }
        .site-head { margin: 14px 0 18px; }
        h1 { margin: 0; font-size: 1.6rem; font-weight: 800; color: var(--color-text); }
        .loc { display: flex; align-items: center; gap: 5px; margin: 4px 0 0; color: var(--color-text-secondary); font-size: 0.9rem; }
        .who { margin: 10px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--color-background); border: 1px solid var(--color-border); font-size: 0.86rem; color: var(--color-text-secondary); }
        .block { margin-top: 16px; padding: 16px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); }
        h2 { margin: 0 0 12px; font-size: 1.05rem; font-weight: 700; color: var(--color-text); }
        h3 { margin: 16px 0 8px; font-size: 0.9rem; font-weight: 700; color: var(--color-text); }
        .muted { color: var(--color-text-secondary); font-size: 0.82rem; }
        .stages { display: grid; gap: 10px; }
        .stage { padding: 12px; border-radius: 10px; border: 1px solid var(--color-border-light, var(--color-border)); }
        .stage-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
        .stage-top strong { color: var(--color-text); }
        select, input { padding: 9px 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-size: max(0.9rem, 16px); min-width: 0; }
        .chip { font-size: 0.75rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: var(--color-background); color: var(--color-text-secondary); }
        .chip.completed { color: var(--color-success); }
        .chip.in_progress { color: var(--color-accent); }
        .tasks { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 4px; }
        .task { display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; padding: 8px; border: none; border-radius: 8px; background: none; color: var(--color-text); text-align: left; font-size: 0.9rem; cursor: pointer; }
        .task:hover:not(:disabled) { background: var(--color-background); }
        .task:disabled { cursor: default; }
        .task.done { color: var(--color-text-secondary); }
        .task.done span { text-decoration: line-through; }
        .task :global(svg) { flex-shrink: 0; color: var(--color-accent); }
        .photo-form, .usage-form { display: grid; gap: 8px; margin-bottom: 14px; }
        .usage-form { grid-template-columns: 2fr 1fr 1fr; }
        .usage-form input[placeholder^='Note'] { grid-column: 1 / 3; }
        .row { display: flex; gap: 8px; flex-wrap: wrap; }
        button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px; border-radius: 9px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-weight: 600; font-size: 0.88rem; cursor: pointer; }
        button.primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; }
        button:disabled { opacity: 0.6; }
        .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
        figure { margin: 0; }
        figure img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 10px; display: block; background: var(--color-background); }
        figcaption { display: grid; gap: 2px; margin-top: 4px; font-size: 0.8rem; color: var(--color-text); }
        .materials, .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        .m-top { display: flex; justify-content: space-between; gap: 10px; font-size: 0.9rem; color: var(--color-text); flex-wrap: wrap; }
        .bar { height: 6px; margin-top: 5px; border-radius: 999px; background: var(--color-background); overflow: hidden; }
        .bar span { display: block; height: 100%; background: var(--color-accent); }
        .bar span.low { background: var(--color-warning); }
        .log li { display: grid; gap: 2px; font-size: 0.88rem; color: var(--color-text); }
        .site-loading, .site-empty { max-width: 600px; margin: 60px auto; padding: 0 16px; text-align: center; color: var(--color-text-secondary); display: grid; gap: 10px; justify-items: center; }
        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .usage-form { grid-template-columns: 1fr 1fr; }
          .usage-form select, .usage-form input[placeholder^='Note'], .usage-form button { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  );
}
