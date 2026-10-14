// ─── Roof coverings, drawn as their profile ──────────────────────────────────
// What each sheet or tile looks like end-on, so the choice reads at a glance
// on a phone: box ribs for IBR, waves for corrugated, steps for QTile, a
// double roll for concrete tiles. No icon set has these.

import type { RoofCovering } from '@/lib/calculations/roofingOptions';

const PROFILES: Record<RoofCovering, { path: string; fill?: string }> = {
  ibr_05: { path: 'M2 22 H8 L10 14 H14 L16 22 H22 L24 14 H28 L30 22 H36 L38 14 H42 L44 22 H46' },
  chromadek_ibr: { path: 'M2 22 H8 L10 14 H14 L16 22 H22 L24 14 H28 L30 22 H36 L38 14 H42 L44 22 H46', fill: '#B91C1C' },
  corrugated: { path: 'M2 18 C5 12 8 12 11 18 S17 24 20 18 S26 12 29 18 S35 24 38 18 S44 12 46 16' },
  qtile: { path: 'M2 24 L2 14 L14 18 L14 10 L26 14 L26 6 L38 10 L38 2 L46 4' },
  concrete_tile: { path: 'M2 22 C2 14 12 14 12 22 C12 14 24 14 24 22 C24 14 36 14 36 22 C36 14 46 14 46 22' },
};

export default function RoofProfileIcon({ covering, className = 'h-6 w-12' }: { covering: RoofCovering; className?: string }) {
  const profile = PROFILES[covering] ?? PROFILES.ibr_05;
  return (
    <svg viewBox="0 0 48 28" aria-hidden="true" className={className} fill="none">
      <path d={profile.path} stroke={profile.fill ?? 'currentColor'} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
