'use client';

import { useState, type FormEvent } from 'react';
import Card from '@/components/ui/Card';
import FloorPlanCanvas from './FloorPlanCanvas';
import RoomEditPanel from './RoomEditPanel';
import {
  ArrowLeft,
  ArrowRight,
  Info,
  Plus,
  ArrowCounterClockwise,
  ArrowClockwise,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  Warning,
} from '@phosphor-icons/react';
import { DetectedRoom, DetectedWall } from '@/lib/vision/types';
import { assessPlanReview } from '@/lib/vision/planReview';

interface FloorPlanEditorProps {
  rooms: DetectedRoom[];
  walls: DetectedWall[];
  imageUrl: string | null;
  confidence: number;
  readFromLabels: boolean;
  totalArea: number;
  onRoomUpdate: (roomId: string, updates: Partial<DetectedRoom>) => void;
  onRoomRemove: (roomId: string) => void;
  onRoomAdd: (room: DetectedRoom) => void;
  doors: number;
  windows: number;
  onOpeningsChange: (openings: { doors?: number; windows?: number }) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  planRevision: number;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
}

export default function FloorPlanEditor({
  rooms,
  walls,
  imageUrl,
  confidence,
  readFromLabels,
  totalArea,
  onRoomUpdate,
  onRoomRemove,
  onRoomAdd,
  doors,
  windows,
  onOpeningsChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  planRevision,
  error,
  onConfirm,
  onBack,
}: FloorPlanEditorProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showWalls, setShowWalls] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [addingRoom, setAddingRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', width: '', length: '' });

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const reviewFindings = assessPlanReview({
    area: totalArea,
    rooms: rooms.map((room) => ({ name: room.name, width: room.dimensions.width, length: room.dimensions.length })),
    doors,
    windows,
    externalWallLength: walls.filter((wall) => wall.type === 'external').reduce((sum, wall) => sum + wall.length, 0),
    internalWallLength: walls.filter((wall) => wall.type === 'internal').reduce((sum, wall) => sum + wall.length, 0),
    noExternalWallsDetected: !walls.some((wall) => wall.type === 'external'),
    confidence,
    readFromLabels,
    // Construction stages are chosen later; this screen checks only the scan.
    stages: ['scan review'],
    includeLabor: false,
  });
  if (!readFromLabels && confidence >= 70 && confidence < 90) {
    reviewFindings.push({ id: 'estimated-dimensions', text: 'Some dimensions may have been estimated. Compare each room with the original plan.', severity: 'check' });
  }

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId === selectedRoomId ? null : roomId);
  };

  const handleAddRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const width = Number(newRoom.width);
    const length = Number(newRoom.length);
    if (!newRoom.name.trim() || !Number.isFinite(width) || !Number.isFinite(length) || width <= 0 || length <= 0) return;
    const id = `manual-${crypto.randomUUID()}`;
    onRoomAdd({
      id, name: newRoom.name.trim(), dimensions: { width, length }, area: width * length,
      // An added room has no location from the scan. Keep it in the list rather
      // than placing a made-up rectangle over the uploaded drawing.
      position: { x: 0, y: 0, width: 0, height: 0 },
      wallType: 'internal', isEdited: true,
    });
    setSelectedRoomId(id);
    setNewRoom({ name: '', width: '', length: '' });
    setAddingRoom(false);
  };

  return (
    <div className="floor-plan-editor">
      <div className="editor-header">
        <div className="header-content">
          <h1>Edit Floor Plan</h1>
          <p>Compare the scan with your plan. Correct rooms and openings before we price the build.</p>
        </div>

        <div className="header-stats">
          <div className="stat">
            <span className="stat-value">{rooms.length}</span>
            <span className="stat-label">Rooms</span>
          </div>
          <div className="stat">
            <span className="stat-value">{totalArea.toFixed(0)}m²</span>
            <span className="stat-label">Total Area</span>
          </div>
          <div className={`stat confidence ${confidence >= 90 ? 'high' : confidence >= 70 ? 'medium' : 'low'}`}>
            <span className="stat-value">{confidence}%</span>
            <span className="stat-label">Confidence</span>
          </div>
        </div>
      </div>

      {reviewFindings.length > 0 && <section className="scan-review" aria-labelledby="scan-review-heading">
        <h2 id="scan-review-heading"><Warning size={18} weight="fill" /> Check these scan results</h2>
        <ul>{reviewFindings.map((finding) => <li key={finding.id}>{finding.text}</li>)}</ul>
      </section>}

      <div className="review-toolbar" aria-label="Plan review controls">
        <div className="toolbar-group">
          <button type="button" className={`tool-button ${showOverlay ? 'active' : ''}`} aria-pressed={showOverlay} onClick={() => setShowOverlay((value) => !value)}>{showOverlay ? 'AI scan visible' : 'Original plan only'}</button>
          <button type="button" className={`tool-button ${showWalls ? 'active' : ''}`} aria-pressed={showWalls} disabled={!showOverlay || walls.length === 0} onClick={() => setShowWalls((value) => !value)}>Wall lines</button>
        </div>
        <div className="toolbar-group">
          <button type="button" className="tool-button icon-button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.5))}><MagnifyingGlassMinus size={18} /></button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="tool-button icon-button" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.5))}><MagnifyingGlassPlus size={18} /></button>
          <button type="button" className="tool-button icon-button" aria-label="Undo correction" disabled={!canUndo} onClick={onUndo}><ArrowCounterClockwise size={18} /></button>
          <button type="button" className="tool-button icon-button" aria-label="Redo correction" disabled={!canRedo} onClick={onRedo}><ArrowClockwise size={18} /></button>
        </div>
      </div>

      <div className="editor-body">
        <div className="canvas-container">
          <Card className="canvas-card">
            <FloorPlanCanvas
              rooms={rooms}
              walls={walls}
              imageUrl={imageUrl}
              selectedRoomId={selectedRoomId}
              onRoomSelect={handleRoomSelect}
              showOverlay={showOverlay}
              showWalls={showWalls}
              zoom={zoom}
            />
          </Card>

          <div className="tip-box">
            <Info size={16} weight="light" />
            <span>Tap a highlighted room or choose one from the list. New rooms are listed below without a guessed position on the drawing.</span>
          </div>
        </div>

        <div className="panel-container">
          {selectedRoom ? (
            <RoomEditPanel
              key={`${selectedRoom.id}-${planRevision}`}
              room={selectedRoom}
              onUpdate={(updates) => onRoomUpdate(selectedRoom.id, updates)}
              onRemove={() => {
                onRoomRemove(selectedRoom.id);
                setSelectedRoomId(null);
              }}
              onClose={() => setSelectedRoomId(null)}
            />
          ) : (
            <Card className="rooms-list-card">
              <div className="rooms-list-heading"><h3>Rooms in this estimate</h3><button type="button" className="add-room-button" onClick={() => setAddingRoom((value) => !value)}><Plus size={16} /> Add missing room</button></div>
              {addingRoom && <form className="add-room-form" onSubmit={handleAddRoom}>
                <label>Room name<input type="text" value={newRoom.name} onChange={(event) => setNewRoom((room) => ({ ...room, name: event.target.value }))} placeholder="e.g. Bedroom 3" required /></label>
                <div className="add-room-dimensions"><label>Width (m)<input type="number" inputMode="decimal" min="0.1" step="0.1" value={newRoom.width} onChange={(event) => setNewRoom((room) => ({ ...room, width: event.target.value }))} required /></label><label>Length (m)<input type="number" inputMode="decimal" min="0.1" step="0.1" value={newRoom.length} onChange={(event) => setNewRoom((room) => ({ ...room, length: event.target.value }))} required /></label></div>
                <p className="manual-room-note">Wall length will be estimated from the corrected floor area and room count.</p>
                <button type="submit" className="btn btn-primary">Add room to estimate</button>
              </form>}
              <div className="rooms-list">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    className={`room-item ${room.isEdited ? 'edited' : ''}`}
                    onClick={() => handleRoomSelect(room.id)}
                  >
                    <div className="room-info">
                      <span className="room-name">{room.name}</span>
                      {room.position.width === 0 && <span className="manual-badge">Added manually</span>}
                      {(room.dimensions.width <= 0 || room.dimensions.length <= 0) && <span className="manual-badge">Dimensions needed</span>}
                      <span className="room-dims">
                        {room.dimensions.width.toFixed(1)} x {room.dimensions.length.toFixed(1)}m
                      </span>
                    </div>
                    <span className="room-area">{room.area.toFixed(1)}m²</span>
                  </button>
                ))}
              </div>
              <div className="openings-review">
                <h4>Check openings</h4>
                <p>Use the total shown on your plan. If the count is 0, the BOQ uses its standard allowance for that opening.</p>
                <div className="add-room-dimensions"><label>Doors<input type="number" inputMode="numeric" min="0" step="1" value={doors} onChange={(event) => onOpeningsChange({ doors: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} /></label><label>Windows<input type="number" inputMode="numeric" min="0" step="1" value={windows} onChange={(event) => onOpeningsChange({ windows: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} /></label></div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {error && <p role="alert" className="review-error">{error}</p>}

      <div className="editor-footer">
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={18} weight="bold" />
          Upload Different Plan
        </button>

        <button className="btn btn-primary" onClick={onConfirm}>
          Confirm Dimensions
          <ArrowRight size={18} weight="bold" />
        </button>
      </div>

      <style jsx>{`
        .scan-review { border: 1px solid #e7c46a; border-radius: 12px; background: #fff9e9; padding: 14px 16px; color: #694408; }
        .scan-review h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: .95rem; font-weight: 700; }
        .scan-review ul { margin: 0; padding-left: 22px; font-size: .82rem; line-height: 1.5; }
        .scan-review li + li { margin-top: 4px; }
        .review-toolbar { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 10px; border: 1px solid #d9e3ef; border-radius: 12px; background: #f5f8fc; }
        .toolbar-group { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
        .tool-button { min-height: 40px; padding: 8px 12px; border: 1px solid #cbd8e6; border-radius: 8px; background: white; color: #173557; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
        .tool-button.active { background: #0f294b; border-color: #0f294b; color: white; }
        .tool-button:disabled { opacity: .45; cursor: not-allowed; }
        .icon-button { display: inline-flex; justify-content: center; align-items: center; width: 40px; padding: 0; }
        .zoom-label { min-width: 42px; text-align: center; font-size: .8rem; font-weight: 700; color: #173557; }
        .rooms-list-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .rooms-list-heading h3 { margin: 0; }
        .add-room-button { display: inline-flex; align-items: center; gap: 5px; min-height: 36px; border: 1px solid #b7cae1; border-radius: 8px; background: #edf5ff; color: #0f4b91; padding: 6px 9px; font-weight: 700; font-size: .78rem; cursor: pointer; }
        .add-room-form { display: grid; gap: 10px; padding: 12px; margin-bottom: 12px; border-radius: 10px; background: #f2f7fc; }
        .add-room-form label, .openings-review label { display: grid; gap: 5px; color: #314c69; font-weight: 700; font-size: .75rem; }
        .add-room-form input, .add-room-form select, .openings-review input { width: 100%; min-height: 42px; padding: 8px 10px; border: 1px solid #bdcddd; border-radius: 7px; background: white; color: #10243d; font-size: 1rem; }
        .add-room-dimensions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .manual-badge { color: #9a5a05; font-size: .68rem; font-weight: 700; }
        .manual-room-note { margin: 0; color: #526985; font-size: .75rem; line-height: 1.4; }
        .openings-review { margin-top: 16px; padding-top: 14px; border-top: 1px solid #d9e3ef; }
        .openings-review h4 { margin: 0 0 4px; color: #10243d; font-size: .9rem; }
        .openings-review p { margin: 0 0 10px; color: #526985; font-size: .75rem; line-height: 1.4; }
        .review-error { margin: 0; border: 1px solid #f5b3b3; border-radius: 8px; padding: 10px 12px; color: #8b1e1e; background: #fff2f2; }
        .floor-plan-editor {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--spacing-lg);
        }

        .header-content h1 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .header-content p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .header-stats {
          display: flex;
          gap: var(--spacing-lg);
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--spacing-sm) var(--spacing-md);
          background: rgba(6, 20, 47, 0.02);
          border-radius: var(--radius-md);
          min-width: 80px;
          border: 1px solid var(--color-border-light);
        }

        .stat-value {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .stat-label {
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
        }

        .stat.confidence.high .stat-value {
          color: var(--color-success);
        }

        .stat.confidence.medium .stat-value {
          color: var(--color-warning);
        }

        .stat.confidence.low .stat-value {
          color: var(--color-error);
        }

        .editor-body {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: var(--spacing-lg);
          min-height: 500px;
        }

        .canvas-container {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .canvas-card :global(.card) {
          position: relative;
          padding: 0;
          overflow: hidden;
        }

        .canvas-toolbar {
          position: absolute;
          bottom: var(--spacing-md);
          left: var(--spacing-md);
          display: flex;
          gap: var(--spacing-sm);
        }

        .toolbar-btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          background: #ffffff;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .toolbar-btn:hover {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: var(--color-text-inverse);
        }

        .tip-box {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          background: rgba(78, 154, 247, 0.1);
          border-radius: var(--radius-md);
          font-size: 0.75rem;
          color: var(--color-primary);
        }

        .panel-container {
          display: flex;
          flex-direction: column;
        }

        .rooms-list-card :global(.card) {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .rooms-list-card h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-md) 0;
        }

        .rooms-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          overflow-y: auto;
          flex: 1;
        }

        .room-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-sm) var(--spacing-md);
          background: rgba(6, 20, 47, 0.02);
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .room-item:hover {
          border-color: var(--color-accent);
        }

        .room-item.edited {
          background: rgba(78, 154, 247, 0.12);
        }

        .room-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .room-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
        }

        .room-dims {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .room-area {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-accent);
        }

        .editor-footer {
          display: flex;
          justify-content: space-between;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-lg);
          border-radius: var(--radius-md);
          font-size: 0.9375rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-primary {
          background: var(--color-primary);
          color: var(--color-text-inverse);
        }

        .btn-primary:hover {
          background: var(--color-primary-dark);
        }

        .btn-secondary {
          background: rgba(6, 20, 47, 0.02);
          border: 1px solid var(--color-border-light);
          color: var(--color-text-secondary);
        }

        .btn-secondary:hover {
          border-color: var(--color-text-muted);
          color: var(--color-text);
        }

        @media (max-width: 900px) {
          .editor-body {
            display: flex;
            flex-direction: column;
          }
          .panel-container { order: -1; }

          .header-stats {
            flex-wrap: wrap;
          }
          .editor-header { flex-direction: column; }
          .editor-footer { flex-direction: column-reverse; gap: 10px; }
          .editor-footer .btn { justify-content: center; min-height: 46px; }
          .review-toolbar { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
