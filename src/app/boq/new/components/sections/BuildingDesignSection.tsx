'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PencilRuler, Ruler, HouseLine, Buildings, FileArrowUp,
  Plus, Minus, Trash, PlusCircle, CheckCircle, ArrowsOut,
  ListNumbers, Lightbulb, Info, SpinnerGap, Warning
} from '@phosphor-icons/react';
import { useBoqWizardStore, type RoomInputKey } from '@/store/boqWizardStore';
import { planToWizardRooms } from '@/lib/vision/planToWizardRooms';
import type { VisionAnalysisResult } from '@/lib/vision/types';

/** Matches what /api/vision/analyze will accept. */
const PLAN_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,application/pdf';
const PLAN_MAX_BYTES = 10 * 1024 * 1024;

interface BuildingDesignSectionProps {
  onLaunchRoomBuilder: () => void;
}

// ── DATA ────────────────────────────────────────────────────────────────────

const BUILDING_TYPES = [
  {
    value: 'single_storey',
    label: 'Single Storey',
    description: 'All rooms on one level — most common in Zimbabwe.',
    icon: HouseLine,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    value: 'double_storey',
    label: 'Double Storey',
    description: 'Living areas on the ground floor, bedrooms above.',
    icon: Buildings,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
] as const;

const PLAN_MODES = [
  {
    key: 'quick' as const,
    label: 'Quick Room Count',
    description: 'Enter room counts and total floor area. Fast and simple.',
    icon: ListNumbers,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    tip: 'Best for early-stage estimates',
    tipColor: 'text-blue-700 bg-blue-50 border-blue-200',
    badge: null as string | null,
    badgeColor: '',
  },
  {
    key: 'detailed' as const,
    label: 'Detailed Room Plan',
    description: 'Use the interactive room builder to sketch each space with dimensions.',
    icon: PencilRuler,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    tip: 'Most accurate estimate',
    tipColor: 'text-blue-700 bg-blue-50 border-blue-200',
    badge: null as string | null,
    badgeColor: '',
  },
  {
    key: 'upload' as const,
    label: 'Upload Floor Plan',
    description: 'Upload your architectural drawings — we extract dimensions automatically.',
    icon: FileArrowUp,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    tip: 'Fastest if you have drawings',
    tipColor: 'text-blue-700 bg-blue-50 border-blue-200',
    badge: null as string | null,
    badgeColor: '',
  },
] as const;

const QUICK_ROOMS: Array<{ key: RoomInputKey; label: string }> = [
  { key: 'bedrooms',         label: 'Bedrooms' },
  { key: 'ensuiteBedrooms',  label: 'En-suite Bedrooms' },
  { key: 'bathrooms',        label: 'Bathrooms' },
  { key: 'guestToilet',      label: 'Guest Toilet' },
  { key: 'livingRoom',       label: 'Living Room' },
  { key: 'diningRoom',       label: 'Dining Room' },
  { key: 'kitchen',          label: 'Kitchen' },
  { key: 'pantry',           label: 'Pantry' },
  { key: 'scullery',         label: 'Scullery' },
  { key: 'study',            label: 'Study / Office' },
  { key: 'storeRoom',        label: 'Store Room' },
  { key: 'veranda',          label: 'Veranda / Porch' },
  { key: 'passage',          label: 'Passages' },
  { key: 'garage1',          label: 'Garage (Single)' },
  { key: 'garage2',          label: 'Garage (Double)' },
];

// ── STEPPER ──────────────────────────────────────────────────────────────────

const Stepper = ({
  label,
  value,
  onChange,
  onRemove,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onRemove?: () => void;
}) => (
  <div className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 transition-colors hover:border-slate-300">
    <div className="flex items-center gap-2">
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-red-500 transition-colors"
          title={`Remove ${label}`}
        >
          <Trash size={15} weight="bold" />
        </button>
      )}
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
      >
        <Minus size={13} weight="bold" />
      </button>
      <span className="w-5 text-center text-sm font-semibold wiz-text-primary">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
      >
        <Plus size={13} weight="bold" />
      </button>
    </div>
  </div>
);

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function BuildingDesignSection({ onLaunchRoomBuilder }: BuildingDesignSectionProps) {
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);

  const {
    projectDetails,
    updateProjectDetails,
    geometryMode,
    setGeometryMode,
    detailedRooms,
    setDetailedRooms,
    totalWindows,
    setTotalWindows,
    totalDoors,
    setTotalDoors,
  } = useBoqWizardStore();

  /* ---- Uploaded plan ---- */
  const planInputRef = useRef<HTMLInputElement>(null);
  const [planStatus, setPlanStatus] = useState<'idle' | 'reading'>('idle');
  const [planError, setPlanError] = useState<string | null>(null);
  const [planSummary, setPlanSummary] = useState<
    { fileName: string; rooms: number; area: number; confidence: number } | null
  >(null);

  /* The read is a real model call on a real drawing and takes anywhere from
     20 seconds to about two minutes. A bare spinner for that long reads as a
     hang, and a progress bar would have to invent a percentage nobody can
     know — so this names the stage it is plausibly on and counts the seconds,
     which is honest and still feels like movement. */
  const PLAN_STAGES = [
    'Reading the drawing',
    'Finding the rooms',
    'Measuring dimensions',
    'Checking the structure',
  ];
  const [planStage, setPlanStage] = useState(0);
  const [planElapsed, setPlanElapsed] = useState(0);

  useEffect(() => {
    if (planStatus !== 'reading') return;
    const started = Date.now();
    const tick = setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setPlanElapsed(seconds);
      // Holds on the last stage rather than looping, so it never claims to
      // start over on a slow read.
      setPlanStage(Math.min(Math.floor(seconds / 8), PLAN_STAGES.length - 1));
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planStatus]);

  /* planSummary only lives for this mount, so after a reload the panel showed
     "Select file" again even though the plan's rooms were still loaded and
     still being costed. Falling back to the store means the panel reflects
     what the estimate is actually using, not what happened to be uploaded
     during this visit. The file name and confidence are genuinely unknown in
     that case, so they are left out rather than guessed at. */
  const planView = planSummary ?? (detailedRooms.length > 0 && Number(projectDetails.floorPlanSize) > 0
    ? {
        fileName: null as string | null,
        rooms: detailedRooms.length,
        area: Number(projectDetails.floorPlanSize),
        confidence: null as number | null,
      }
    : null);

  const readPlan = async (file: File) => {
    setPlanError(null);
    setPlanStage(0);
    setPlanElapsed(0);

    if (!PLAN_ACCEPT.split(',').includes(file.type)) {
      setPlanError('Choose a PDF, PNG, JPG or WEBP drawing.');
      return;
    }
    if (file.size > PLAN_MAX_BYTES) {
      setPlanError('That file is over 10 MB. Try exporting the plan at a smaller size.');
      return;
    }

    setPlanStatus('reading');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/vision/analyze', { method: 'POST', body });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        setPlanError(payload?.error || 'We could not read that plan. Try a clearer copy, or use the room builder.');
        return;
      }

      const mapped = planToWizardRooms(payload.data as VisionAnalysisResult);

      if (mapped.rooms.length === 0 || mapped.totalArea <= 0) {
        setPlanError('No rooms could be measured on that drawing. Try a clearer copy, or use the room builder.');
        return;
      }

      /* Writes exactly what the room builder writes: the rooms, and the one
         area field the estimate is actually costed from. Nothing downstream
         needs to know the numbers arrived from a drawing. */
      setDetailedRooms(mapped.rooms);
      updateProjectDetails({ floorPlanSize: String(mapped.totalArea) });
      if (mapped.doors > 0) setTotalDoors(mapped.doors);
      if (mapped.windows > 0) setTotalWindows(mapped.windows);

      setPlanSummary({
        fileName: file.name,
        rooms: mapped.rooms.length,
        area: mapped.totalArea,
        confidence: mapped.confidence,
      });
    } catch {
      setPlanError('That upload did not complete. Check your connection and try again.');
    } finally {
      setPlanStatus('idle');
    }
  };

  const [activeRoomKeys, setActiveRoomKeys] = useState<RoomInputKey[]>(() => {
    return Object.entries(projectDetails.roomInputs)
      .filter(([, val]) => Number(val) > 0)
      .map(([key]) => key as RoomInputKey);
  });

  const availableRooms = QUICK_ROOMS.filter((r) => !activeRoomKeys.includes(r.key));

  const detailedArea = useMemo(
    () => detailedRooms.reduce((sum, room) => sum + room.length * room.width, 0),
    [detailedRooms]
  );

  const floorArea = Number(projectDetails.floorPlanSize);
  const showAreaWarning = geometryMode === 'quick' && (!Number.isFinite(floorArea) || floorArea <= 0);

  return (
    <div className="space-y-10">

      {/* ── 1. Storey question ───────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold wiz-text-primary mb-1">Is this a single or double storey?</h3>
          <p className="text-sm wiz-text-muted">
            Storey type affects structural design, staircase requirements, and overall build cost.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {BUILDING_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = projectDetails.buildingType === type.value;
            return (
              <motion.button
                key={type.value}
                type="button"
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => updateProjectDetails({ buildingType: type.value })}
                className={`group relative flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 ${
                  isSelected
                    ? `bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm`
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {isSelected && (
                   <CheckCircle weight="fill" size={18} className="absolute top-4 right-4 text-blue-500" />
                )}
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isSelected ? type.iconBg : type.iconBg
                }`}>
                  <Icon size={22} weight="regular" className={isSelected ? type.iconColor : type.iconColor} />
                </div>
                <div>
                  <div className={`font-bold text-base ${isSelected ? 'text-slate-900' : 'text-slate-800'}`}>{type.label}</div>
                  <p className={`mt-1 text-xs leading-relaxed ${isSelected ? 'text-slate-600' : 'wiz-text-muted'}`}>{type.description}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Storey info callout — only shown for double storey */}
        <AnimatePresence>
          {projectDetails.buildingType === 'double_storey' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="wiz-alert wiz-alert--info"
            >
              <Info size={15} weight="fill" className="wiz-alert__icon" />
              <p>
                Double storey adds structural complexity — ring beams, upper floor slab, and staircase add approx. 25–35% to the superstructure cost.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 2. Floor area ────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold wiz-text-primary mb-1">What is the total floor area?</h3>
          <p className="text-sm wiz-text-muted">
            Enter the total internal floor area in square metres. This is the single most important figure for your estimate accuracy.
          </p>
        </div>
        <div className="relative max-w-xs">
          <Ruler size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="top-floor-area"
            type="number"
            value={projectDetails.floorPlanSize}
            onChange={(e) => updateProjectDetails({ floorPlanSize: e.target.value })}
            placeholder="e.g. 150"
            className={`w-full rounded-2xl border py-4 pl-10 pr-12 text-base font-semibold wiz-text-primary shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 placeholder:font-normal placeholder:text-slate-400 ${
              showAreaWarning ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
            }`}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">m²</span>
        </div>
        {showAreaWarning && (
          <div className="wiz-alert wiz-alert--warn max-w-xs">
            <Info size={14} weight="fill" className="wiz-alert__icon" />
            <p className="font-medium">Floor area is required to generate an estimate.</p>
          </div>
        )}

        {/* Stand size — drives boundary wall length for exterior works */}
        <div className="pt-1">
          <label htmlFor="stand-size" className="mb-2 block text-sm font-semibold text-slate-700">
            Stand size <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <div className="relative max-w-xs">
            <Ruler size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="stand-size"
              type="number"
              value={projectDetails.standSize}
              onChange={(e) => updateProjectDetails({ standSize: e.target.value })}
              placeholder="e.g. 600"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-sm font-semibold wiz-text-primary shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 placeholder:font-normal placeholder:text-slate-400"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">m²</span>
          </div>
          <p className="mt-2 max-w-xs text-xs wiz-text-muted">
            Used to size the boundary wall and gates. Left blank, we assume a 600m² stand.
          </p>
        </div>

        {/* Wall height */}
        <div className="pt-1">
          <label className="mb-2 block text-sm font-semibold text-slate-700">Wall height</label>
          <div className="relative max-w-xs">
            <ArrowsOut size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="number"
              value={projectDetails.wallHeight}
              onChange={(e) => updateProjectDetails({ wallHeight: e.target.value })}
              placeholder="2.7"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm wiz-text-primary shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 placeholder:text-slate-400"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">m</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Standard Zimbabwean residential ceiling height is 2.7 m.</p>
        </div>
      </div>

      {/* ── 3. Plan details ──────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold wiz-text-primary mb-1">How do you want to provide your plan details?</h3>
          <p className="text-sm wiz-text-muted">
            Choose how you describe the layout. More detail means a more accurate estimate.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {PLAN_MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = geometryMode === mode.key;
            return (
              <motion.button
                key={mode.key}
                type="button"
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setGeometryMode(mode.key);

                  // Choosing "Detailed Room Plan" is already the decision to
                  // draw the plan, so open the editor rather than revealing a
                  // panel whose only content is a button that opens it. The
                  // exception is coming back to a plan already drawn — then
                  // the panel's summary is what you want, not the editor
                  // reopening over it.
                  if (mode.key === 'detailed' && detailedRooms.length === 0) {
                    onLaunchRoomBuilder();
                    return;
                  }

                  // The panel this reveals sits below the fold, so selecting a
                  // mode looked like nothing happened and users did not find
                  // the room inputs they were being asked for.
                  requestAnimationFrame(() => {
                    document
                      .getElementById('plan-details-panel')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  });
                }}
                className={`relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-200 ${
                  isSelected
                    ? `bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm`
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {isSelected && (
                  <CheckCircle weight="fill" size={15} className="absolute top-3 right-3 text-blue-500" />
                )}
                {'badge' in mode && mode.badge && !isSelected && (
                  <span className={`absolute top-3 right-3 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${mode.badgeColor}`}>
                    {mode.badge}
                  </span>
                )}
                {'badge' in mode && mode.badge && isSelected && (
                  <span className={`absolute top-3 right-3 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${mode.badgeColor}`}>
                    {mode.badge}
                  </span>
                )}

                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  isSelected ? mode.iconBg : mode.iconBg
                }`}>
                  <Icon size={20} weight="regular" className={isSelected ? mode.iconColor : mode.iconColor} />
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-bold ${isSelected ? 'text-slate-900' : 'text-slate-800'}`}>{mode.label}</div>
                  <p className={`mt-1 text-xs leading-relaxed ${isSelected ? 'text-slate-600' : 'wiz-text-muted'}`}>{mode.description}</p>
                </div>

                {/* Tip badge at the bottom — shown when not selected */}
                {'tip' in mode && mode.tip && !isSelected && (
                  <div className={`flex items-center gap-1 self-start rounded-full border px-2 py-0.5 text-[10px] font-semibold ${mode.tipColor}`}>
                    <Lightbulb size={10} weight="fill" />
                    {mode.tip}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {geometryMode === null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="wiz-alert wiz-alert--info"
          >
            <Info size={15} weight="fill" className="wiz-alert__icon" />
            <p>Select a method above to continue building your estimate.</p>
          </motion.div>
        )}
      </div>

      {/* ── Quick mode content ────────────────────────────────────────── */}
      <AnimatePresence>
        {geometryMode === 'quick' && (
          <motion.div
            id="plan-details-panel"
            style={{ scrollMarginTop: 160 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="space-y-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-5"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="text-sm font-bold wiz-text-primary">Rooms <span className="font-normal text-slate-400">(optional)</span></h4>
                <p className="text-xs wiz-text-muted mt-0.5">Defining rooms increases estimate accuracy.</p>
              </div>
              {availableRooms.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsRoomMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50"
                  >
                    <PlusCircle size={15} weight="regular" />
                    Add room
                  </button>
                  {isRoomMenuOpen && (
                    <>
                      {/* The backdrop is fixed and covers the page, so it also
                          swallowed the scroll. Combined with a dropdown that
                          always opened downward, a menu opened near the bottom
                          of a phone was cut off with no way to reach the rest.
                          Below sm it is now a bottom sheet, which cannot be
                          clipped and scrolls on its own. */}
                      <div
                        className="fixed inset-0 z-[60] bg-slate-900/30 sm:bg-transparent"
                        onClick={() => setIsRoomMenuOpen(false)}
                      />
                      <div
                        className="fixed inset-x-0 bottom-0 z-[70] max-h-[70vh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl
                                   sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:bottom-auto sm:mt-2 sm:w-48 sm:max-h-none sm:rounded-xl"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:hidden">
                          <span className="text-sm font-bold text-slate-900">Add a room</span>
                          <button
                            type="button"
                            onClick={() => setIsRoomMenuOpen(false)}
                            className="rounded-lg px-2 py-1 text-sm text-slate-500"
                            aria-label="Close"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="max-h-[55vh] overflow-y-auto py-1 sm:max-h-60">
                          {availableRooms.map((room) => (
                            <button
                              key={room.key}
                              type="button"
                              className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:wiz-text-primary transition-colors sm:py-2"
                              onClick={() => {
                                setActiveRoomKeys((prev) => [...prev, room.key]);
                                updateProjectDetails({ roomInputs: { ...projectDetails.roomInputs, [room.key]: '1' } });
                                setIsRoomMenuOpen(false);
                              }}
                            >
                              {room.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {activeRoomKeys.map((key) => {
                const roomDef = QUICK_ROOMS.find((r) => r.key === key);
                if (!roomDef) return null;
                return (
                  <Stepper
                    key={key}
                    label={roomDef.label}
                    value={Number(projectDetails.roomInputs[key]) || 0}
                    onChange={(val) => updateProjectDetails({ roomInputs: { ...projectDetails.roomInputs, [key]: String(val) } })}
                    onRemove={() => {
                      setActiveRoomKeys((prev) => prev.filter((k) => k !== key));
                      updateProjectDetails({ roomInputs: { ...projectDetails.roomInputs, [key]: '0' } });
                    }}
                  />
                );
              })}
              {activeRoomKeys.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                  No rooms added yet — click &ldquo;Add room&rdquo; above.
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-bold wiz-text-primary mb-1">Openings <span className="font-normal text-slate-400">(optional)</span></h4>
              <p className="text-xs wiz-text-muted mb-3">Doors and windows affect finishing and joinery costs.</p>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <Stepper label="Internal Doors" value={totalDoors} onChange={setTotalDoors} />
                <Stepper label="Windows" value={totalWindows} onChange={setTotalWindows} />
              </div>
            </div>
          </motion.div>
        )}

        {geometryMode === 'detailed' && (
          <motion.div
            id="plan-details-panel"
            style={{ scrollMarginTop: 160 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold wiz-text-primary">Room Builder</p>
                <p className="mt-0.5 text-xs wiz-text-muted">
                  {detailedRooms.length > 0
                    ? `${detailedRooms.length} rooms · ${detailedArea.toFixed(1)} m²`
                    : 'No rooms captured yet — launch the editor to sketch your plan.'}
                </p>
              </div>
              <button
                type="button"
                data-testid="launch-floor-plan-editor"
                onClick={onLaunchRoomBuilder}
                className="rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                Launch Floor Plan Editor
              </button>
            </div>
            {detailedArea > 0 && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-xs wiz-text-muted">Derived area:</span>
                <span className="font-bold text-slate-800 text-sm">{detailedArea.toFixed(1)} m²</span>
              </div>
            )}
          </motion.div>
        )}

        {geometryMode === 'upload' && (
          <motion.div
            id="plan-details-panel"
            style={{ scrollMarginTop: 160 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm mb-4">
              <FileArrowUp size={26} weight="regular" className="text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1.5">Upload Floor Plan</h3>
            <p className="text-sm wiz-text-muted mb-5 max-w-sm mx-auto leading-relaxed">
              Upload your architectural drawing (PDF, PNG, JPG or WEBP) and we read
              the room sizes off it. You can correct anything before costing.
            </p>

            <input
              ref={planInputRef}
              type="file"
              accept={PLAN_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Reset first, so re-picking the same file still fires a change.
                event.target.value = '';
                if (file) void readPlan(file);
              }}
            />

            <button
              type="button"
              disabled={planStatus === 'reading'}
              onClick={() => planInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-default disabled:opacity-60"
            >
              {planStatus === 'reading' ? (
                <>
                  <SpinnerGap size={16} className="animate-spin" />
                  Reading your plan…
                </>
              ) : (
                <>
                  <FileArrowUp size={16} />
                  {planSummary ? 'Upload a different plan' : 'Select file'}
                </>
              )}
            </button>

            {planStatus === 'reading' && (
              <div className="mx-auto mt-5 max-w-sm" aria-live="polite">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
                  </span>
                  {PLAN_STAGES[planStage]}…
                </div>
                <div className="mt-3 flex flex-col gap-1">
                  {PLAN_STAGES.map((stage, index) => (
                    <div key={stage} className="flex items-center gap-2 text-left">
                      <span
                        className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                          index <= planStage ? 'bg-blue-500' : 'bg-slate-200'
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs wiz-text-muted tabular-nums">
                  {planElapsed}s elapsed — a detailed PDF can take up to two minutes.
                </p>
              </div>
            )}

            {planError && (
              <div
                role="alert"
                className="mx-auto mt-5 flex max-w-sm items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left"
              >
                <Warning size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-900">{planError}</p>
              </div>
            )}

            {planView && !planError && planStatus !== 'reading' && (
              <div className="mx-auto mt-5 max-w-sm rounded-xl border border-slate-200 bg-white p-4 text-left">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="shrink-0 text-emerald-600" />
                  <span className="truncate text-sm font-bold text-slate-800">
                    {planView.fileName ?? 'Plan read'}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
                  <dt className="wiz-text-muted">Rooms found</dt>
                  <dd className="text-right font-bold text-slate-800">{planView.rooms}</dd>
                  <dt className="wiz-text-muted">Floor area</dt>
                  <dd className="text-right font-bold tabular-nums text-slate-800">
                    {planView.area.toFixed(1)} m²
                  </dd>
                  {totalDoors > 0 && (
                    <>
                      <dt className="wiz-text-muted">Doors</dt>
                      <dd className="text-right font-bold tabular-nums text-slate-800">{totalDoors}</dd>
                    </>
                  )}
                  {totalWindows > 0 && (
                    <>
                      <dt className="wiz-text-muted">Windows</dt>
                      <dd className="text-right font-bold tabular-nums text-slate-800">{totalWindows}</dd>
                    </>
                  )}
                </dl>
                {/* Said plainly rather than hidden: the figures came off a
                    drawing, and the person checking them is the one who knows
                    what the building actually is. */}
                <p className="mt-3 text-xs leading-relaxed wiz-text-muted">
                  {planView.confidence === null
                    ? 'These rooms are loaded. Open the room builder to check or adjust any of them.'
                    : planView.confidence >= 80
                      ? 'Read with high confidence. Open the room builder to check or adjust any room.'
                      : `Read with ${Math.round(planView.confidence)}% confidence, so it is worth checking. Open the room builder to correct any room.`}
                </p>
                <button
                  type="button"
                  onClick={onLaunchRoomBuilder}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800"
                >
                  <ArrowsOut size={14} />
                  Open room builder to edit
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
