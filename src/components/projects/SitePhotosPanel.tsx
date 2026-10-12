'use client';

// Site photos on the owner's project page: what the builder has sent in,
// newest first, and the owner can add their own. Same private store and
// server route as the invitees' site view.

import { useEffect, useRef, useState } from 'react';
import { Camera, CircleNotch } from '@phosphor-icons/react';
import { useToast } from '@/components/ui/Toast';
import { prepareImageForUpload } from '@/lib/compressImage';
import { getSitePhotos, uploadSitePhoto, type SitePhoto } from '@/lib/services/site';

export default function SitePhotosPanel({ projectId }: { projectId: string }) {
  const { success, error: showError } = useToast();
  const [photos, setPhotos] = useState<SitePhoto[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void getSitePhotos({ kind: 'project', id: projectId }).then((result) => { if (active) setPhotos(result.photos); });
    return () => { active = false; };
  }, [projectId]);

  const add = async (chosen: File | undefined) => {
    if (!chosen) return;
    setUploading(true);
    const { error } = await uploadSitePhoto({ kind: 'project', id: projectId }, await prepareImageForUpload(chosen, 'record'), '');
    if (error) showError(error);
    else { success('Photo added.'); setPhotos((await getSitePhotos({ kind: 'project', id: projectId })).photos); }
    setUploading(false);
  };

  return (
    <section className="panel">
      <div className="head">
        <h3>Site photos</h3>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void add(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <CircleNotch size={15} className="spin" /> : <Camera size={15} />} Add photo
        </button>
      </div>
      {photos === null ? null : photos.length === 0 ? (
        <p className="muted">No photos yet. Builders you invite can add progress photos from the site, and you&rsquo;ll be notified.</p>
      ) : (
        <div className="grid">
          {photos.slice(0, 12).map((photo) => (
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
      <style jsx>{`
        .panel { margin-top: 20px; padding: 16px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); }
        .head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
        h3 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-text); }
        button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-size: 0.82rem; font-weight: 600; cursor: pointer; }
        button:disabled { opacity: 0.6; }
        .muted { margin: 0; color: var(--color-text-secondary); font-size: 0.82rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
        figure { margin: 0; }
        img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 10px; display: block; background: var(--color-background); }
        figcaption { display: grid; gap: 2px; margin-top: 4px; font-size: 0.78rem; color: var(--color-text); }
        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}
