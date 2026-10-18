'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { DetectedRoom, DetectedWall, PlanBox } from '@/lib/vision/types';
import { maskFromPixels, planScale, roomAround, snapEdge, type DarkMask, type PixelBox } from '@/lib/vision/planWalls';

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
  showOverlay: boolean;
  showWalls: boolean;
  zoom: number;
  floorBoundary: PlanBox | null;
  drawMode: 'room' | 'boundary' | null;
  onBoxDrawn: (box: PlanBox) => void;
  /** Rooms whose size is known (printed, matched or checked): they set the plan's scale. */
  knownSizeIds: string[];
  /** A selected room's box moved or resized; `measured` is its size in metres, if the scale is known. */
  onRoomBoxChange: (roomId: string, box: PlanBox, measured: Measured | null) => void;
  /** A tap where no room is drawn: the walls found around it, if any. */
  onEmptyTap: (box: PlanBox | null, measured: Measured | null) => void;
  onScaleKnown: (known: boolean) => void;
  /** Where each room's name is printed on the plan (percent), for lining its box up with its walls. */
  anchors: Array<{ roomId: string; at: { x: number; y: number } }>;
  /** Boxes found around the printed names, once per plan. */
  onRoomsPlaced: (positions: Record<string, PlanBox>) => void;
}

export type Measured = { width: number; length: number };

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const HANDLE_CURSOR: Record<Handle, string> = {
  move: 'move', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};

/** The mask is made at this size: walls stay several pixels thick, and it is quick. */
const MASK_SIDE = 1_400;
/** How close, in screen pixels, a finger or pointer must be to grab a handle or meet a wall. */
const GRAB_PX = 18;
const SNAP_PX = 14;

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
  showOverlay,
  showWalls,
  zoom,
  floorBoundary,
  drawMode,
  onBoxDrawn,
  knownSizeIds,
  onRoomBoxChange,
  onEmptyTap,
  onScaleKnown,
  anchors,
  onRoomsPlaced,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  /* Keyed by the url it was loaded from, so a changed upload falls back to no
     backdrop immediately rather than briefly showing the previous plan — and
     so the effect never has to set state synchronously to clear it. */
  const [loaded, setLoaded] = useState<{ url: string; img: HTMLImageElement; mask: DarkMask | null } | null>(null);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draftBox, setDraftBox] = useState<PlanBox | null>(null);
  /* A room being moved or resized: drawn from here until it is let go, then
     handed up once, so one drag is one step to undo. */
  const [editing, setEditing] = useState<{ roomId: string; handle: Handle; start: { x: number; y: number }; from: PlanBox; box: PlanBox } | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string | null>(null);
  const draggedRef = useRef(false);

  const plan = loaded && loaded.url === imageUrl ? loaded.img : null;
  const mask = loaded && loaded.url === imageUrl ? loaded.mask : null;

  const toPixels = (box: PlanBox, m: DarkMask): PixelBox => ({
    x0: (box.x / 100) * m.width, y0: (box.y / 100) * m.height,
    x1: ((box.x + box.width) / 100) * m.width, y1: ((box.y + box.height) / 100) * m.height,
  });

  /* Metres per mask pixel, from the rooms whose size is known — see
     planWalls.ts. Null until at least two agree. */
  const knownKey = knownSizeIds.join(',');
  const scale = useMemo(() => {
    if (!mask) return null;
    const known = rooms
      .filter((room) => knownKey.split(',').includes(room.id) && room.position.width > 0 && room.position.height > 0)
      .map((room) => ({ box: toPixels(room.position, mask), width: room.dimensions.width, length: room.dimensions.length }));
    return planScale(mask, known);
  }, [mask, rooms, knownKey]);

  useEffect(() => { onScaleKnown(scale !== null); }, [scale, onScaleKnown]);

  /* The AI's boxes can be far off — one reading of a test plan put every
     room upside down — but a room's printed name is where the room is. Each
     named room's box goes onto the walls around its name, once per plan,
     when the walls found have the room's proportions. */
  const anchorKey = `${imageUrl}|${anchors.map((a) => `${a.roomId}@${a.at.x.toFixed(1)},${a.at.y.toFixed(1)}`).join(';')}`;
  const placedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mask || anchors.length === 0 || placedKeyRef.current === anchorKey) return;
    placedKeyRef.current = anchorKey;
    const found: Record<string, PlanBox> = {};
    for (const { roomId, at } of anchors) {
      const room = rooms.find((r) => r.id === roomId);
      const box = roomAround(mask, (at.x / 100) * mask.width, (at.y / 100) * mask.height);
      if (!room || !box || room.dimensions.width <= 0 || room.dimensions.length <= 0) continue;
      const shape = (box.x1 - box.x0) / (box.y1 - box.y0);
      const ratio = room.dimensions.width / room.dimensions.length;
      const fits = (r: number) => shape / r >= 0.7 && shape / r <= 1.4;
      if (!fits(ratio) && !fits(1 / ratio)) continue;
      found[roomId] = {
        x: (box.x0 / mask.width) * 100, y: (box.y0 / mask.height) * 100,
        width: ((box.x1 - box.x0) / mask.width) * 100, height: ((box.y1 - box.y0) / mask.height) * 100,
      };
    }
    // Two names in one open space find the same walls: that space is no one room's.
    const ids = Object.keys(found);
    const same = (a: PlanBox, b: PlanBox) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
    for (const id of ids) if (ids.some((other) => other !== id && found[other] && same(found[id], found[other]))) delete found[id];
    if (Object.keys(found).length > 0) onRoomsPlaced(found);
  }, [mask, anchors, anchorKey, rooms, onRoomsPlaced]);

  const measure = (box: PlanBox): Measured | null => {
    if (!mask || !scale) return null;
    const tenth = (n: number) => Math.round(n * 10) / 10;
    return { width: tenth((box.width / 100) * mask.width * scale), length: tenth((box.height / 100) * mask.height * scale) };
  };

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
      if (cancelled) return;
      // A dark mask of the plan for finding walls. A plan from another site
      // without CORS cannot be read back; editing then simply does not snap.
      let planMask: DarkMask | null = null;
      try {
        const k = Math.min(1, MASK_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const off = document.createElement('canvas');
        off.width = Math.max(1, Math.round(img.naturalWidth * k));
        off.height = Math.max(1, Math.round(img.naturalHeight * k));
        const octx = off.getContext('2d', { willReadFrequently: true });
        if (octx) {
          octx.fillStyle = '#fff';
          octx.fillRect(0, 0, off.width, off.height);
          octx.drawImage(img, 0, 0, off.width, off.height);
          planMask = maskFromPixels(octx.getImageData(0, 0, off.width, off.height).data, off.width, off.height);
        }
      } catch {
        planMask = null;
      }
      setLoaded({ url: imageUrl, img, mask: planMask });
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

  const live = editing ? measure(editing.box) : null;
  const liveText = live ? `${live.width.toFixed(1)} × ${live.length.toFixed(1)} m` : null;

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
      if (showOverlay) {
        ctx.fillStyle = PLAN_SCRIM;
        ctx.fillRect(0, 0, width, height);
      }
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

    if (!showOverlay) return;

    rooms.forEach((room, index) => {
      const isSelected = room.id === selectedRoomId;
      const isHovered = room.id === hoveredRoomId;

      const position = editing?.roomId === room.id ? editing.box : room.position;
      const x = (position.x / 100) * width;
      const y = (position.y / 100) * height;
      const w = (position.width / 100) * width;
      const h = (position.height / 100) * height;

      ctx.fillStyle = isSelected
        ? ACCENT_FILL
        : ROOM_TINTS[index % ROOM_TINTS.length];
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = isSelected
        ? ACCENT
        : room.manuallyPlaced
          ? '#B45309'
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
        // Big enough to see and to hit with a thumb; grabbed within GRAB_PX.
        const handle = 12;
        [
          [x, y], [x + w, y], [x, y + h], [x + w, y + h],
          [x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2],
        ].forEach(([hx, hy]) => {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(hx - handle / 2, hy - handle / 2, handle, handle);
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 2;
          ctx.strokeRect(hx - handle / 2, hy - handle / 2, handle, handle);
        });
        // The size as it is dragged, measured to the plan's scale.
        if (editing?.roomId === room.id && liveText) {
          ctx.font = '700 12px Inter, system-ui, sans-serif';
          const textWidth = ctx.measureText(liveText).width;
          const pillX = Math.max(2, Math.min(width - textWidth - 18, x + w / 2 - textWidth / 2 - 8));
          const pillY = y > 30 ? y - 28 : y + h + 6;
          ctx.fillStyle = ACCENT;
          ctx.fillRect(pillX, pillY, textWidth + 16, 22);
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(liveText, pillX + 8, pillY + 11);
        }
      }
    });

    if (showWalls) {
      walls.forEach((wall) => {
        ctx.beginPath();
        ctx.moveTo(wall.startPoint.x / 100 * width, wall.startPoint.y / 100 * height);
        ctx.lineTo(wall.endPoint.x / 100 * width, wall.endPoint.y / 100 * height);
        ctx.strokeStyle = wall.type === 'external' ? '#0F294B' : '#B45309';
        ctx.lineWidth = wall.type === 'external' ? 3 : 2;
        ctx.stroke();
      });
    }

    if (floorBoundary) {
      ctx.save();
      ctx.setLineDash([8, 5]);
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 3;
      ctx.strokeRect(floorBoundary.x / 100 * width, floorBoundary.y / 100 * height, floorBoundary.width / 100 * width, floorBoundary.height / 100 * height);
      ctx.restore();
    }
    if (draftBox) {
      ctx.fillStyle = drawMode === 'boundary' ? 'rgba(21, 128, 61, .12)' : 'rgba(180, 83, 9, .18)';
      ctx.fillRect(draftBox.x / 100 * width, draftBox.y / 100 * height, draftBox.width / 100 * width, draftBox.height / 100 * height);
      ctx.strokeStyle = drawMode === 'boundary' ? '#15803d' : '#B45309';
      ctx.lineWidth = 2;
      ctx.strokeRect(draftBox.x / 100 * width, draftBox.y / 100 * height, draftBox.width / 100 * width, draftBox.height / 100 * height);
    }
  }, [rooms, walls, width, height, plan, selectedRoomId, hoveredRoomId, showOverlay, showWalls, floorBoundary, draftBox, drawMode, editing, liveText]);

  const pointerPercent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100)),
      y: Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100)),
    };
  };

  const boxFrom = (start: { x: number; y: number }, end: { x: number; y: number }): PlanBox => ({
    x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y),
  });

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

  /** Which part of the selected room a pointer is on: a handle, its middle, or nothing. */
  const handleAt = (point: { x: number; y: number }, rect: DOMRect): Handle | null => {
    const room = rooms.find((r) => r.id === selectedRoomId);
    if (!room || !showOverlay || room.position.width <= 0) return null;
    const box = room.position;
    const gx = (GRAB_PX / rect.width) * 100;
    const gy = (GRAB_PX / rect.height) * 100;
    const nearLeft = Math.abs(point.x - box.x) <= gx;
    const nearRight = Math.abs(point.x - (box.x + box.width)) <= gx;
    const nearTop = Math.abs(point.y - box.y) <= gy;
    const nearBottom = Math.abs(point.y - (box.y + box.height)) <= gy;
    const withinX = point.x >= box.x - gx && point.x <= box.x + box.width + gx;
    const withinY = point.y >= box.y - gy && point.y <= box.y + box.height + gy;
    if (!withinX || !withinY) return null;
    const v = nearTop ? 'n' : nearBottom ? 's' : '';
    const h = nearLeft ? 'w' : nearRight ? 'e' : '';
    if (v || h) return (v + h) as Handle;
    return point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height ? 'move' : null;
  };

  /** The box as dragged so far, its moving edges pulled onto a nearby wall. */
  const dragged = (state: NonNullable<typeof editing>, point: { x: number; y: number }, rect: DOMRect): PlanBox => {
    const dx = point.x - state.start.x;
    const dy = point.y - state.start.y;
    const f = state.from;
    if (state.handle === 'move') {
      return {
        ...f,
        x: Math.max(0, Math.min(100 - f.width, f.x + dx)),
        y: Math.max(0, Math.min(100 - f.height, f.y + dy)),
      };
    }
    let left = f.x;
    let right = f.x + f.width;
    let top = f.y;
    let bottom = f.y + f.height;
    const min = 1;
    if (state.handle.includes('w')) left = Math.min(right - min, Math.max(0, left + dx));
    if (state.handle.includes('e')) right = Math.max(left + min, Math.min(100, right + dx));
    if (state.handle.includes('n')) top = Math.min(bottom - min, Math.max(0, top + dy));
    if (state.handle.includes('s')) bottom = Math.max(top + min, Math.min(100, bottom + dy));
    if (mask) {
      const sx = mask.width / 100;
      const sy = mask.height / 100;
      const rx = (SNAP_PX / rect.width) * mask.width;
      const ry = (SNAP_PX / rect.height) * mask.height;
      const snap = (vertical: boolean, at: number, from: number, to: number, inside: 1 | -1) => {
        const scaleAlong = vertical ? sx : sy;
        const found = snapEdge(mask, vertical, at * scaleAlong, from * (vertical ? sy : sx), to * (vertical ? sy : sx), inside, vertical ? rx : ry);
        return found === null ? at : found / scaleAlong;
      };
      if (state.handle.includes('w')) left = snap(true, left, top, bottom, 1);
      if (state.handle.includes('e')) right = snap(true, right, top, bottom, -1);
      if (state.handle.includes('n')) top = snap(false, top, left, right, 1);
      if (state.handle.includes('s')) bottom = snap(false, bottom, left, right, -1);
    }
    return { x: left, y: top, width: right - left, height: bottom - top };
  };

  const cursor = drawMode
    ? 'crosshair'
    : editing
      ? HANDLE_CURSOR[editing.handle]
      : hoverCursor ?? (hoveredRoomId && showOverlay ? 'pointer' : 'default');

  return (
    <div ref={containerRef} className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          draggedRef.current = false;
          if (drawMode) {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragStart(pointerPercent(e));
            setDraftBox(null);
            return;
          }
          const point = pointerPercent(e);
          const handle = handleAt(point, e.currentTarget.getBoundingClientRect());
          const room = rooms.find((r) => r.id === selectedRoomId);
          if (!handle || !room) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setEditing({ roomId: room.id, handle, start: point, from: room.position, box: room.position });
        }}
        onPointerMove={(e) => {
          if (drawMode && dragStart) { setDraftBox(boxFrom(dragStart, pointerPercent(e))); return; }
          if (drawMode) return;
          const point = pointerPercent(e);
          const rect = e.currentTarget.getBoundingClientRect();
          if (editing) {
            if (Math.abs(point.x - editing.start.x) * rect.width / 100 > 3 || Math.abs(point.y - editing.start.y) * rect.height / 100 > 3) draggedRef.current = true;
            if (draggedRef.current) setEditing({ ...editing, box: dragged(editing, point, rect) });
            return;
          }
          const handle = handleAt(point, rect);
          setHoverCursor(handle ? HANDLE_CURSOR[handle] : null);
          setHoveredRoomId(roomAt(e)?.id ?? null);
        }}
        onPointerUp={(e) => {
          if (editing) {
            const state = editing;
            setEditing(null);
            if (draggedRef.current) onRoomBoxChange(state.roomId, state.box, measure(state.box));
            return;
          }
          if (!drawMode || !dragStart) return;
          const box = boxFrom(dragStart, pointerPercent(e));
          setDragStart(null);
          setDraftBox(null);
          if (box.width >= 2 && box.height >= 2) onBoxDrawn(box);
        }}
        onPointerCancel={() => { setDragStart(null); setDraftBox(null); setEditing(null); }}
        onMouseLeave={() => { setHoveredRoomId(null); setHoverCursor(null); }}
        onClick={(e) => {
          // The click that ends a drag is not a tap.
          if (drawMode || draggedRef.current || !showOverlay) return;
          const room = roomAt(e);
          if (room) { onRoomSelect(room.id); return; }
          // An empty spot: the walls around it, measured if the scale is known.
          const point = pointerPercent(e);
          const found = mask ? roomAround(mask, (point.x / 100) * mask.width, (point.y / 100) * mask.height) : null;
          const box = found && mask ? {
            x: (found.x0 / mask.width) * 100, y: (found.y0 / mask.height) * 100,
            width: ((found.x1 - found.x0) / mask.width) * 100, height: ((found.y1 - found.y0) / mask.height) * 100,
          } : null;
          onEmptyTap(box, box ? measure(box) : null);
        }}
        style={{ cursor, width: `${zoom * 100}%`, touchAction: drawMode || selectedRoomId ? 'none' : 'auto' }}
      />

      <style jsx>{`
        .canvas-wrapper {
          width: 100%;
          border-radius: var(--radius-md);
          overflow: auto;
          border: 1px solid #dfe5ed;
          background: #fff;
        }

        canvas {
          display: block;
          height: auto;
          max-width: none;
        }
      `}</style>
    </div>
  );
}
