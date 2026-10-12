'use client';

// What someone invited to a project or quick estimate sees: the site, not
// the money.
//
// Progress (a full build's stages and tasks, or a quick estimate's steps),
// site photos, and the materials list with quantities and how much has been
// used — never prices, the budget, savings, purchases, documents or any of
// the owner's other work. All of it comes from the site functions and photo
// routes, which check the share in the database (migrations 058 and 061);
// this page cannot ask for more than that.
//
// "edit" invitees (builders, installers, site managers) can tick tasks or
// steps, move stages along, log usage and add photos, and the owner is
// notified each time. "view" invitees follow along.
//
// `embedded` is the owner's own copy of it, inside the quick estimate page:
// same data, same actions, without the page header.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { prepareImageForUpload } from '@/lib/compressImage';
import {
  getSitePhotos, getSiteView, quickAddStep, quickRemoveStep, quickResetSteps,
  siteLogUsage, siteSetStageStatus, siteSetTask, uploadSitePhoto,
  type SitePhoto, type SiteTarget, type SiteTask, type SiteView as SiteViewData,
} from '@/lib/services/site';
import { ArrowLeft, Camera, CheckCircle, Circle, CircleNotch, Image as ImageIcon, MapPin, Package, Plus, Trash, UserPlus } from '@phosphor-icons/react';

const STATUS_LABELS: Record<string, string> = {
  planning: 'Not started',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Done',
  pending_approval: 'Awaiting approval',
};

const fmt = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

// A usage date is a calendar day ("2026-10-12"). new Date() reads that as UTC
// midnight, which is the evening before anywhere west of Greenwich, so it is
// read as a local day instead.
const dayLabel = (day: string) => new Date(`${day.slice(0, 10)}T00:00:00`).toLocaleDateString();
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

interface SiteViewProps {
  target: SiteTarget;
  embedded?: boolean;
  /** Owner only: opens the invite dialog from the embedded panel. */
  onInvite?: () => void;
}

export default function SiteView({ target, embedded = false, onInvite }: SiteViewProps) {
  const { kind, id } = target;
  const { success, error: showError } = useToast();
  const [view, setView] = useState<SiteViewData | null | undefined>(undefined);
  const [photos, setPhotos] = useState<SitePhoto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [usage, setUsage] = useState({ itemId: '', quantity: '', date: today(), notes: '' });
  const [caption, setCaption] = useState('');
  const [photoStage, setPhotoStage] = useState('');
  // The owner can change a quick estimate's steps; jobs of one type still vary.
  const [editingSteps, setEditingSteps] = useState(false);
  const [newStep, setNewStep] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const t = { kind, id } as SiteTarget;
    const [nextView, nextPhotos] = await Promise.all([getSiteView(t), getSitePhotos(t)]);
    setView(nextView);
    setPhotos(nextPhotos.photos);
  }, [kind, id]);

  useEffect(() => {
    let active = true;
    const t = { kind, id } as SiteTarget;
    void Promise.all([getSiteView(t), getSitePhotos(t)]).then(([nextView, nextPhotos]) => {
      if (!active) return;
      setView(nextView);
      setPhotos(nextPhotos.photos);
    });
    return () => { active = false; };
  }, [kind, id]);

  const noun = kind === 'quick' ? 'job' : 'project';

  if (view === undefined) {
    return <div className="site-loading"><CircleNotch size={20} className="spin" /> Loading the {noun}…</div>;
  }
  if (view === null) {
    if (embedded) return null;
    return (
      <div className="site-empty">
        <h1>{kind === 'quick' ? 'Job not found' : 'Project not found'}</h1>
        <p>It may have been removed, or the owner may have stopped sharing it with you.</p>
        <Link href="/projects">Back to projects</Link>
      </div>
    );
  }

  const canEdit = view.access === 'edit' || view.access === 'owner';
  const isOwner = view.access === 'owner';
  // Who hears about a change: the owner, unless the owner made it.
  const toldOwner = isOwner ? '' : ' — the owner has been told.';

  const toggleTask = async (taskId: string, completed: boolean) => {
    setBusy(`task:${taskId}`);
    const { error } = await siteSetTask(target, taskId, completed);
    if (error) showError(error); else await refresh();
    setBusy(null);
  };

  const setStage = async (stageId: string, status: string) => {
    setBusy(`stage:${stageId}`);
    const { error } = await siteSetStageStatus(stageId, status);
    if (error) showError(error); else { success(`Progress updated${toldOwner || '.'}`); await refresh(); }
    setBusy(null);
  };

  const logUsage = async () => {
    const quantity = Number(usage.quantity);
    if (!usage.itemId || !(quantity > 0)) { showError('Choose a material and enter how much was used.'); return; }
    setBusy('usage');
    const { error } = await siteLogUsage(target, usage.itemId, quantity, usage.date, usage.notes);
    if (error) showError(error);
    else {
      success(`Usage logged${toldOwner || '.'}`);
      setUsage((u) => ({ ...u, itemId: '', quantity: '', notes: '' }));
      await refresh();
    }
    setBusy(null);
  };

  const addStep = async () => {
    const title = newStep.trim();
    if (!title) return;
    setBusy('step:add');
    const { error } = await quickAddStep(id, title);
    if (error) showError(error); else { setNewStep(''); await refresh(); }
    setBusy(null);
  };

  const removeStep = async (stepId: string) => {
    setBusy(`step:remove:${stepId}`);
    const { error } = await quickRemoveStep(id, stepId);
    if (error) showError(error); else await refresh();
    setBusy(null);
  };

  const resetSteps = async () => {
    setBusy('step:reset');
    const { error } = await quickResetSteps(id);
    if (error) showError(error); else { success('Back to the standard steps.'); await refresh(); }
    setBusy(null);
  };

  const addPhoto = async (chosen: File | undefined) => {
    if (!chosen) return;
    setBusy('photo');
    const file = await prepareImageForUpload(chosen, 'record');
    const { error } = await uploadSitePhoto(target, file, caption.trim(), photoStage || null);
    if (error) showError(error);
    else { success(`Photo added${toldOwner || '.'}`); setCaption(''); await refresh(); }
    setBusy(null);
  };

  const renderTasks = (tasks: SiteTask[]) => (
    <ul className="tasks">
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            className={`task ${task.is_completed ? 'done' : ''}`}
            disabled={!canEdit || busy === `task:${task.id}`}
            onClick={() => void toggleTask(task.id, !task.is_completed)}
            aria-pressed={task.is_completed}
          >
            {busy === `task:${task.id}` ? <CircleNotch size={18} className="spin" /> : task.is_completed ? <CheckCircle size={18} weight="fill" /> : <Circle size={18} />}
            <span className="task-text">
              <span className="task-title">{task.title}</span>
              {task.is_completed && task.completed_by && (
                <span className="task-by">{task.completed_by}{task.completed_at ? ` · ${new Date(task.completed_at).toLocaleDateString()}` : ''}</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  const stepsDone = view.steps.filter((s) => s.is_completed).length;
  // Photos can be filed under a stage (full build) or a step (quick estimate).
  const photoTags = kind === 'quick'
    ? view.steps.map((s) => ({ id: s.id, label: s.title }))
    : view.stages.map((s) => ({ id: s.id, label: s.name }));

  const materialsBlock = (
    <>
      {canEdit && view.materials.length > 0 && (
        <div className="usage-form">
          <select value={usage.itemId} onChange={(e) => setUsage((u) => ({ ...u, itemId: e.target.value }))} aria-label="Material used">
            <option value="">Material used…</option>
            {view.materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
          </select>
          <input type="number" min="0" step="any" inputMode="decimal" placeholder="Quantity" value={usage.quantity}
            onChange={(e) => setUsage((u) => ({ ...u, quantity: e.target.value }))} aria-label="Quantity used" />
          <input type="date" value={usage.date} onChange={(e) => setUsage((u) => ({ ...u, date: e.target.value }))} aria-label="Date used" />
          <input placeholder="Note (optional)" value={usage.notes} maxLength={200} aria-label="Note"
            onChange={(e) => setUsage((u) => ({ ...u, notes: e.target.value }))} className="usage-note" />
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
                <span className="muted">{u.recorded_by} · {dayLabel(u.usage_date)}{u.notes ? ` · ${u.notes}` : ''}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );

  return (
    <div className={embedded ? 'site embedded' : 'site'}>
      {embedded ? (
        <header className="embed-head">
          <div>
            <h2>On site</h2>
            <p className="muted">
              Steps, photos and materials used. Whoever you invite sees only this — never prices, your savings or your other work.
            </p>
          </div>
          {onInvite && (
            <button type="button" onClick={onInvite}>
              <UserPlus size={16} aria-hidden="true" /> Invite people
            </button>
          )}
        </header>
      ) : (
        <>
          <span className="crumb-wrap"><Link href="/projects" className="crumb"><ArrowLeft size={16} /> Projects</Link></span>
          <header className="site-head">
            <h1>{view.project.name}</h1>
            {view.project.location && <p className="loc"><MapPin size={15} /> {view.project.location}</p>}
            <p className="who">
              Shared with you by {view.project.owner_name}.{' '}
              {canEdit
                ? kind === 'quick'
                  ? 'You can tick off steps, log materials used and add site photos.'
                  : 'You can report progress, log materials used and add site photos.'
                : 'You can follow progress.'}
            </p>
          </header>
        </>
      )}

      {/* Progress */}
      <section className="block">
        {kind === 'quick' ? (
          <>
            <div className="block-head">
              <h2>Progress</h2>
              <span className="block-head-end">
                <span className="muted">{stepsDone} of {view.steps.length} steps done</span>
                {isOwner && (
                  <button type="button" className="link-btn" onClick={() => setEditingSteps((v) => !v)} aria-pressed={editingSteps}>
                    {editingSteps ? 'Done' : 'Edit steps'}
                  </button>
                )}
              </span>
            </div>
            <div className="bar progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={view.steps.length} aria-valuenow={stepsDone} aria-label="Steps done">
              <span style={{ width: `${view.steps.length ? (stepsDone / view.steps.length) * 100 : 0}%` }} />
            </div>
            {view.steps.length === 0 && !editingSteps && (
              <p className="muted">{isOwner ? 'No steps. Use Edit steps to add the ones this job needs.' : 'The owner has not set any steps yet.'}</p>
            )}
            {editingSteps ? (
              <>
                <ul className="tasks">
                  {view.steps.map((step) => (
                    <li key={step.id} className="step-edit">
                      <span className="task-text">
                        <span className="task-title">{step.title}</span>
                        {step.is_completed && <span className="task-by">Done — removing it also removes the tick</span>}
                      </span>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => void removeStep(step.id)}
                        disabled={busy === `step:remove:${step.id}`}
                        aria-label={`Remove step: ${step.title}`}
                      >
                        {busy === `step:remove:${step.id}` ? <CircleNotch size={16} className="spin" /> : <Trash size={16} />}
                      </button>
                    </li>
                  ))}
                </ul>
                <form className="step-add" onSubmit={(e) => { e.preventDefault(); void addStep(); }}>
                  <input
                    value={newStep}
                    onChange={(e) => setNewStep(e.target.value)}
                    placeholder="Add a step, e.g. ZINWA registration"
                    maxLength={120}
                    aria-label="New step"
                  />
                  <button type="submit" className="primary" disabled={!newStep.trim() || busy === 'step:add'}>
                    {busy === 'step:add' ? <CircleNotch size={16} className="spin" /> : <Plus size={16} />} Add
                  </button>
                </form>
                {view.stepsCustomised && (
                  <button type="button" className="link-btn reset" onClick={() => void resetSteps()} disabled={busy === 'step:reset'}>
                    Go back to the standard steps
                  </button>
                )}
              </>
            ) : renderTasks(view.steps)}
          </>
        ) : (
          <>
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
                    {stage.tasks.length > 0 && renderTasks(stage.tasks)}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Photos */}
      <section className="block">
        <h2>Site photos</h2>
        {canEdit && (
          <div className="photo-form">
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What does it show? (optional)" maxLength={300} aria-label="Photo caption" />
            {photoTags.length > 0 && (
              <select value={photoStage} onChange={(e) => setPhotoStage(e.target.value)} aria-label={kind === 'quick' ? 'Step this photo is for' : 'Stage this photo is for'}>
                <option value="">{kind === 'quick' ? 'Any step' : 'Any stage'}</option>
                {photoTags.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
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
          <p className="muted">{isOwner ? 'No photos yet. People you invite can add progress photos from site, and you’ll be told.' : 'No photos yet.'}</p>
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

      {/* Materials. On the owner's estimate page the full BOQ is just below,
          so this folds away until it is wanted. */}
      <section className="block">
        {embedded ? (
          <details>
            <summary><h2>Materials used</h2><span className="muted">{view.recent_usage.length > 0 ? `${view.recent_usage.length} logged` : 'Nothing logged yet'}</span></summary>
            <div className="details-body">{materialsBlock}</div>
          </details>
        ) : (
          <>
            <h2>Materials</h2>
            {materialsBlock}
          </>
        )}
      </section>

      <style jsx>{`
        .site { max-width: 820px; margin: 0 auto; padding: 24px 16px 40px; }
        .site.embedded { max-width: none; margin: 0 0 24px; padding: 0; }
        .site :global(.crumb-wrap .crumb) { display: inline-flex; align-items: center; gap: 6px; font-size: 0.875rem; color: var(--color-text-secondary); text-decoration: none; }
        .site :global(.site-head) { margin: 14px 0 18px; }
        .site :global(.embed-head) { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
        .site :global(.embed-head h2) { font-size: 1.15rem; margin: 0 0 4px; }
        .site :global(.embed-head p) { margin: 0; max-width: 560px; }
        .site :global(h1) { margin: 0; font-size: 1.6rem; font-weight: 800; color: var(--color-text); }
        .site :global(.loc) { display: flex; align-items: center; gap: 5px; margin: 4px 0 0; color: var(--color-text-secondary); font-size: 0.9rem; }
        .site :global(.who) { margin: 10px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--color-background); border: 1px solid var(--color-border); font-size: 0.86rem; color: var(--color-text-secondary); }
        .site :global(.block) { margin-top: 16px; padding: 16px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); }
        .site :global(.block-head) { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
        .site :global(.block-head h2) { margin: 0; }
        .site :global(.block-head-end) { display: inline-flex; align-items: center; gap: 10px; }
        .site :global(button.link-btn) { min-height: 36px; padding: 6px 10px; border: none; background: none; color: var(--color-accent); font-size: 0.85rem; }
        .site :global(button.link-btn:hover) { text-decoration: underline; }
        .site :global(button.link-btn.reset) { margin-top: 8px; padding-left: 0; }
        .site :global(.step-edit) { display: flex; align-items: center; gap: 10px; padding: 6px 4px 6px 8px; border-radius: 8px; background: var(--color-background); }
        .site :global(.step-edit .task-title) { font-size: 0.9rem; color: var(--color-text); }
        .site :global(button.icon-btn) { flex-shrink: 0; width: 44px; padding: 0; color: var(--color-text-secondary); }
        .site :global(button.icon-btn:hover) { color: var(--color-error, #b91c1c); border-color: currentColor; }
        .site :global(.step-add) { display: flex; gap: 8px; margin-top: 10px; }
        .site :global(.step-add input) { flex: 1; }
        .site :global(h2) { margin: 0 0 12px; font-size: 1.05rem; font-weight: 700; color: var(--color-text); }
        .site :global(h3) { margin: 16px 0 8px; font-size: 0.9rem; font-weight: 700; color: var(--color-text); }
        .site :global(.muted) { color: var(--color-text-secondary); font-size: 0.82rem; }
        .site :global(.stages) { display: grid; gap: 10px; }
        .site :global(.stage) { padding: 12px; border-radius: 10px; border: 1px solid var(--color-border-light, var(--color-border)); }
        .site :global(.stage-top) { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
        .site :global(.stage-top strong) { color: var(--color-text); }
        .site :global(select), .site :global(input) { padding: 9px 10px; min-height: 44px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-size: max(0.9rem, 16px); min-width: 0; }
        .site :global(.chip) { font-size: 0.75rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: var(--color-background); color: var(--color-text-secondary); }
        .site :global(.chip.completed) { color: var(--color-success); }
        .site :global(.chip.in_progress) { color: var(--color-accent); }
        .site :global(.tasks) { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 4px; }
        .site :global(.task) { display: flex; align-items: center; justify-content: flex-start; gap: 10px; width: 100%; min-height: 44px; padding: 8px; border: none; border-radius: 8px; background: none; color: var(--color-text); text-align: left; font-size: 0.9rem; font-weight: 500; cursor: pointer; }
        .site :global(.task:hover:not(:disabled)) { background: var(--color-background); }
        .site :global(.task:disabled) { cursor: default; opacity: 1; }
        .site :global(.task.done .task-title) { color: var(--color-text-secondary); text-decoration: line-through; }
        .site :global(.task-text) { display: grid; gap: 1px; flex: 1; min-width: 0; }
        .site :global(.task-by) { font-size: 0.75rem; font-weight: 400; color: var(--color-text-secondary); }
        .site :global(.task svg) { flex-shrink: 0; color: var(--color-accent); }
        .site :global(.photo-form), .site :global(.usage-form) { display: grid; gap: 8px; margin-bottom: 14px; }
        .site :global(.usage-form) { grid-template-columns: 2fr 1fr 1fr; }
        .site :global(.usage-note) { grid-column: 1 / 3; }
        .site :global(.row) { display: flex; gap: 8px; flex-wrap: wrap; }
        .site :global(button) { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 10px 14px; border-radius: 9px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-weight: 600; font-size: 0.88rem; cursor: pointer; }
        .site :global(button.primary) { background: var(--color-accent); border-color: var(--color-accent); color: #fff; }
        .site :global(button:disabled) { opacity: 0.6; }
        .site :global(button:focus-visible), .site :global(summary:focus-visible) { outline: 2px solid var(--color-focus-ring, #2e6cf6); outline-offset: 2px; }
        .site :global(.photos) { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
        .site :global(figure) { margin: 0; }
        .site :global(figure img) { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 10px; display: block; background: var(--color-background); }
        .site :global(figcaption) { display: grid; gap: 2px; margin-top: 4px; font-size: 0.8rem; color: var(--color-text); }
        .site :global(.materials), .site :global(.log) { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        .site :global(.m-top) { display: flex; justify-content: space-between; gap: 10px; font-size: 0.9rem; color: var(--color-text); flex-wrap: wrap; }
        .site :global(.bar) { height: 6px; margin-top: 5px; border-radius: 999px; background: var(--color-background); overflow: hidden; }
        .site :global(.bar span) { display: block; height: 100%; background: var(--color-accent); }
        .site :global(.bar span.low) { background: var(--color-warning); }
        .site :global(.progress-bar) { height: 8px; margin: 0 0 4px; }
        .site :global(.progress-bar span) { background: var(--color-success); }
        .site :global(.log li) { display: grid; gap: 2px; font-size: 0.88rem; color: var(--color-text); }
        .site :global(details summary) { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; cursor: pointer; list-style: none; min-height: 32px; }
        .site :global(details summary::-webkit-details-marker) { display: none; }
        .site :global(details summary h2) { margin: 0; }
        .site :global(details summary h2::after) { content: ' ▾'; color: var(--color-text-secondary); font-size: 0.85em; }
        .site :global(details[open] summary h2::after) { content: ' ▴'; }
        .site :global(.details-body) { margin-top: 12px; }
        .site-loading, .site-empty { max-width: 600px; margin: 60px auto; padding: 0 16px; text-align: center; color: var(--color-text-secondary); display: grid; gap: 10px; justify-items: center; }
        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .site :global(.usage-form) { grid-template-columns: 1fr 1fr; }
          .site :global(.usage-form select), .site :global(.usage-note), .site :global(.usage-form button) { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  );
}
