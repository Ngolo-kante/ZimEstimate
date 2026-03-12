'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Warning, CheckCircle, Question, Mountains, TrendUp, ArrowRight, Info } from '@phosphor-icons/react';
import { LOCATION_PROCEDURE_RULES, SOIL_RISK_PROFILES, type SoilType } from '@/lib/buildFlowRules';
import { useBoqWizardStore, type SiteSlopeType } from '@/store/boqWizardStore';

// ── Slope: icon-based (no photos) ─────────────────────────────────────────
const SLOPE_OPTIONS: Array<{
  value: SiteSlopeType;
  label: string;
  hint: string;
  Icon: typeof ArrowRight;
  rotate: string;
}> = [
  { value: 'flat',     label: 'Flat',     hint: 'Minimal leveling',         Icon: ArrowRight, rotate: 'rotate-0' },
  { value: 'gentle',   label: 'Gentle',   hint: 'Slight gradient',          Icon: ArrowRight, rotate: '-rotate-6' },
  { value: 'moderate', label: 'Moderate', hint: 'Noticeable slope',         Icon: ArrowRight, rotate: '-rotate-12' },
  { value: 'steep',    label: 'Steep',    hint: 'Retaining walls likely',   Icon: ArrowRight, rotate: '-rotate-[30deg]' },
];

const SOIL_OPTIONS: Array<{
  value: SoilType | 'not_sure';
  label: string;
  hint: string;
  risk: 'low' | 'medium' | 'high' | 'unknown';
}> = [
  { value: 'loam',               label: 'Loam / Standard',      hint: 'Stable, most common soil type',              risk: 'low' },
  { value: 'sandy',              label: 'Sandy',                 hint: 'Low bearing capacity, high drainage',         risk: 'medium' },
  { value: 'clay_black_mountain', label: 'Clay / Black Cotton', hint: 'Expands with moisture — crack risk',          risk: 'high' },
  { value: 'rock',               label: 'Rock',                  hint: 'Hard excavation, but very stable',            risk: 'medium' },
  { value: 'not_sure',           label: 'Not Sure',              hint: 'We\'ll use safe conservative defaults',       risk: 'unknown' },
];

const RISK_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  low:     { bg: 'bg-slate-100',   text: 'text-slate-600', label: 'Low risk' },
  medium:  { bg: 'bg-slate-100',   text: 'text-slate-600', label: 'Medium risk' },
  high:    { bg: 'bg-amber-100',   text: 'text-amber-700', label: 'High risk' },
  unknown: { bg: 'bg-slate-100',   text: 'text-slate-500', label: 'Default' },
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

      {/* Hint */}
      <div className="flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3.5 py-2.5">
        <Info size={15} weight="fill" className="shrink-0 mt-0.5 text-indigo-500" />
        <p className="text-xs text-indigo-700 leading-relaxed">Not sure about these details? Select the nearest option — we use conservative defaults to keep your estimate reliable.</p>
      </div>

      {/* ── Slope ──────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">What is the slope of the site?</h3>
          <p className="text-sm text-slate-500">Slope affects earthworks, fill volumes, and substructure complexity.</p>
        </div>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {SLOPE_OPTIONS.map((opt) => {
            const isSelected = projectDetails.siteSlope === opt.value;
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updateProjectDetails({ siteSlope: opt.value })}
                className={`flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-700 border-transparent text-white shadow-lg'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                {/* Slope angle icon illustration */}
                <div className={`relative flex h-10 w-10 items-center justify-center ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                  <opt.Icon
                    size={28}
                    weight="bold"
                    className={`${opt.rotate} transition-transform`}
                  />
                </div>
                <div>
                  <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>{opt.label}</div>
                  <div className={`mt-0.5 text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{opt.hint}</div>
                </div>
                {isSelected && (
                  <CheckCircle size={16} weight="fill" className="text-white opacity-80" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Soil ───────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">What type of soil is on site?</h3>
          <p className="text-sm text-slate-500">Soil type determines foundation depth, reinforcement, and excavation method.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SOIL_OPTIONS.map((opt) => {
            const isSelected = projectDetails.soilType === opt.value || (!projectDetails.soilType && opt.value === 'not_sure');
            const rb = RISK_BADGE[opt.risk];
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updateProjectDetails({ soilType: opt.value === 'not_sure' ? '' : opt.value })}
                className={`group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-700 border-transparent shadow-md'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                  isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {opt.value === 'not_sure'           ? <Question size={15} weight="bold" /> :
                   opt.value === 'loam'               ? <CheckCircle size={15} weight="bold" /> :
                   opt.value === 'rock'               ? <Mountains size={15} weight="bold" /> :
                   opt.value === 'clay_black_mountain'? <Warning size={15} weight="bold" /> :
                   <TrendUp size={15} weight="bold" />}
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-800'}`}>{opt.label}</div>
                  <div className={`mt-0.5 text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{opt.hint}</div>
                  <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    isSelected ? 'bg-white/20 text-white' : `${rb.bg} ${rb.text}`
                  }`}>
                    {rb.label}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* High-risk callout */}
        <AnimatePresence>
          {soilRisk && selectedSoil?.risk === 'high' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            >
              <Warning size={17} weight="fill" className="shrink-0 mt-0.5 text-amber-500" />
              <p>
                <strong>High-risk soil.</strong> Clay / Black Cotton soil expands and can crack foundations. 
                We recommend a geotechnical report before committing to a budget. Your estimate will include additional reinforcement allowances.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Regulatory notes */}
        {procedureNotes.length > 0 && (
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">Regulatory notes for your location</p>
            <div className="space-y-1.5">
              {procedureNotes.map((note) => (
                <div key={note.id} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    note.status === 'required' ? 'bg-indigo-600' : note.status === 'recommended' ? 'bg-indigo-400' : 'bg-indigo-200'
                  }`} />
                  <span>{note.label} — <em className={`${
                    note.status === 'required' ? 'text-indigo-700 font-semibold not-italic' :
                    note.status === 'recommended' ? 'text-indigo-500' : 'text-slate-400'
                  }`}>{note.status}</em></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
