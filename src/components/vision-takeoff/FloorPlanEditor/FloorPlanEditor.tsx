'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Card from '@/components/ui/Card';
import FloorPlanCanvas, { type Measured } from './FloorPlanCanvas';
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
import { DetectedRoom, DetectedWall, type PlanBox, type VisionAnalysisResult } from '@/lib/vision/types';
import { assessPlanReview } from '@/lib/vision/planReview';
import { boxForMissing, checkAgainstPrinted, printedSizeFor, sameName, sameSize, type PrintedRoom, type PrintedSizes } from '@/lib/vision/planCheck';

/** The rooms most plans have, offered as one tap when adding a room. */
const ROOM_NAMES = ['Bedroom', 'Bathroom', 'Toilet', 'Kitchen', 'Lounge', 'Dining', 'Passage', 'Store', 'Veranda', 'Garage'];
import { dimensionNeedsReview, dimensionSourceLabel } from '@/lib/vision/dimensionSource';

interface FloorPlanEditorProps {
  rooms: DetectedRoom[];
  walls: DetectedWall[];
  floorBoundary: PlanBox | null;
  verifiedTotalAreaM2: number | null;
  onFloorBoundaryChange: (box: PlanBox | null) => void;
  onVerifiedTotalAreaChange: (area: number | null) => void;
  imageUrl: string | null;
  confidence: number;
  /** Room sizes printed on the plan, to check the scan against. */
  printed: PrintedSizes | null;
  readFromLabels: boolean;
  totalArea: number;
  onRoomUpdate: (roomId: string, updates: Partial<DetectedRoom>) => void;
  onRoomRemove: (roomId: string) => void;
  onRoomAdd: (room: DetectedRoom) => void;
  onRoomsPlaced: (positions: Record<string, PlanBox>) => void;
  doors: number;
  windows: number;
  onOpeningsChange: (openings: { doors?: number; windows?: number }) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  planRevision: number;
  error: string | null;
  onRescan: () => void;
  onCancelRescan: () => void;
  rescanCandidate: VisionAnalysisResult | null;
  isRescanning: boolean;
  rescanError: string | null;
  onUseRescan: () => void;
  onKeepCurrent: () => void;
  onManualEntry: () => void;
  onConfirm: () => void;
  onBack: () => void;
}

export default function FloorPlanEditor({
  rooms,
  walls,
  floorBoundary,
  verifiedTotalAreaM2,
  onFloorBoundaryChange,
  onVerifiedTotalAreaChange,
  imageUrl,
  confidence,
  printed,
  readFromLabels,
  totalArea,
  onRoomUpdate,
  onRoomRemove,
  onRoomAdd,
  onRoomsPlaced,
  doors,
  windows,
  onOpeningsChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  planRevision,
  error,
  onRescan,
  onCancelRescan,
  rescanCandidate,
  isRescanning,
  rescanError,
  onUseRescan,
  onKeepCurrent,
  onManualEntry,
  onConfirm,
  onBack,
}: FloorPlanEditorProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showWalls, setShowWalls] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [addingRoom, setAddingRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', width: '', length: '' });
  const [drawMode, setDrawMode] = useState<'room' | 'boundary' | null>(null);
  const [pendingBox, setPendingBox] = useState<PlanBox | null>(null);
  // Bumped when a size is set from outside the room panel, so an open panel
  // shows the new figures instead of what was typed in it.
  const [panelVersion, setPanelVersion] = useState(0);
  const [scaleKnown, setScaleKnown] = useState(false);
  const onScaleKnown = useCallback((known: boolean) => setScaleKnown(known), []);
  /* A room with a printed or checked size whose box was resized to another
     size: the printed size stays until the person chooses. */
  const [resizeQuestion, setResizeQuestion] = useState<{ roomId: string; measured: Measured } | null>(null);
  const [tapNote, setTapNote] = useState<string | null>(null);
  const [placedCount, setPlacedCount] = useState(0);
  const handleRoomsPlaced = useCallback((positions: Record<string, PlanBox>) => {
    onRoomsPlaced(positions);
    setPlacedCount(Object.keys(positions).length);
  }, [onRoomsPlaced]);
  /** Where a tapped room's prefilled size came from, while it is unchanged. */
  const [prefill, setPrefill] = useState<{ source: 'printed' | 'scaled'; width: string; length: string } | null>(null);
  const addRoomFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (pendingBox) addRoomFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [pendingBox]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  // Measured against the plan's own printed sizes; worth showing from two up.
  const printedCheck = checkAgainstPrinted(rooms, printed);
  const measured = printedCheck !== null && printedCheck.printed >= 2 ? printedCheck : null;
  const verifiedMappedArea = rooms.reduce((sum, room) => sum + (room.dimensionsVerified && room.area > 0 ? room.area : 0), 0);
  const remainingArea = verifiedTotalAreaM2 === null ? null : verifiedTotalAreaM2 - verifiedMappedArea;
  const reviewFindings = assessPlanReview({
    area: totalArea,
    rooms: rooms.map((room) => ({ name: room.name, width: room.dimensions.width, length: room.dimensions.length })),
    doors,
    windows,
    externalWallLength: walls.filter((wall) => wall.type === 'external').reduce((sum, wall) => sum + wall.length, 0),
    internalWallLength: walls.filter((wall) => wall.type === 'internal').reduce((sum, wall) => sum + wall.length, 0),
    noExternalWallsDetected: !walls.some((wall) => wall.type === 'external'),
    // The reader's own score only when there is nothing printed to measure by.
    confidence: measured ? null : confidence,
    readFromLabels,
    // Construction stages are chosen later; this screen checks only the scan.
    stages: ['scan review'],
    includeLabor: false,
  });
  if (!measured && !readFromLabels && confidence >= 70 && confidence < 90) {
    reviewFindings.push({ id: 'estimated-dimensions', text: 'Some dimensions may have been estimated. Compare each room with the original plan.', severity: 'check' });
  }

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId === selectedRoomId ? null : roomId);
  };

  const fmt = (n: number) => n.toFixed(Math.abs(Math.round(n * 10) - n * 10) < 1e-6 ? 1 : 2);
  const printedText = (label: PrintedRoom) =>
    label.width !== undefined && label.length !== undefined ? `${fmt(label.width)} × ${fmt(label.length)} m` : `${fmt(label.area ?? 0)} m²`;

  const applyPrintedSize = (room: DetectedRoom, label: PrintedRoom) => {
    const size = printedSizeFor(room, label);
    if (!size) return;
    onRoomUpdate(room.id, { dimensions: size, area: size.width * size.length, dimensionSource: 'printed', dimensionsVerified: true, isEdited: true });
    setPanelVersion((version) => version + 1);
  };

  const addPrintedRoom = (label: PrintedRoom) => {
    if (label.width === undefined || label.length === undefined || !printed) {
      // Only an area is printed: the shape is the person's to give.
      setNewRoom({ name: label.name, width: '', length: '' });
      setPendingBox(null);
      setAddingRoom(true);
      setSelectedRoomId(null);
      return;
    }
    const box = boxForMissing(label, rooms, printed);
    const id = `printed-${crypto.randomUUID()}`;
    onRoomAdd({
      id, name: label.name, dimensions: { width: label.width, length: label.length }, area: label.width * label.length,
      position: box ?? { x: 0, y: 0, width: 0, height: 0 },
      wallType: 'internal', isEdited: true,
      dimensionSource: 'printed',
      dimensionsVerified: true,
      manuallyPlaced: box !== null,
    });
    setSelectedRoomId(id);
  };

  // Each printed name that belongs to exactly one scan room, and that room to no other name.
  const anchors = (() => {
    const pairs = (printed?.rooms ?? []).flatMap((label) => {
      const named = rooms.filter((room) => sameName(room.name, label.name));
      // A room the person has moved or changed is theirs; it is never re-placed.
      return named.length === 1 && !named[0].isEdited ? [{ roomId: named[0].id, at: label.at }] : [];
    });
    return pairs.filter((pair) => pairs.filter((other) => other.roomId === pair.roomId).length === 1);
  })();

  // Rooms whose size the plan or the person vouches for set the plan's scale.
  const knownSizeIds = rooms
    .filter((room) => room.dimensionSource === 'printed' || room.dimensionsVerified || printedCheck?.matchedRoomIds.includes(room.id))
    .map((room) => room.id);
  const keepsItsSize = (room: DetectedRoom) =>
    room.dimensionSource === 'printed' || room.dimensionsVerified === true || (printedCheck?.matchedRoomIds.includes(room.id) ?? false);

  const handleRoomBoxChange = (roomId: string, box: PlanBox, measured: Measured | null) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    setResizeQuestion(null);
    if (!measured || measured.width <= 0 || measured.length <= 0 || sameSize(measured, room.dimensions)) {
      onRoomUpdate(roomId, { position: box });
    } else if (keepsItsSize(room)) {
      onRoomUpdate(roomId, { position: box });
      setResizeQuestion({ roomId, measured });
    } else {
      onRoomUpdate(roomId, { position: box, dimensions: measured, dimensionSource: 'scaled' });
      setPanelVersion((version) => version + 1);
    }
  };

  const applyMeasuredSize = () => {
    if (!resizeQuestion) return;
    onRoomUpdate(resizeQuestion.roomId, { dimensions: resizeQuestion.measured });
    setPanelVersion((version) => version + 1);
    setResizeQuestion(null);
  };

  const handleEmptyTap = (box: PlanBox | null, measured: Measured | null) => {
    setTapNote(null);
    // With a room open, a tap elsewhere closes it.
    if (selectedRoomId) { setSelectedRoomId(null); return; }
    if (!box) {
      setTapNote('No walls were found around that spot. Use “Draw missing room” to mark it by hand.');
      return;
    }
    // A printed label inside the box names the room and gives its size.
    const label = printed?.rooms.find((p) => p.at.x >= box.x && p.at.x <= box.x + box.width && p.at.y >= box.y && p.at.y <= box.y + box.height);
    const size = label?.width !== undefined && label.length !== undefined ? { width: label.width, length: label.length } : measured;
    const width = size ? String(size.width) : '';
    const length = size ? String(size.length) : '';
    setNewRoom({ name: label?.name ?? '', width, length });
    setPrefill(size ? { source: label?.width !== undefined ? 'printed' : 'scaled', width, length } : null);
    setPendingBox(box);
    setAddingRoom(true);
  };

  const handleBoxDrawn = (box: PlanBox) => {
    if (drawMode === 'boundary') onFloorBoundaryChange(box);
    if (drawMode === 'room') {
      setPrefill(null);
      setPendingBox(box);
      setAddingRoom(true);
      setSelectedRoomId(null);
    }
    setDrawMode(null);
  };

  const handleAddRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const width = Number(newRoom.width);
    const length = Number(newRoom.length);
    if (!newRoom.name.trim() || !Number.isFinite(width) || !Number.isFinite(length) || width <= 0 || length <= 0) return;
    const id = `manual-${crypto.randomUUID()}`;
    // A size measured off the plan and left as it was is still a measurement
    // to check; one the person typed is theirs.
    const kept = prefill && prefill.width === newRoom.width && prefill.length === newRoom.length ? prefill.source : null;
    onRoomAdd({
      id, name: newRoom.name.trim(), dimensions: { width, length }, area: width * length,
      // A room without a drawn box stays in the list; never invent its location.
      position: pendingBox ?? { x: 0, y: 0, width: 0, height: 0 },
      wallType: 'internal', isEdited: true,
      dimensionSource: kept ?? 'user',
      dimensionsVerified: kept !== 'scaled',
      manuallyPlaced: pendingBox !== null,
    });
    setPrefill(null);
    setSelectedRoomId(id);
    setNewRoom({ name: '', width: '', length: '' });
    setAddingRoom(false);
    setPendingBox(null);
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
            <span className="stat-label">Room total</span>
          </div>
          {measured ? (
            <div className={`stat confidence ${measured.matched === measured.printed ? 'high' : measured.matched >= measured.printed * 0.7 ? 'medium' : 'low'}`}>
              <span className="stat-value">{measured.matched}/{measured.printed}</span>
              <span className="stat-label">Match plan</span>
            </div>
          ) : (
            <div className={`stat confidence ${confidence >= 90 ? 'high' : confidence >= 70 ? 'medium' : 'low'}`}>
              <span className="stat-value">{confidence}%</span>
              <span className="stat-label">Confidence</span>
            </div>
          )}
        </div>
      </div>

      {reviewFindings.length > 0 && <section className="scan-review" aria-labelledby="scan-review-heading">
        <h2 id="scan-review-heading"><Warning size={18} weight="fill" /> Check these scan results</h2>
        <ul>{reviewFindings.map((finding) => <li key={finding.id}>{finding.text}</li>)}</ul>
      </section>}

      {measured && (measured.differences.length > 0 || measured.missing.length > 0) && <section className="printed-check" aria-labelledby="printed-check-heading">
        <h2 id="printed-check-heading">Sizes printed on your plan</h2>
        <p>{measured.matched} of {measured.printed} rooms match the {printed?.source === 'pdf-text' ? 'sizes in your PDF' : 'sizes we read off your plan'}.{printed?.source === 'ocr' ? ' Those were read from the picture, so check any that look wrong.' : ''}</p>
        <ul>
          {measured.differences.map(({ room, printed: label }) => (
            <li key={room.id}>
              <span><strong>{room.name}</strong>: plan says {printedText(label)}, this estimate has {label.area !== undefined && label.width === undefined ? `${fmt(room.dimensions.width * room.dimensions.length)} m²` : `${fmt(room.dimensions.width)} × ${fmt(room.dimensions.length)} m`}.</span>
              {printedSizeFor(room, label)
                ? <button type="button" className="tool-button" onClick={() => applyPrintedSize(room, label)}>Use {printedText(label)}</button>
                : <button type="button" className="tool-button" onClick={() => setSelectedRoomId(room.id)}>Edit room</button>}
            </li>
          ))}
          {measured.missing.map((label) => (
            <li key={`${label.name}-${label.at.x}-${label.at.y}`}>
              <span><strong>{label.name}</strong> ({printedText(label)}) is on the plan but not in the scan.</span>
              <button type="button" className="tool-button" onClick={() => addPrintedRoom(label)}><Plus size={14} /> Add it</button>
            </li>
          ))}
        </ul>
      </section>}

      <section className="rescan-panel" aria-label="Scan quality and retry">
        {measured
          ? measured.matched === measured.printed && <p>All {measured.printed} room sizes printed on your plan match the scan. Rooms without a printed size still need checking against your drawing.</p>
          : <p>The {confidence}% score is reported by the plan reader, not a guarantee of accuracy. Compare the rooms with your drawing before continuing.</p>}
        <div className="rescan-actions">
          <button type="button" className="tool-button" onClick={onRescan} disabled={isRescanning}><ArrowClockwise size={16} /> {isRescanning ? 'Scanning again…' : 'Scan this plan again'}</button>
          {isRescanning && <button type="button" className="tool-button" onClick={onCancelRescan}>Cancel retry</button>}
          <button type="button" className="tool-button" onClick={onManualEntry}>Use manual builder</button>
        </div>
        {rescanError && <p role="alert" className="review-error">{rescanError} Your current rooms are unchanged.</p>}
        {rescanCandidate && <div className="rescan-compare" role="status">
          <strong>Compare both readings</strong>
          <p>Current: {rooms.length} rooms, {totalArea.toFixed(1)} m², {confidence}% reported confidence.</p>
          <p>New: {rescanCandidate.rooms.length} rooms, {rescanCandidate.totalArea.toFixed(1)} m², {rescanCandidate.confidence}% reported confidence.</p>
          <p>A higher score does not prove the dimensions are correct. Replacing the scan discards your room corrections.</p>
          <div className="rescan-actions"><button type="button" className="tool-button" onClick={onKeepCurrent}>Keep current review</button><button type="button" className="tool-button active" onClick={onUseRescan}>Use new scan</button></div>
        </div>}
      </section>

      <section className="coverage-panel" aria-label="Checked room area">
        <label htmlFor="verified-total-area">Total floor area confirmed from your drawing (m²)</label>
        <input id="verified-total-area" type="number" inputMode="decimal" min="0.1" step="0.1" value={verifiedTotalAreaM2 ?? ''} onChange={(event) => onVerifiedTotalAreaChange(event.target.value === '' ? null : Number(event.target.value))} placeholder="Enter the stated total, if known" />
        <p>Only enter a total you can verify on the plan or from your architect. This does not measure pixels.</p>
        {verifiedTotalAreaM2 !== null && <div className="coverage-figures">
          <span>Verified whole area <strong>{verifiedTotalAreaM2.toFixed(1)} m²</strong></span>
          <span>Checked rooms <strong>{verifiedMappedArea.toFixed(1)} m²</strong></span>
          <span>{remainingArea !== null && remainingArea < 0 ? 'Over by' : 'Still to map or reconcile'} <strong>{Math.abs(remainingArea ?? 0).toFixed(1)} m²</strong></span>
        </div>}
        {remainingArea !== null && remainingArea < 0 && <p role="alert">Checked room areas exceed the total. Recheck the room sizes, overlaps, and whether the total includes walls.</p>}
        {remainingArea !== null && remainingArea >= 0 && <p>The difference may include walls or circulation. It is an area reconciliation, not a measured outline of uncovered space.</p>}
        {floorBoundary && <p>The green outline marks the whole floor area visually. It does not set the m² figure.</p>}
      </section>

      <div className="review-toolbar" aria-label="Plan review controls">
        <div className="toolbar-group">
          <button type="button" className={`tool-button ${drawMode === 'boundary' ? 'active' : ''}`} aria-pressed={drawMode === 'boundary'} onClick={() => { setDrawMode(drawMode === 'boundary' ? null : 'boundary'); setShowOverlay(true); }}>Draw whole-area box</button>
          <button type="button" className={`tool-button ${drawMode === 'room' ? 'active' : ''}`} aria-pressed={drawMode === 'room'} onClick={() => { setDrawMode(drawMode === 'room' ? null : 'room'); setShowOverlay(true); }}>Draw missing room</button>
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
      {placedCount > 0 && <p className="placed-note" role="status">{placedCount} {placedCount === 1 ? 'room was' : 'rooms were'} lined up with the walls around {placedCount === 1 ? 'its' : 'their'} printed name. Drag any that still look off.</p>}
      {drawMode && <p className="draw-instruction" role="status">Drag a box over the {drawMode === 'room' ? 'missing room' : 'whole floor area'} on the plan. This marks its location; enter real dimensions separately.</p>}

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
              floorBoundary={floorBoundary}
              drawMode={drawMode}
              onBoxDrawn={handleBoxDrawn}
              knownSizeIds={knownSizeIds}
              onRoomBoxChange={handleRoomBoxChange}
              onEmptyTap={handleEmptyTap}
              onScaleKnown={onScaleKnown}
              anchors={anchors}
              onRoomsPlaced={handleRoomsPlaced}
            />
          </Card>

          {resizeQuestion && (() => {
            const room = rooms.find((r) => r.id === resizeQuestion.roomId);
            if (!room) return null;
            const size = (d: { width: number; length: number }) => `${fmt(d.width)} × ${fmt(d.length)} m`;
            return <div className="resize-question" role="status">
              <p><strong>{room.name}</strong> is {room.dimensionSource === 'printed' ? 'printed' : 'confirmed'} as {size(room.dimensions)}. The box you drew measures {size(resizeQuestion.measured)}.</p>
              <div className="rescan-actions">
                <button type="button" className="tool-button" onClick={() => setResizeQuestion(null)}>Keep {size(room.dimensions)}</button>
                <button type="button" className="tool-button active" onClick={applyMeasuredSize}>Use {size(resizeQuestion.measured)}</button>
              </div>
            </div>;
          })()}
          {tapNote && <p className="draw-instruction" role="status">{tapNote}</p>}
          <div className="tip-box">
            <Info size={16} weight="light" />
            <span>{selectedRoom
              ? scaleKnown
                ? 'Drag the room or its edges to fit the walls; edges snap to walls and the size updates as you drag.'
                : 'Drag the room or its edges to line it up with the plan. Sizes follow the box once two room sizes are confirmed.'
              : 'Tap a room to edit it, or tap an empty room on the plan to add it.'}</span>
          </div>
        </div>

        <div className="panel-container">
          {selectedRoom ? (
            <RoomEditPanel
              key={`${selectedRoom.id}-${planRevision}-${panelVersion}`}
              room={selectedRoom}
              onUpdate={(updates) => onRoomUpdate(selectedRoom.id, updates)}
              onRemove={() => {
                onRoomRemove(selectedRoom.id);
                setSelectedRoomId(null);
              }}
              onClose={() => setSelectedRoomId(null)}
              onVerifyDimensions={() => onRoomUpdate(selectedRoom.id, { dimensionsVerified: true })}
            />
          ) : (
            <Card className="rooms-list-card">
              <div className="rooms-list-heading"><h3>Rooms in this estimate</h3><button type="button" className="add-room-button" onClick={() => setAddingRoom((value) => !value)}><Plus size={16} /> Add missing room</button></div>
              <p className="source-guidance">The scan reports how it got each size. Check against your drawing, especially estimates and unconfirmed readings.</p>
              {addingRoom && <form ref={addRoomFormRef} className="add-room-form" onSubmit={handleAddRoom}>
                {pendingBox && <p className="manual-room-note">{prefill?.source === 'scaled'
                  ? 'Box placed on the drawing, sized from the plan’s scale. Check the size against your drawing.'
                  : prefill?.source === 'printed'
                    ? 'Box placed on the drawing, with the size printed in it.'
                    : 'Box placed on the drawing. Enter the room’s real dimensions below.'}</p>}
                <label>Room name<input type="text" value={newRoom.name} onChange={(event) => setNewRoom((room) => ({ ...room, name: event.target.value }))} placeholder="e.g. Bedroom 3" required /></label>
                <div className="name-chips" aria-label="Common room names">
                  {ROOM_NAMES.map((name) => {
                    // "Bedroom" becomes the next free number: Bedroom 4 after three.
                    const numbered = name === 'Bedroom' || name === 'Bathroom' || name === 'Toilet'
                      ? `${name} ${rooms.filter((r) => r.name.toLowerCase().startsWith(name.toLowerCase())).length + 1}`
                      : name;
                    return <button key={name} type="button" className={`name-chip ${newRoom.name === numbered ? 'active' : ''}`} onClick={() => setNewRoom((room) => ({ ...room, name: numbered }))}>{numbered}</button>;
                  })}
                </div>
                <div className="add-room-dimensions"><label>Width (m)<input type="number" inputMode="decimal" min="0.1" step="0.1" value={newRoom.width} onChange={(event) => setNewRoom((room) => ({ ...room, width: event.target.value }))} required /></label><label>Length (m)<input type="number" inputMode="decimal" min="0.1" step="0.1" value={newRoom.length} onChange={(event) => setNewRoom((room) => ({ ...room, length: event.target.value }))} required /></label></div>
                <p className="manual-room-note">Wall length will be estimated from the corrected floor area and room count.</p>
                <button type="submit" className="btn btn-primary">Add room to estimate</button>
                <button type="button" className="tool-button" onClick={() => { setAddingRoom(false); setPendingBox(null); setPrefill(null); }}>Cancel</button>
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
                      {room.manuallyPlaced && <span className="manual-badge">Placed by you</span>}
                      {room.position.width === 0 && <span className="manual-badge">Added without a box</span>}
                      {(room.dimensions.width <= 0 || room.dimensions.length <= 0) && <span className="manual-badge">Dimensions needed</span>}
                      <span className="room-dims">
                        {room.dimensions.width.toFixed(1)} x {room.dimensions.length.toFixed(1)}m
                      </span>
                      <span className={`source-badge ${dimensionNeedsReview(room.dimensionSource) ? 'needs-review' : ''}`}>
                        {dimensionSourceLabel(room.dimensionSource)}
                      </span>
                      {room.dimensionsVerified
                        ? <span className="source-badge">Size checked</span>
                        : printedCheck?.matchedRoomIds.includes(room.id)
                          ? <span className="source-badge">Matches plan</span>
                          : <span className="source-badge needs-review">Check size</span>}
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
        .coverage-panel { display: grid; gap: 8px; border: 1px solid #c6d9eb; border-radius: 12px; background: #f7fbff; padding: 14px 16px; }
        .coverage-panel label { color: #10243d; font-size: .85rem; font-weight: 700; }
        .coverage-panel input { width: min(100%, 280px); min-height: 42px; padding: 8px 10px; border: 1px solid #a9c2dd; border-radius: 8px; background: white; font-size: 1rem; }
        .coverage-panel p { margin: 0; color: #526985; font-size: .75rem; line-height: 1.45; }
        .coverage-figures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .coverage-figures span { display: grid; gap: 3px; border-radius: 8px; background: white; padding: 9px; color: #526985; font-size: .7rem; }
        .coverage-figures strong { color: #10243d; font-size: .95rem; }
        .placed-note { margin: 0; color: #314c69; font-size: .8rem; }
        .resize-question { border: 1px solid #e7c46a; border-radius: 12px; background: #fff9e9; padding: 12px 16px; color: #694408; }
        .resize-question p { margin: 0; font-size: .82rem; line-height: 1.5; }
        .name-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .name-chip { min-height: 32px; padding: 4px 10px; border: 1px solid #cbd8e6; border-radius: 999px; background: white; color: #173557; font-size: .75rem; font-weight: 600; cursor: pointer; }
        .name-chip.active { background: #0f294b; border-color: #0f294b; color: white; }
        .draw-instruction { margin: 0; border-radius: 8px; background: #fff2d6; padding: 10px 12px; color: #85510a; font-size: .8rem; }
        .scan-review { border: 1px solid #e7c46a; border-radius: 12px; background: #fff9e9; padding: 14px 16px; color: #694408; }
        .scan-review h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: .95rem; font-weight: 700; }
        .scan-review ul { margin: 0; padding-left: 22px; font-size: .82rem; line-height: 1.5; }
        .scan-review li + li { margin-top: 4px; }
        .printed-check { border: 1px solid #e7c46a; border-radius: 12px; background: #fff9e9; padding: 14px 16px; color: #694408; }
        .printed-check h2 { margin: 0 0 4px; font-size: .95rem; font-weight: 700; }
        .printed-check p { margin: 0 0 8px; font-size: .82rem; line-height: 1.5; }
        .printed-check ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
        .printed-check li { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; font-size: .82rem; line-height: 1.45; }
        .printed-check li span { flex: 1 1 220px; }
        .printed-check .tool-button { display: inline-flex; align-items: center; gap: 4px; min-height: 36px; }
        .rescan-panel { border: 1px solid #d9e3ef; border-radius: 12px; background: #f5f8fc; padding: 12px 16px; }
        .rescan-panel p { margin: 0; color: #314c69; font-size: .8rem; line-height: 1.5; }
        .rescan-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .rescan-actions .tool-button { display: inline-flex; align-items: center; gap: 6px; }
        .rescan-compare { margin-top: 12px; padding: 12px; border: 1px solid #b7cae1; border-radius: 9px; background: white; }
        .rescan-compare strong { color: #10243d; }
        .rescan-compare p { margin-top: 4px; }
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
        .source-guidance { margin: 0 0 12px; color: #526985; font-size: .75rem; line-height: 1.45; }
        .source-badge { display: inline-block; width: fit-content; border-radius: 5px; padding: 2px 6px; background: #e8f5f0; color: #17624a; font-size: .68rem; font-weight: 700; }
        .source-badge.needs-review { background: #fff2d6; color: #85510a; }
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
          .coverage-figures { grid-template-columns: 1fr; }
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
