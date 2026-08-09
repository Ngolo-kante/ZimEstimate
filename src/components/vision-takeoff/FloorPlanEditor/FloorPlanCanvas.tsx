'use client';

import { useRef, useEffect, useState } from 'react';
import { DetectedRoom, DetectedWall } from '@/lib/vision/types';

/**
 * Draws the detected rooms over the plan they were detected from.
 *
 * This used to discard the upload entirely — `void imageUrl` — and lay the
 * rooms out on an empty grid whose height was always 0.6 × its width. Since
 * DetectedRoom.position is expressed as a percentage *of the uploaded image*,
 * forcing those percentages into a fixed 3:5 box stretched every room by
 * whatever the plan's real aspect ratio happened to differ by. A portrait plan
 * came out squashed. There was also nothing on screen to compare the result
 * against, so a wrong detection looked identical to a right one.
 *
 * Now the canvas takes the image's own aspect ratio and draws the plan
 * underneath the overlay. The percentages become correct by construction, and
 * a misread room is obvious because it visibly fails to line up with the walls
 * beneath it.
 */

interface FloorPlanCanvasProps {
  rooms: DetectedRoom[];
  walls: DetectedWall[];
  imageUrl: string | null;
  selectedRoomId: string | null;
  onRoomSelect: (roomId: string) => void;
}

/* One hue, three tints. The previous palette cycled blue, amber, green, pink,
   purple and red, which made a six-room plan look like a chart rather than a
   drawing. Adjacent rooms still separate, because the tints alternate and every
   room carries a stroke. */
const ROOM_TINTS = [
  'rgba(37, 99, 235, 0.16)',
  'rgba(37, 99, 235, 0.10)',
  'rgba(14, 116, 144, 0.14)',
];
const ROOM_STROKE = 'rgba(30, 64, 175, 0.55)';
const ROOM_STROKE_EXTERNAL = 'rgba(15, 41, 75, 0.85)';
const ACCENT = '#B45309';
const ACCENT_FILL = 'rgba(245, 158, 11, 0.22)';

/* Plans are dark line drawings and they carry their own room names and
   dimensions. At a lighter scrim the drawing's own text stayed dark enough to
   sit right behind this overlay's labels and read as doubled. The plan needs to
   be present enough to check the rooms against, and faint enough that the
   overlay is what you read. */
const PLAN_SCRIM = 'rgba(255, 255, 255, 0.74)';

const FALLBACK_ASPECT = 0.66;

export default function FloorPlanCanvas({
  rooms,
  walls,
  imageUrl,
  selectedRoomId,
  onRoomSelect,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  /* Keyed by the url it was loaded from, so a changed upload falls back to no
     backdrop immediately rather than briefly showing the previous plan — and
     so the effect never has to set state synchronously to clear it. */
  const [loaded, setLoaded] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  void walls;

  const plan = loaded && loaded.url === imageUrl ? loaded.img : null;

  /* Height follows the plan, so room percentages map onto the same box the
     detector measured them in. */
  const aspect = plan && plan.naturalWidth > 0
    ? plan.naturalHeight / plan.naturalWidth
    : FALLBACK_ASPECT;
  const height = Math.max(280, width * aspect);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) setLoaded({ url: imageUrl, img });
    };
    // A plan that fails to load is not fatal — the overlay still works, it just
    // loses its backdrop and falls through to the grid.
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* Render at device resolution. Without this the canvas was drawn at CSS
       pixels and upscaled by the browser, which is why the labels and hairlines
       looked soft on any retina screen. */
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    /* Deliberately no inline style width/height. A canvas takes its intrinsic
       ratio from its width/height attributes, so `width:100%; height:auto` in
       the stylesheet scales it proportionally on its own. Setting an explicit
       pixel width here instead meant that whenever the container shrank faster
       than the resize observer re-rendered, `max-width:100%` capped the width
       while the inline height stayed put — measured at 693×1107, an aspect of
       1.60 against the plan's true 1.50. The plan was being stretched by the
       very code meant to stop it being stretched. */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    if (plan) {
      ctx.drawImage(plan, 0, 0, width, height);
      ctx.fillStyle = PLAN_SCRIM;
      ctx.fillRect(0, 0, width, height);
    } else {
      // No plan behind the rooms — a light grid keeps the space from reading as
      // an error state.
      ctx.strokeStyle = '#EEF2F7';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
      }
    }

    rooms.forEach((room, index) => {
      const isSelected = room.id === selectedRoomId;
      const isHovered = room.id === hoveredRoomId;

      const x = (room.position.x / 100) * width;
      const y = (room.position.y / 100) * height;
      const w = (room.position.width / 100) * width;
      const h = (room.position.height / 100) * height;

      ctx.fillStyle = isSelected
        ? ACCENT_FILL
        : ROOM_TINTS[index % ROOM_TINTS.length];
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = isSelected
        ? ACCENT
        : room.wallType === 'external'
          ? ROOM_STROKE_EXTERNAL
          : ROOM_STROKE;
      ctx.lineWidth = isSelected ? 3 : isHovered ? 2.5 : room.wallType === 'external' ? 2 : 1.25;
      ctx.strokeRect(x, y, w, h);

      /* Labels are drawn only where they fit. Three stacked lines used to be
         written into every room regardless of size, so small rooms had text
         spilling across their neighbours. */
      const cx = x + w / 2;
      const cy = y + h / 2;
      const canFitName = w > 54 && h > 22;
      const canFitArea = w > 54 && h > 40;
      const canFitDims = w > 92 && h > 58;

      if (canFitName) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const nameY = canFitArea ? cy - (canFitDims ? 13 : 7) : cy;

        // A short halo keeps the label readable over the drawing beneath it.
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.font = '600 12px Inter, system-ui, sans-serif';
        ctx.strokeText(room.name, cx, nameY);
        ctx.fillStyle = '#0F294B';
        ctx.fillText(room.name, cx, nameY);

        if (canFitArea) {
          ctx.font = '700 11px Inter, system-ui, sans-serif';
          const areaText = `${room.area.toFixed(1)}m²`;
          const areaY = canFitDims ? cy + 3 : cy + 11;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 3;
          ctx.strokeText(areaText, cx, areaY);
          ctx.fillStyle = isSelected ? ACCENT : '#1D4ED8';
          ctx.fillText(areaText, cx, areaY);
        }

        if (canFitDims) {
          ctx.font = '400 10px Inter, system-ui, sans-serif';
          const dimText = `${room.dimensions.width.toFixed(1)} × ${room.dimensions.length.toFixed(1)}m`;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 3;
          ctx.strokeText(dimText, cx, cy + 18);
          ctx.fillStyle = '#5A6F8D';
          ctx.fillText(dimText, cx, cy + 18);
        }
      }

      if (isSelected) {
        const handle = 7;
        ctx.fillStyle = ACCENT;
        [
          [x, y], [x + w, y], [x, y + h], [x + w, y + h],
          [x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2],
        ].forEach(([hx, hy]) => {
          ctx.fillRect(hx - handle / 2, hy - handle / 2, handle, handle);
        });
      }
    });
  }, [rooms, width, height, plan, selectedRoomId, hoveredRoomId]);

  /* Hit testing stays in percentage space, so it is unaffected by the aspect
     ratio change. */
  const roomAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    // Later rooms are drawn on top, so the topmost hit should win.
    return [...rooms].reverse().find(
      (room) =>
        px >= room.position.x &&
        px <= room.position.x + room.position.width &&
        py >= room.position.y &&
        py <= room.position.y + room.position.height
    );
  };

  return (
    <div ref={containerRef} className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => setHoveredRoomId(roomAt(e)?.id ?? null)}
        onMouseLeave={() => setHoveredRoomId(null)}
        onClick={(e) => {
          const room = roomAt(e);
          if (room) onRoomSelect(room.id);
        }}
        style={{ cursor: hoveredRoomId ? 'pointer' : 'default' }}
      />

      <style jsx>{`
        .canvas-wrapper {
          width: 100%;
          border-radius: var(--radius-md);
          overflow: hidden;
          border: 1px solid #dfe5ed;
          background: #fff;
        }

        canvas {
          display: block;
          width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}
