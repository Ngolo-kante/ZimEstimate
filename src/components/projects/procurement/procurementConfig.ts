import type { BOQStage, ProcurementItemStatus } from '@/lib/projects/procurement';
import { Check, Clock, Cube, House, Package, PaintBrush, Plug, Tree, Wall, Warning } from '@phosphor-icons/react';

// Consistent naming with BOQ wizard milestones
export const STAGE_CONFIG: Record<BOQStage, { label: string; icon: typeof Cube; color: string; description: string }> = {
  substructure: {
    label: 'Site Preparation & Foundation',
    icon: Cube,
    color: 'var(--color-accent)',
    description: 'Foundation, DPC, floor slab'
  },
  superstructure: {
    label: 'Structural Walls & Frame',
    icon: Wall,
    color: 'var(--color-accent)',
    description: 'Walls, lintels, ring beam'
  },
  roofing: {
    label: 'Roofing',
    icon: House,
    color: 'var(--color-primary)',
    description: 'Timber, sheets, gutters'
  },
  finishing: {
    label: 'Interior & Finishing',
    icon: PaintBrush,
    color: 'var(--color-accent)',
    description: 'Plastering, painting, doors and windows'
  },
  services: {
    label: 'Plumbing & Electrical',
    icon: Plug,
    color: 'var(--color-accent)',
    description: 'Pipes, sanitaryware, wiring and fittings'
  },
  exterior: {
    label: 'External Work',
    icon: Tree,
    color: 'var(--color-primary-light)',
    description: 'Boundary, gates, driveway'
  },
};

export const getStatusConfig = (status: ProcurementItemStatus) => {
  switch (status) {
    case 'pending':
      return { label: 'Pending', icon: Clock, bgClass: 'status-pending' };
    case 'in_progress':
      return { label: 'In Progress', icon: Package, bgClass: 'status-progress' };
    case 'purchased':
      return { label: 'Purchased', icon: Check, bgClass: 'status-purchased' };
    case 'over_purchased':
      return { label: 'Over Purchased', icon: Warning, bgClass: 'status-over' };
  }
};
