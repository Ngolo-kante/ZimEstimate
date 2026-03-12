'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CaretDown, PencilRuler, Ruler, HouseLine, Buildings, FileArrowUp, Plus, Minus, Trash, PlusCircle } from '@phosphor-icons/react';
import { useBoqWizardStore, type RoomInputKey } from '@/store/boqWizardStore';
import { getProjectTypeConfig } from '@/app/boq/new/projectTypes';

interface BuildingDesignSectionProps {
  onLaunchRoomBuilder: () => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const BUILDING_TYPES = [
  { value: 'single_storey', label: 'Single Storey', icon: HouseLine },
  { value: 'double_storey', label: 'Double Storey', icon: Buildings },
] as const;

const QUICK_ROOMS: Array<{ key: RoomInputKey; label: string }> = [
  { key: 'bedrooms', label: 'Bedrooms' },
  { key: 'ensuiteBedrooms', label: 'En-suite Bedrooms' },
  { key: 'bathrooms', label: 'Bathrooms' },
  { key: 'guestToilet', label: 'Guest Toilet' },
  { key: 'livingRoom', label: 'Living Room' },
  { key: 'diningRoom', label: 'Dining Room' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'pantry', label: 'Pantry' },
  { key: 'scullery', label: 'Scullery' },
  { key: 'study', label: 'Study / Office' },
  { key: 'storeRoom', label: 'Store Room' },
  { key: 'veranda', label: 'Veranda / Porch' },
  { key: 'passage', label: 'Passages' },
  { key: 'garage1', label: 'Garage (Single)' },
  { key: 'garage2', label: 'Garage (Double)' },
];

const Stepper = ({ label, value, onChange, onRemove }: { label: string; value: number; onChange: (v: number) => void; onRemove?: () => void }) => (
  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm transition-colors hover:border-blue-200 group">
    <div className="flex items-center gap-2">
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          title={`Remove ${label}`}
        >
          <Trash size={16} weight="duotone" />
        </button>
      )}
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-transform"
      >
        <Minus size={14} weight="bold" />
      </button>
      <span className="w-5 text-center text-sm font-semibold text-slate-900">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-transform"
      >
        <Plus size={14} weight="bold" />
      </button>
    </div>
  </div>
);

export default function BuildingDesignSection({ onLaunchRoomBuilder, isCollapsed, onToggle }: BuildingDesignSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const handleToggle = onToggle || (() => setInternalCollapsed((prev) => !prev));
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

  const projectTypeConfig = getProjectTypeConfig(projectDetails.projectType);
  const requiresGeometry = projectTypeConfig?.requiresGeometry ?? true;

  const [activeRoomKeys, setActiveRoomKeys] = useState<RoomInputKey[]>(() => {
    const existing = Object.entries(projectDetails.roomInputs)
      .filter(([_, val]) => Number(val) > 0)
      .map(([key]) => key as RoomInputKey);
    return existing;
  });

  const availableRooms = QUICK_ROOMS.filter(r => !activeRoomKeys.includes(r.key));

  const detailedArea = useMemo(
    () => detailedRooms.reduce((sum, room) => sum + (room.length * room.width), 0),
    [detailedRooms]
  );

  const quickArea = Number(projectDetails.floorPlanSize);
  const showAreaWarning = requiresGeometry && geometryMode === 'quick' && (!Number.isFinite(quickArea) || quickArea <= 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Building Design</h2>
          <p className="mt-1 text-sm text-slate-500">Choose quick area entry or draw a floor plan with detailed rooms.</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          aria-label="Toggle section"
        >
          <CaretDown className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </header>

      {!collapsed && (
        <div className="space-y-6 p-6">
          {!requiresGeometry && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              This project type does not require full building geometry. You can skip this step or add details if they help your estimate.
            </div>
          )}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
            <label htmlFor="top-floor-area" className="mb-2 block text-sm font-bold text-slate-800 flex items-center gap-2">
              <Ruler size={20} className="text-blue-600" /> Enter Total Floor Area (m2)
            </label>
            <p className="mb-4 text-xs text-slate-500">The total internal ground area of the building.</p>
            <input
              id="top-floor-area"
              type="number"
              value={projectDetails.floorPlanSize}
              onChange={(event) => updateProjectDetails({ floorPlanSize: event.target.value })}
              placeholder="e.g. 150"
              className={`w-full max-w-sm rounded-xl border px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${geometryMode === 'quick' && showAreaWarning ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'}`}
            />
            {geometryMode === 'quick' && showAreaWarning && (
              <p className="mt-2 text-xs font-medium text-amber-600">Floor area is required to generate an estimate.</p>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2 pt-4 border-t border-slate-100">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Building Type
              </label>
              <div className="grid gap-3 grid-cols-2">
                {BUILDING_TYPES.map((type) => {
                  const selected = projectDetails.buildingType === type.value;
                  const Icon = type.icon;
                  return (
                    <motion.button
                      key={type.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => updateProjectDetails({ buildingType: type.value })}
                      className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-colors shadow-sm text-sm font-semibold ${selected
                        ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 hover:shadow-md text-slate-700'
                        }`}
                    >
                      <Icon size={28} className={selected ? 'text-blue-600' : 'text-slate-400'} weight={selected ? "duotone" : "regular"} />
                      {type.label}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Wall Height (m)</label>
              <input
                type="number"
                value={projectDetails.wallHeight}
                onChange={(event) => updateProjectDetails({ wallHeight: event.target.value })}
                placeholder="2.7"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mb-6 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-medium text-slate-700 mb-3">How do you want to define the details?</h3>
            <div className="grid gap-3 lg:grid-cols-3">
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setGeometryMode('quick')}
                className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors shadow-sm ${geometryMode === 'quick'
                  ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                  }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Ruler size={20} className={geometryMode === 'quick' ? 'text-blue-600' : 'text-slate-500'} weight={geometryMode === 'quick' ? "duotone" : "regular"} />
                  Quick Rough Plan
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Swiftly add rooms, doors, and windows using simple counters.</p>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setGeometryMode('detailed')}
                className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors shadow-sm ${geometryMode === 'detailed'
                  ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                  }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <PencilRuler size={20} className={geometryMode === 'detailed' ? 'text-blue-600' : 'text-slate-500'} weight={geometryMode === 'detailed' ? "duotone" : "regular"} />
                  Detailed Plan
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Use our interactive room builder to sketch out spaces precisely.</p>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setGeometryMode('upload')}
                className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors shadow-sm ${geometryMode === 'upload'
                  ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                  }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileArrowUp size={20} className={geometryMode === 'upload' ? 'text-blue-600' : 'text-slate-500'} weight={geometryMode === 'upload' ? "duotone" : "regular"} />
                  Upload Plan
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Upload a PDF or image of your plan for automated extraction.</p>
              </motion.button>
            </div>
          </div>

          {geometryMode === 'quick' && (
            <div className="rounded-xl border border-blue-50 bg-blue-50/30 p-5 mt-4">
              <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Add Rooms <span className="text-slate-500 font-normal">(Optional)</span></h4>
                  <p className="text-xs text-slate-500 mt-1">Roughly define the number of rooms to increase estimate accuracy.</p>
                </div>
                {availableRooms.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsRoomMenuOpen((prev) => !prev)}
                      className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <PlusCircle size={18} weight="duotone" />
                      Add Room Menu
                    </button>
                    {isRoomMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setIsRoomMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl transition-all z-20 overflow-hidden">
                          <div className="max-h-60 overflow-y-auto py-1">
                            {availableRooms.map((room) => (
                              <button
                                key={room.key}
                                type="button"
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                                onClick={() => {
                                  setActiveRoomKeys(prev => [...prev, room.key]);
                                  updateProjectDetails({
                                    roomInputs: { ...projectDetails.roomInputs, [room.key]: '1' }
                                  });
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeRoomKeys.map(key => {
                  const roomDef = QUICK_ROOMS.find(r => r.key === key);
                  if (!roomDef) return null;
                  return (
                    <Stepper
                      key={key}
                      label={roomDef.label}
                      value={Number(projectDetails.roomInputs[key]) || 0}
                      onChange={(val) => updateProjectDetails({
                        roomInputs: { ...projectDetails.roomInputs, [key]: String(val) }
                      })}
                      onRemove={() => {
                        setActiveRoomKeys(prev => prev.filter(k => k !== key));
                        updateProjectDetails({
                          roomInputs: { ...projectDetails.roomInputs, [key]: '0' }
                        });
                      }}
                    />
                  );
                })}
              </div>

              <div className="mt-8 mb-4">
                <h4 className="text-sm font-semibold text-slate-900">Openings <span className="text-slate-500 font-normal">(Optional)</span></h4>
                <p className="text-xs text-slate-500 mt-1">Specify doors and windows for more precise finishing costs.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Stepper label="Internal Doors" value={totalDoors} onChange={setTotalDoors} />
                <Stepper label="Windows" value={totalWindows} onChange={setTotalWindows} />
              </div>
            </div>
          )}

          {geometryMode === 'detailed' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-blue-900">Detailed Room Builder</p>
                  <p className="mt-1 text-xs text-blue-700">
                    {detailedRooms.length > 0
                      ? `${detailedRooms.length} rooms captured • ${detailedArea.toFixed(1)} m2`
                      : 'No rooms captured yet. Launch the editor to calculate area.'}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="launch-floor-plan-editor"
                  onClick={onLaunchRoomBuilder}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                >
                  Launch Floor Plan Editor
                </button>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Derived Floor Area (m2)</label>
                <input
                  type="text"
                  value={detailedArea > 0 ? detailedArea.toFixed(1) : '0.0'}
                  readOnly
                  className="w-full max-w-[200px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 font-medium"
                />
              </div>
            </div>
          )}

          {geometryMode === 'upload' && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-white/50 pointer-events-none" />
              <div className="relative z-10 w-full max-w-sm mx-auto">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100/80 text-blue-600 mb-4 ring-8 ring-white">
                  <FileArrowUp size={28} weight="duotone" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">Upload Floor Plan</h3>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Drag and drop your architectural drawings (PDF, PNG, JPG) or click to browse. We will automatically extract dimensions.
                </p>
                <button type="button" className="rounded-xl bg-white border border-slate-200 shadow-sm px-8 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors w-full sm:w-auto">
                  Select File
                </button>
                <div className="mt-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-widest">
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
