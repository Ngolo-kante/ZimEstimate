'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CaretDown, Warning, CheckCircle, Question, Mountains, TrendUp, type Icon } from '@phosphor-icons/react';
import {
  LOCATION_PROCEDURE_RULES,
  SOIL_RISK_PROFILES,
  type SoilType,
} from '@/lib/buildFlowRules';
import { useBoqWizardStore, type SiteSlopeType } from '@/store/boqWizardStore';

const SLOPE_OPTIONS: Array<{ value: SiteSlopeType; label: string; hint: string; img: string }> = [
  { value: 'flat', label: 'Flat', hint: 'Minimal leveling needed', img: '/topo-flat.webp' },
  { value: 'gentle', label: 'Gentle', hint: 'Slight gradient', img: '/topo-gentle.webp' },
  { value: 'moderate', label: 'Moderate', hint: 'Noticeable slope', img: '/topo-moderate.webp' },
  { value: 'steep', label: 'Steep', hint: 'Requires retaining walls', img: '/topo-steep.webp' },
];

const SOIL_OPTIONS: Array<{ value: SoilType | 'not_sure'; label: string; icon: Icon; hint: string }> = [
  { value: 'sandy', label: 'Sandy', icon: Warning, hint: 'High drainage, low bearing capacity' },
  { value: 'clay_black_mountain', label: 'Clay / Black Cotton', icon: Mountains, hint: 'High risk of expansion / cracking' },
  { value: 'loam', label: 'Loam / Standard', icon: CheckCircle, hint: 'Good stable balanced soil' },
  { value: 'rock', label: 'Rock', icon: Mountains, hint: 'Hard excavation needed' },
  { value: 'not_sure', label: 'Not Sure', icon: Question, hint: 'Safe, standard defaults' },
];

interface SiteConditionsSectionProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function SiteConditionsSection({ isCollapsed, onToggle }: SiteConditionsSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const handleToggle = onToggle || (() => setInternalCollapsed((prev) => !prev));
  const { projectDetails, updateProjectDetails } = useBoqWizardStore();

  const procedureNotes = useMemo(() => {
    if (!projectDetails.locationType) {
      return [];
    }

    return LOCATION_PROCEDURE_RULES.map((rule) => ({
      id: rule.id,
      label: rule.label,
      status: rule.statusByLocation[projectDetails.locationType as 'urban' | 'peri-urban' | 'rural'],
    }));
  }, [projectDetails.locationType]);

  const soilRisk = projectDetails.soilType ? SOIL_RISK_PROFILES[projectDetails.soilType] : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Site Conditions</h2>
          <p className="mt-1 text-sm text-slate-500">Capture geotechnical context and topography.</p>
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
          <div className="mb-2 rounded-xl bg-blue-50/50 p-4 border border-blue-100 flex items-start gap-3 text-blue-800 text-sm">
            <Question size={20} weight="fill" className="shrink-0 text-blue-500 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Not sure about these details?</p>
              <p className="text-xs text-blue-700">That&apos;s completely fine. Select &quot;Not Sure&quot; or a middle ground. We&apos;ll use safe defaults to ensure your estimate is reliable.</p>
            </div>
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-slate-700">What is the primary soil type on site?</label>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
              {SOIL_OPTIONS.map((option) => {
                const selected = projectDetails.soilType === option.value || (!projectDetails.soilType && option.value === 'not_sure');
                const Icon = option.icon;
                return (
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    key={option.value}
                    type="button"
                    onClick={() => updateProjectDetails({ soilType: option.value as SoilType })}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors shadow-sm ${selected
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                      }`}
                  >
                    <Icon size={24} className={selected ? 'text-blue-600' : 'text-slate-400'} weight={selected ? "duotone" : "regular"} />
                    <div>
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500 hidden sm:block">{option.hint}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {soilRisk && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">{soilRisk.label} risk profile</p>
              <p className="mt-1 text-xs text-amber-800">{soilRisk.warning}</p>
              <p className="mt-1 text-xs text-amber-800">{soilRisk.recommendation}</p>
            </div>
          )}

          <div className="pt-2">
            <label className="mb-3 block text-sm font-medium text-slate-700">Site Topography (Slope)</label>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              {SLOPE_OPTIONS.map((slope) => {
                const selected = projectDetails.siteSlope === slope.value;
                return (
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    key={slope.value}
                    type="button"
                    onClick={() => updateProjectDetails({ siteSlope: slope.value })}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors shadow-sm ${selected
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                      }`}
                  >
                    <div className={`w-full aspect-[4/3] rounded overflow-hidden mb-1 border transition-all ${selected ? 'border-blue-500 shadow-sm' : 'border-slate-100 opacity-80 group-hover:opacity-100'}`}>
                      <img src={slope.img} alt={slope.label} className="w-full h-full object-cover scale-110" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{slope.label}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">{slope.hint}</div>
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
