'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import {
  X,
  Trash,
  ArrowsOutSimple,
  Wall,
} from '@phosphor-icons/react';
import { DetectedRoom } from '@/lib/vision/types';

interface RoomEditPanelProps {
  room: DetectedRoom;
  onUpdate: (updates: Partial<DetectedRoom>) => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function RoomEditPanel({
  room,
  onUpdate,
  onRemove,
  onClose,
}: RoomEditPanelProps) {
  const [name, setName] = useState(room.name);
  const [width, setWidth] = useState(room.dimensions.width.toString());
  const [length, setLength] = useState(room.dimensions.length.toString());

  const handleNameChange = (value: string) => {
    setName(value);
    onUpdate({ name: value });
  };

  const handleDimensionChange = (dimension: 'width' | 'length', value: string) => {
    const numValue = parseFloat(value);

    if (dimension === 'width') {
      setWidth(value);
      if (!isNaN(numValue) && numValue > 0) {
        onUpdate({
          dimensions: { ...room.dimensions, width: numValue },
        });
      }
    } else {
      setLength(value);
      if (!isNaN(numValue) && numValue > 0) {
        onUpdate({
          dimensions: { ...room.dimensions, length: numValue },
        });
      }
    }
  };

  const handleWallTypeChange = (wallType: 'external' | 'internal') => {
    onUpdate({ wallType });
  };

  return (
    <Card className="room-edit-panel">
      <div className="panel-header">
        <h3>Edit Room</h3>
        <button className="close-btn" onClick={onClose}>
          <X size={20} weight="light" />
        </button>
      </div>

      <div className="panel-content">
        {/* Room Name */}
        <div className="form-group">
          <label>Room Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Enter room name"
          />
        </div>

        {/* Dimensions */}
        <div className="form-group">
          <label>
            <ArrowsOutSimple size={16} weight="light" />
            Dimensions
          </label>
          <div className="dimension-inputs">
            <div className="input-with-unit">
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={width}
                onChange={(e) => handleDimensionChange('width', e.target.value)}
              />
              <span className="unit">m</span>
            </div>
            <span className="dimension-separator">x</span>
            <div className="input-with-unit">
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={length}
                onChange={(e) => handleDimensionChange('length', e.target.value)}
              />
              <span className="unit">m</span>
            </div>
          </div>
        </div>

        {/* Calculated Area */}
        <div className="calculated-area">
          <span className="area-label">Calculated Area</span>
          <span className="area-value">{room.area.toFixed(1)} m²</span>
        </div>

        {/* Wall Type */}
        <div className="form-group">
          <label>
            <Wall size={16} weight="light" />
            Wall Type
          </label>
          <div className="wall-type-buttons">
            <button
              className={`wall-type-btn ${room.wallType === 'external' ? 'active' : ''}`}
              onClick={() => handleWallTypeChange('external')}
            >
              External
            </button>
            <button
              className={`wall-type-btn ${room.wallType === 'internal' ? 'active' : ''}`}
              onClick={() => handleWallTypeChange('internal')}
            >
              Internal
            </button>
          </div>
          <span className="hint">
            External walls are thicker (230mm) and use more materials
          </span>
        </div>

        {/* Status indicator */}
        {room.isEdited && (
          <div className="edited-badge">
            Modified
          </div>
        )}
      </div>

      <div className="panel-footer">
        <button className="btn btn-danger" onClick={onRemove}>
          <Trash size={16} weight="light" />
          Remove Room
        </button>
      </div>

      <style jsx>{`
        .room-edit-panel :global(.card) {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: var(--spacing-md);
          border-bottom: 1px solid var(--color-border-light);
          margin-bottom: var(--spacing-md);
        }

        .panel-header h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: rgba(6, 20, 47, 0.04);
          border-radius: var(--radius-md);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
        }

        .close-btn:hover {
          background: var(--color-surface);
          color: var(--color-text);
        }

        .panel-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        label {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
        }

        input {
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          font-size: 0.9375rem;
          color: var(--color-text);
          background: #ffffff;
          transition: all 0.2s ease;
        }

        input:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.18);
        }

        .dimension-inputs {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .input-with-unit {
          flex: 1;
          position: relative;
        }

        .input-with-unit input {
          width: 100%;
          padding-right: 32px;
          text-align: right;
        }

        .unit {
          position: absolute;
          right: var(--spacing-sm);
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }

        .dimension-separator {
          color: var(--color-text-muted);
          font-weight: 500;
        }

        .calculated-area {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          background: rgba(78, 154, 247, 0.12);
          border-radius: var(--radius-md);
        }

        .area-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
        }

        .area-value {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-accent);
        }

        .wall-type-buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-xs);
        }

        .wall-type-btn {
          padding: var(--spacing-sm);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .wall-type-btn:hover {
          border-color: var(--color-accent);
        }

        .wall-type-btn.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: var(--color-text-inverse);
        }

        .hint {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          line-height: 1.4;
        }

        .edited-badge {
          display: inline-flex;
          align-items: center;
          padding: var(--spacing-xs) var(--spacing-sm);
          background: rgba(78, 154, 247, 0.12);
          border-radius: var(--radius-full);
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-accent);
          align-self: flex-start;
        }

        .panel-footer {
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--color-border-light);
          margin-top: auto;
        }

        .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm);
          width: 100%;
          padding: var(--spacing-sm);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-danger {
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .btn-danger:hover {
          background: var(--color-error);
          color: white;
        }
      `}</style>
    </Card>
  );
}
