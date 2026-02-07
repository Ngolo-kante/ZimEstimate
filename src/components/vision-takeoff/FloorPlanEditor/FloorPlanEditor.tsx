'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import FloorPlanCanvas from './FloorPlanCanvas';
import RoomEditPanel from './RoomEditPanel';
import {
  ArrowLeft,
  ArrowRight,
  Info,
} from '@phosphor-icons/react';
import { DetectedRoom, DetectedWall } from '@/lib/vision/types';

interface FloorPlanEditorProps {
  rooms: DetectedRoom[];
  walls: DetectedWall[];
  imageUrl: string | null;
  confidence: number;
  totalArea: number;
  onRoomUpdate: (roomId: string, updates: Partial<DetectedRoom>) => void;
  onRoomRemove: (roomId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export default function FloorPlanEditor({
  rooms,
  walls,
  imageUrl,
  confidence,
  totalArea,
  onRoomUpdate,
  onRoomRemove,
  onConfirm,
  onBack,
}: FloorPlanEditorProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId === selectedRoomId ? null : roomId);
  };

  return (
    <div className="floor-plan-editor">
      <div className="editor-header">
        <div className="header-content">
          <h1>Edit Floor Plan</h1>
          <p>Review and adjust detected room dimensions. Click a room to edit.</p>
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

      <div className="editor-body">
        <div className="canvas-container">
          <Card className="canvas-card">
            <FloorPlanCanvas
              rooms={rooms}
              walls={walls}
              imageUrl={imageUrl}
              selectedRoomId={selectedRoomId}
              onRoomSelect={handleRoomSelect}
            />
          </Card>

          <div className="tip-box">
            <Info size={16} weight="light" />
            <span>Click a room to select it and edit dimensions in the panel on the right.</span>
          </div>
        </div>

        <div className="panel-container">
          {selectedRoom ? (
            <RoomEditPanel
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
              <h3>Detected Rooms</h3>
              <div className="rooms-list">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    className={`room-item ${room.isEdited ? 'edited' : ''}`}
                    onClick={() => handleRoomSelect(room.id)}
                  >
                    <div className="room-info">
                      <span className="room-name">{room.name}</span>
                      <span className="room-dims">
                        {room.dimensions.width.toFixed(1)} x {room.dimensions.length.toFixed(1)}m
                      </span>
                    </div>
                    <span className="room-area">{room.area.toFixed(1)}m²</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

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
            grid-template-columns: 1fr;
          }

          .header-stats {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}
