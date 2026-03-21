'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PencilRuler, Ruler, HouseLine, Buildings, FileArrowUp,
  Plus, Minus, Trash, PlusCircle, CheckCircle, ArrowsOut,
  ListNumbers, Lightbulb, Info
} from '@phosphor-icons/react';
import { useBoqWizardStore, type RoomInputKey } from '@/store/boqWizardStore';

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
    accent: 'from-blue-500 to-indigo-600',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    ring: 'ring-blue-500',
    selectedBg: 'bg-slate-800',
  },
  {
    value: 'double_storey',
    label: 'Double Storey',
    description: 'Living areas on the ground floor, bedrooms above.',
    icon: Buildings,
    accent: 'from-violet-500 to-purple-700',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    ring: 'ring-violet-500',
    selectedBg: 'bg-slate-800',
  },
] as const;

const PLAN_MODES = [
  {
    key: 'quick' as const,
    label: 'Quick Room Count',
    description: 'Enter room counts and total floor area. Fast and simple.',
    icon: ListNumbers,
    accent: 'from-emerald-400 to-teal-600',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    ring: 'ring-emerald-500',
    selectedBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    tip: 'Best for early-stage estimates',
    tipColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  {
    key: 'detailed' as const,
    label: 'Detailed Room Plan',
    description: 'Use the interactive room builder to sketch each space with dimensions.',
    icon: PencilRuler,
    accent: 'from-orange-400 to-amber-600',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    ring: 'ring-orange-500',
    selectedBg: 'bg-gradient-to-br from-orange-500 to-amber-600',
    tip: 'Most accurate estimate',
    tipColor: 'text-orange-700 bg-orange-50 border-orange-200',
  },
  {
    key: 'upload' as const,
    label: 'Upload Floor Plan',
    description: 'Upload your architectural drawings — we extract dimensions automatically.',
    icon: FileArrowUp,
    accent: 'from-rose-400 to-pink-600',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    ring: 'ring-rose-500',
    selectedBg: 'bg-gradient-to-br from-rose-500 to-pink-600',
    badge: 'Coming Soon',
    badgeColor: 'text-rose-600 bg-rose-50 border-rose-200',
    tip: null,
    tipColor: '',
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
          className="text-slate-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          title={`Remove ${label}`}
        >
          <Trash size={15} weight="regular" />
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
    totalWindows,
    setTotalWindows,
    totalDoors,
    setTotalDoors,
  } = useBoqWizardStore();

  const [activeRoomKeys, setActiveRoomKeys] = useState<RoomInputKey[]>(() => {
    return Object.entries(projectDetails.roomInputs)
      .filter(([_, val]) => Number(val) > 0)
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
                  <div className={`font-bold text-base ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{type.label}</div>
                  <p className={`mt-1 text-xs leading-relaxed ${isSelected ? 'text-blue-700/80' : 'wiz-text-muted'}`}>{type.description}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Storey info callout */}
        <div className="wiz-alert wiz-alert--info">
          <Info size={15} weight="fill" className="wiz-alert__icon" />
          <p>
            Double storey adds structural complexity — ring beams, upper floor slab, and staircase add approx. 25–35% to the superstructure cost.
          </p>
        </div>
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
                onClick={() => setGeometryMode(mode.key)}
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
                  <div className={`text-sm font-bold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{mode.label}</div>
                  <p className={`mt-1 text-xs leading-relaxed ${isSelected ? 'text-blue-700/80' : 'wiz-text-muted'}`}>{mode.description}</p>
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
                      <div className="fixed inset-0 z-10" onClick={() => setIsRoomMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl z-20 overflow-hidden">
                        <div className="max-h-60 overflow-y-auto py-1">
                          {availableRooms.map((room) => (
                            <button
                              key={room.key}
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:wiz-text-primary transition-colors"
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="rounded-2xl border border-orange-100 bg-orange-50/40 p-5"
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
                className="rounded-xl border border-orange-200 bg-white px-5 py-2.5 text-sm font-semibold text-orange-700 shadow-sm hover:bg-orange-50 hover:border-orange-300 transition-colors"
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 p-10 text-center"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-100 bg-white shadow-sm mb-4">
              <FileArrowUp size={26} weight="regular" className="text-rose-400" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1.5">Upload Floor Plan</h3>
            <p className="text-sm wiz-text-muted mb-5 max-w-xs mx-auto leading-relaxed">
              Drag and drop your architectural drawings (PDF, PNG, JPG). We extract dimensions automatically.
            </p>
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              Select File
            </button>
            <div className="mt-5">
              <span className="inline-block rounded-full border border-rose-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-400">
                Coming Soon
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
