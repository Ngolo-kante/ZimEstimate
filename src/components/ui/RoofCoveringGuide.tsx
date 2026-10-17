import RoofProfileIcon from '@/components/ui/RoofProfileIcon';
import { ROOF_COVERINGS, type RoofCovering } from '@/lib/calculations/roofingOptions';

const coverings = Object.entries(ROOF_COVERINGS) as [RoofCovering, (typeof ROOF_COVERINGS)[RoofCovering]][];

export default function RoofCoveringGuide() {
  return (
    <details className="mt-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-slate-800">
      <summary className="cursor-pointer text-sm font-semibold text-sky-900">See pictures of the roof coverings</summary>
      <p className="mt-2 text-xs text-slate-600">Illustrated cross-sections show the profile of each covering. Colour and dimensions vary by supplier; confirm your choice with a sample or product sheet.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {coverings.map(([id, option]) => (
          <figure key={id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex h-24 items-center justify-center rounded-md bg-gradient-to-b from-sky-50 to-slate-100 text-slate-700" role="img" aria-label={`${option.label} profile illustration`}>
              <RoofProfileIcon covering={id} className="h-20 w-40" />
            </div>
            <figcaption className="mt-2 text-xs font-semibold text-slate-900">{option.label}</figcaption>
            <p className="mt-1 text-xs text-slate-600">{option.description}</p>
          </figure>
        ))}
      </div>
    </details>
  );
}
