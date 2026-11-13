'use client';

import UnifiedProcurementView from '@/components/projects/UnifiedProcurementView';
import type { Dispatch, SetStateAction } from 'react';
import type { PurchaseRecord, BOQItem, Project } from '@/lib/database.types';

export interface ProcurementViewProps {
    project: Project;
    purchases: PurchaseRecord[];
    setPurchases: Dispatch<SetStateAction<PurchaseRecord[]>>;
    materialItems: BOQItem[];
    onItemsRefresh: () => Promise<void>;
    selectedItemForPurchase: BOQItem | null;
    setSelectedItemForPurchase: (item: BOQItem | null) => void;
}

/** Buying and quotes for the project's materials. */
export default function ProcurementView({
    project,
    purchases,
    setPurchases,
    materialItems,
    onItemsRefresh,
    selectedItemForPurchase,
    setSelectedItemForPurchase,
}: ProcurementViewProps) {
    return (
        <div className="view-panel">
            <UnifiedProcurementView
                project={project}
                purchases={purchases}
                setPurchases={setPurchases}
                items={materialItems}
                onItemsRefresh={onItemsRefresh}
                selectedItemForPurchase={selectedItemForPurchase}
                onClearSelectedItem={() => setSelectedItemForPurchase(null)}
            />
        </div>
    );
}
