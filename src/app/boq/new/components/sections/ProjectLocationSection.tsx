'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CaretDown, City, Tree, MapPinPlus } from '@phosphor-icons/react';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const LOCATION_TYPES = [
  { value: 'urban', label: 'Urban', hint: 'City and town rates', icon: City },
  { value: 'peri-urban', label: 'Peri-Urban', hint: 'Growth corridor mix', icon: MapPinPlus },
  { value: 'rural', label: 'Rural', hint: 'Long-haul supply routes', icon: Tree },
] as const;



interface ProjectLocationSectionProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function ProjectLocationSection({ isCollapsed, onToggle }: ProjectLocationSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const handleToggle = onToggle || (() => setInternalCollapsed((prev) => !prev));

  const { projectDetails, updateProjectDetails } = useBoqWizardStore();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Project & Location</h2>
          <p className="mt-1 text-sm text-slate-500">Define your project identity and pricing location context.</p>
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
        <div className="space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Project Name</label>
            <input
              type="text"
              value={projectDetails.name}
              onChange={(event) => updateProjectDetails({ name: event.target.value })}
              placeholder="Borrowdale family home"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500"
            />
            {!projectDetails.name.trim() && (
              <p className="mt-1 text-xs text-amber-600">Add a project name so your estimate is easy to identify later.</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">City / Town</label>
              <input
                type="text"
                list="zimbabwe-cities"
                value={projectDetails.locationCity}
                onChange={(event) => updateProjectDetails({ locationCity: event.target.value })}
                placeholder="Harare"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500"
              />
              <datalist id="zimbabwe-cities">
                <option value="Harare" />
                <option value="Bulawayo" />
                <option value="Chitungwiza" />
                <option value="Mutare" />
                <option value="Epworth" />
                <option value="Gweru" />
                <option value="Kwekwe" />
                <option value="Kadoma" />
                <option value="Masvingo" />
                <option value="Chinhoyi" />
                <option value="Norton" />
                <option value="Marondera" />
                <option value="Ruwa" />
                <option value="Chegutu" />
                <option value="Zvishavane" />
                <option value="Bindura" />
                <option value="Victoria Falls" />
                <option value="Hwange" />
                <option value="Redcliff" />
              </datalist>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Specific Area</label>
              <input
                type="text"
                value={projectDetails.specificLocation}
                onChange={(event) => updateProjectDetails({ specificLocation: event.target.value })}
                placeholder="Borrowdale Brooke"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-slate-700">Location Type</label>
            <div className="grid gap-3 md:grid-cols-3">
              {LOCATION_TYPES.map((type) => {
                const selected = projectDetails.locationType === type.value;
                const Icon = type.icon;
                return (
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    key={type.value}
                    type="button"
                    onClick={() => updateProjectDetails({ locationType: type.value })}
                    className={`flex flex-col items-start gap-2 rounded-xl border p-4 transition-colors shadow-sm ${selected
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                      }`}
                  >
                    <Icon size={24} className={selected ? 'text-blue-600' : 'text-slate-400'} weight={selected ? "duotone" : "regular"} />
                    <div className="text-left">
                      <div className="text-sm font-semibold">{type.label}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{type.hint}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>


        </div>
      )}
    </section>
  );
}
