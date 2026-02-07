'use client';

import { useRef, useEffect, useState } from 'react';
import { DetectedRoom, DetectedWall } from '@/lib/vision/types';

interface FloorPlanCanvasProps {
  rooms: DetectedRoom[];
  walls: DetectedWall[];
  imageUrl: string | null;
  selectedRoomId: string | null;
  onRoomSelect: (roomId: string) => void;
}

const SHADOW_OFFSET = 6;
const ROOM_COLORS = [
  { fill: '#E8F4FD', stroke: '#3B82F6' }, // Blue
  { fill: '#FEF3C7', stroke: '#F59E0B' }, // Amber
  { fill: '#D1FAE5', stroke: '#10B981' }, // Green
  { fill: '#FCE7F3', stroke: '#EC4899' }, // Pink
  { fill: '#EDE9FE', stroke: '#8B5CF6' }, // Purple
  { fill: '#FEE2E2', stroke: '#EF4444' }, // Red
];

export default function FloorPlanCanvas({
  rooms,
  walls,
  imageUrl,
  selectedRoomId,
  onRoomSelect,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  void walls;
  void imageUrl;

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(400, entry.contentRect.width * 0.6),
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw each room with 2.5D effect
    rooms.forEach((room, index) => {
      const colorIndex = index % ROOM_COLORS.length;
      const colors = ROOM_COLORS[colorIndex];
      const isSelected = room.id === selectedRoomId;
      const isHovered = room.id === hoveredRoomId;

      // Convert percentage positions to pixels
      const x = (room.position.x / 100) * width;
      const y = (room.position.y / 100) * height;
      const w = (room.position.width / 100) * width;
      const h = (room.position.height / 100) * height;

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(x + SHADOW_OFFSET, y + SHADOW_OFFSET, w, h);

      // Room fill with gradient
      const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
      gradient.addColorStop(0, colors.fill);
      gradient.addColorStop(1, adjustColor(colors.fill, -10));
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, w, h);

      // Border
      ctx.strokeStyle = isSelected || isHovered ? '#14213D' : colors.stroke;
      ctx.lineWidth = room.wallType === 'external' ? 4 : 2;
      if (isSelected) ctx.lineWidth = 5;
      ctx.strokeRect(x, y, w, h);

      // Room label
      ctx.fillStyle = '#1E293B';
      ctx.font = '500 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.name, x + w / 2, y + h / 2 - 6);

      // Dimensions label
      ctx.fillStyle = '#64748B';
      ctx.font = '400 10px Inter, system-ui, sans-serif';
      ctx.fillText(
        `${room.dimensions.width.toFixed(1)} x ${room.dimensions.length.toFixed(1)}m`,
        x + w / 2,
        y + h / 2 + 8
      );

      // Area label
      ctx.fillStyle = colors.stroke;
      ctx.font = '600 10px Inter, system-ui, sans-serif';
      ctx.fillText(`${room.area.toFixed(1)}m²`, x + w / 2, y + h / 2 + 22);

      // Selection indicator
      if (isSelected) {
        // Draw resize handles
        const handleSize = 8;
        ctx.fillStyle = '#14213D';

        // Corners
        [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([hx, hy]) => {
          ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        });

        // Edges
        [[x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2]].forEach(
          ([hx, hy]) => {
            ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
          }
        );
      }
    });
  }, [rooms, dimensions, selectedRoomId, hoveredRoomId]);

  // Handle mouse interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    // Find room under cursor
    const hoveredRoom = rooms.find((room) => {
      return (
        mouseX >= room.position.x &&
        mouseX <= room.position.x + room.position.width &&
        mouseY >= room.position.y &&
        mouseY <= room.position.y + room.position.height
      );
    });

    setHoveredRoomId(hoveredRoom?.id || null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    // Find room under cursor
    const clickedRoom = rooms.find((room) => {
      return (
        mouseX >= room.position.x &&
        mouseX <= room.position.x + room.position.width &&
        mouseY >= room.position.y &&
        mouseY <= room.position.y + room.position.height
      );
    });

    if (clickedRoom) {
      onRoomSelect(clickedRoom.id);
    }
  };

  return (
    <div ref={containerRef} className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredRoomId(null)}
        onClick={handleClick}
        style={{ cursor: hoveredRoomId ? 'pointer' : 'default' }}
      />

      <style jsx>{`
        .canvas-wrapper {
          width: 100%;
          min-height: 400px;
        }

        canvas {
          display: block;
          width: 100%;
          height: auto;
          border-radius: var(--radius-md);
        }
      `}</style>
    </div>
  );
}

// Helper function to adjust color brightness
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
