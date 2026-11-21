import { House, PaintBrush, Plug, Tree, Wall, Warehouse, type Icon } from '@phosphor-icons/react';
import type { BOQCategory } from '@/lib/database.types';

export const constructionStageIcons: Record<BOQCategory, Icon> = {
    substructure: Warehouse,
    superstructure: Wall,
    roofing: House,
    finishing: PaintBrush,
    services: Plug,
    exterior: Tree,
};
