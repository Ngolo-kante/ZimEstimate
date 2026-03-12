'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Warning, CheckCircle, Question, Mountains, TrendUp, Info } from '@phosphor-icons/react';
import { LOCATION_PROCEDURE_RULES, SOIL_RISK_PROFILES, type SoilType } from '@/lib/buildFlowRules';
import { useBoqWizardStore, type SiteSlopeType } from '@/store/boqWizardStore';

const SLOPE_OPTIONS: Array<{ value: SiteSlopeType; label: string; hint: string; img: string; emoji: string }> = [
  { value: 'flat',     label: 'Flat',     hint: 'Minimal leveling',         img: '/topo-flat.webp',     emoji: '🟩' },
  { value: 'gentle',   label: 'Gentle',   hint: 'Slight gradient',          img: '/topo-gentle.webp',   emoji: '📐' },
  { value: 'moderate', label: 'Moderate', hint: 'Noticeable slope',         img: '/topo-moderate.webp', emoji: '⛰️' },
  { value: 'steep',    label: 'Steep',    hint: 'Retaining walls required', img: '/topo-steep.webp',    emoji: '🏔️' },
];

const SOIL_OPTIONS: Array<{ value: SoilType | 'not_sure'; label: string; hint: string; risk: 'low' | 'medium' | 'high' | 'unknown' }> = [
  { value: 'loam',              label: 'Loam / Standard',           hint: 'Good stable soil — most common',           risk: 'low' },
  { value: 'sandy',             label: 'Sandy',                     hint: 'Low bearing capacity, high drainage',       risk: 'medium' },
  { value: 'clay_black_mountain',label: 'Clay / Black Cotton',      hint: 'Expands with moisture, high crack risk',   risk: 'high' },
  { value: 'rock',              label: 'Rock',                      hint: 'Hard excavation needed, but very stable',   risk: 'medium' },
  { value: 'not_sure',          label: 'Not Sure',                  hint: 'We\'ll use safe conservative defaults',    risk: 'unknown' },
];

const RISK_COLORS = {
  low:     { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Low risk' },
  medium:  { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Medium risk' },
  high:    { bg: 'bg-red-100',     text: 'text-red-700',     label: 'High risk' },
  unknown: { bg: 'bg-slate-100',   text: 'text-slate-600',   label: 'Default' },
};

export default function SiteConditionsSection() {
  const { projectDetails, updateProjectDetails } = useBoqWizardStore();

  const procedureNotes = useMemo(() => {
    if (!projectDetails.locationType) return [];
    return LOCATION_PROCEDURE_RULES.map((rule) => ({
      id: rule.id,
      label: rule.label,
      status: rule.statusByLocation[projectDetails.locationType as 'urban' | 'peri-urban' | 'rural'],
    }));
  }, [projectDetails.locationType]);

  const soilRisk = projectDetails.soilType ? SOIL_RISK_PROFILES[projectDetails.soilType as SoilType] : null;
  const selectedSoil = SOIL_OPTIONS.find((s) => s.value === projectDetails.soilType);

  return (
    <div className="space-y-10">

      {/* ── Hint callout ───────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-800">
        <Info size={18} weight="fill" className="shrink-0 mt-0.5 text-blue-500" />
        <p><strong>Not sure about these details?</strong> That's completely fine — select "Not Sure" or the nearest option. We'll use safe, conservative defaults to keep your estimate reliable.</p>
      </div>

      {/* ── Site Slope ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">What's the slope of the site?</h3>
          <p className="text-sm text-slate-500">Slope affects excavation, fill, and substructure complexity.</p>
        </div>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {SLOPE_OPTIONS.map((opt) => {
            const isSelected = projectDetails.siteSlope === opt.value;
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updateProjectDetails({ siteSlope: opt.value })}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-400 ring-2 ring-blue-400/20 shadow-md'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-md'
                }`}
              >
                {/* Topo image */}
                <div className="relative h-20 w-full overflow-hidden bg-slate-100">
                  <img
                    src={opt.img}
                    alt={opt.label}
                    className="h-full w-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle weight="fill" size={18} className="text-white drop-shadow" />
                    </div>
                  )}
                </div>
                {/* Label */}
                <div className={`px-3 py-3 text-left ${isSelected ? 'bg-blue-50' : 'bg-white'}`}>
                  <div className={`text-sm font-semibold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{opt.label}</div>
                  <div className={`mt-0.5 text-xs ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>{opt.hint}</div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Soil Type ──────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">What type of soil is on site?</h3>
          <p className="text-sm text-slate-500">Soil type affects foundation depth, reinforcement requirements, and excavation methods.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SOIL_OPTIONS.map((opt) => {
            const isSelected = projectDetails.soilType === opt.value || (!projectDetails.soilType && opt.value === 'not_sure');
            const rc = RISK_COLORS[opt.risk];
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updateProjectDetails({ soilType: opt.value === 'not_sure' ? '' : opt.value })}
                className={`group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400/20'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                {isSelected && (
                  <CheckCircle weight="fill" size={16} className="absolute top-3 right-3 text-blue-500" />
                )}
                <div className={`mt-0.5 flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {opt.value === 'not_sure' ? <Question size={16} weight="bold" /> :
                   opt.value === 'loam' ? <CheckCircle size={16} weight="bold" /> :
                   opt.value === 'rock' ? <Mountains size={16} weight="bold" /> :
                   opt.value === 'sandy' ? <TrendUp size={16} weight="bold" /> :
                   <Warning size={16} weight="bold" />}
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{opt.label}</div>
                  <div className={`mt-0.5 text-xs ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>{opt.hint}</div>
                  <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${rc.bg} ${rc.text}`}>
                    {rc.label}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Reactive risk callout */}
        <AnimatePresence>
          {soilRisk && selectedSoil?.risk === 'high' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            >
              <Warning size={18} weight="fill" className="shrink-0 mt-0.5 text-amber-500" />
              <p>
                <strong>High-risk soil detected.</strong> Clay / Black Cotton soil can expand and crack foundations. 
                We recommend requesting a geotechnical report before pricing. Your estimate will include additional reinforcement allowances.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Procedure summary */}
        {procedureNotes.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Regulatory notes for your location</p>
            <div className="space-y-1.5">
              {procedureNotes.map((note) => (
                <div key={note.id} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    note.status === 'required' ? 'bg-red-400' : note.status === 'recommended' ? 'bg-amber-400' : 'bg-slate-300'
                  }`} />
                  <span>{note.label} — <em className="text-slate-500">{note.status}</em></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
