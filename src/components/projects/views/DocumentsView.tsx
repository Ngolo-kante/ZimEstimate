'use client';

import DocumentsTab from '@/components/projects/DocumentsTab';

/** Plans, permits, receipts and site records. */
export default function DocumentsView({ projectId }: { projectId: string }) {
    return (
        <div className="view-panel space-y-6">
            <DocumentsTab projectId={projectId} />
        </div>
    );
}
