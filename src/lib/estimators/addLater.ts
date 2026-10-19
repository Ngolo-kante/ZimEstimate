import { laborSubstageFor } from '@/lib/calculations/laborSubstages';

/**
 * Parts of a house people often add after moving in. The quick budget leaves
 * them out of its headline unless ticked, so the first number someone sees is
 * what it takes to move in, not the full finish (owner's choice, 2026-10-19).
 * Floor tiles and ceilings stay in: the owner counts them as part of moving in.
 * The full BOQ is unchanged and prices everything.
 */
type BoqLine = { category: string; materialId: string; materialName: string; calculationNote?: string };

export const ADD_LATER_ITEMS = [
  {
    id: 'kitchen', label: 'Kitchen units',
    why: 'Start with a sink and worktop, and fit units later.',
    matches: (line: BoqLine) => line.materialId === 'kitchen-units',
  },
  {
    id: 'boundary', label: 'Boundary wall & gates',
    why: 'Many families move in first and build the wall over the next year or two.',
    matches: (line: BoqLine) => ['durawall-panel', 'durawall-post', 'gate-vehicle', 'gate-pedestrian'].includes(line.materialId),
  },
  {
    id: 'paving', label: 'Driveway & apron paving',
    why: 'A gravel driveway works for years.',
    matches: (line: BoqLine) => line.category === 'exterior' && laborSubstageFor(line) === 'paving',
  },
  {
    id: 'geyser', label: 'Geyser',
    why: 'Add an electric or solar geyser when you can.',
    matches: (line: BoqLine) => line.materialId === 'geyser-150',
  },
  {
    id: 'bath', label: 'Bath',
    why: 'A shower is enough to move in.',
    matches: (line: BoqLine) => line.materialId === 'bath-skirted' || line.materialId === 'mixer-bath',
  },
  {
    id: 'outside_paint', label: 'Outside paint',
    why: 'Plastered outside walls can wait for paint.',
    matches: (line: BoqLine) => line.materialId === 'paint-acrylic',
  },
] as const;

export type AddLaterId = (typeof ADD_LATER_ITEMS)[number]['id'];
export const ADD_LATER_IDS: AddLaterId[] = ADD_LATER_ITEMS.map((item) => item.id);

export function addLaterItemFor(line: BoqLine): AddLaterId | null {
  return ADD_LATER_ITEMS.find((item) => item.matches(line))?.id ?? null;
}

/** Ticked items as a link parameter (?add=kitchen,boundary), and back. */
export function addLaterFromParam(raw: string | null | undefined): AddLaterId[] {
  return (raw ?? '').split(',').filter((id): id is AddLaterId => (ADD_LATER_IDS as string[]).includes(id));
}
