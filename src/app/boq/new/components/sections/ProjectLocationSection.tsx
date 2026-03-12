'use client';

import { motion } from 'framer-motion';
import { City, Tree, MapPinPlus, MapPin, CheckCircle } from '@phosphor-icons/react';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const LOCATION_TYPES = [
  {
    value: 'urban',
    label: 'Urban',
    hint: 'City & town rates apply',
    icon: City,
    color: 'blue',
  },
  {
    value: 'peri-urban',
    label: 'Peri-Urban',
    hint: 'Growth corridor mix',
    icon: MapPinPlus,
    color: 'violet',
  },
  {
    value: 'rural',
    label: 'Rural',
    hint: 'Long-haul transport premium',
    icon: Tree,
    color: 'emerald',
  },
] as const;

const LOCATION_CONTEXT: Record<string, { text: string; color: string }> = {
  urban: { text: 'Urban sites get competitive material rates and wider supplier choice.', color: 'blue' },
  'peri-urban': { text: 'Peri-urban areas may have slightly higher transport costs than city centres.', color: 'violet' },
  rural: { text: 'Rural sites carry a transport premium — our estimates account for this automatically.', color: 'amber' },
};

const ZIMBABWE_CITIES = [
  'Harare', 'Bulawayo', 'Chitungwiza', 'Mutare', 'Epworth', 'Gweru',
  'Kwekwe', 'Kadoma', 'Masvingo', 'Chinhoyi', 'Norton', 'Marondera',
  'Ruwa', 'Chegutu', 'Zvishavane', 'Bindura', 'Victoria Falls',
  'Hwange', 'Redcliff',
];

export default function ProjectLocationSection() {
  const { projectDetails, updateProjectDetails } = useBoqWizardStore();
  const ctx = projectDetails.locationType ? LOCATION_CONTEXT[projectDetails.locationType] : null;

  return (
    <div className="space-y-10">

      {/* ── Project Name ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">What's this project called?</h3>
          <p className="text-sm text-slate-500">Give it a memorable name so it's easy to find in your dashboard later.</p>
        </div>
        <div className="relative">
          <input
            type="text"
            value={projectDetails.name}
            onChange={(e) => updateProjectDetails({ name: e.target.value })}
            placeholder="e.g. Borrowdale Family Home"
            className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
          {projectDetails.name.trim() && (
            <CheckCircle weight="fill" size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" />
          )}
        </div>
        {!projectDetails.name.trim() && (
          <p className="text-xs text-amber-600 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
            A project name makes it much easier to find this estimate later.
          </p>
        )}
      </div>

      {/* ── City & Area ────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Where is the site?</h3>
          <p className="text-sm text-slate-500">City and specific area help us apply the most accurate local pricing.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative">
            <MapPin size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              list="zw-cities"
              value={projectDetails.locationCity}
              onChange={(e) => updateProjectDetails({ locationCity: e.target.value })}
              placeholder="City / Town (e.g. Harare)"
              className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-10 pr-5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
            <datalist id="zw-cities">
              {ZIMBABWE_CITIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <input
              type="text"
              value={projectDetails.specificLocation}
              onChange={(e) => updateProjectDetails({ specificLocation: e.target.value })}
              placeholder="Specific area (e.g. Borrowdale Brooke)"
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
        </div>
      </div>

      {/* ── Location Type ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">What type of location is this?</h3>
          <p className="text-sm text-slate-500">Location type directly affects how we price transportation and material supply.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {LOCATION_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = projectDetails.locationType === type.value;
            return (
              <motion.button
                key={type.value}
                type="button"
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updateProjectDetails({ locationType: type.value })}
                className={`group relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400/20 shadow-blue-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-md'
                }`}
              >
                {isSelected && (
                  <CheckCircle weight="fill" size={18} className="absolute top-4 right-4 text-blue-500" />
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                }`}>
                  <Icon size={20} weight={isSelected ? 'fill' : 'regular'} />
                </div>
                <div>
                  <div className={`font-semibold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{type.label}</div>
                  <div className={`mt-0.5 text-xs ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>{type.hint}</div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {ctx && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-start gap-3 rounded-xl border p-4 text-sm bg-${ctx.color}-50/60 border-${ctx.color}-200 text-${ctx.color}-800`}
          >
            <span className="mt-0.5 text-base">💡</span>
            <p>{ctx.text}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
