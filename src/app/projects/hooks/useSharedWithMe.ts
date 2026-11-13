'use client';

import { useEffect, useState } from 'react';
import { getSiteProjects, getSiteQuickEstimates, type SiteProjectSummary, type SiteQuickSummary } from '@/lib/services/site';

/** Projects and quick estimates other people invited this person to (site view only). */
export function useSharedWithMe() {
    const [siteProjects, setSiteProjects] = useState<SiteProjectSummary[]>([]);
    const [siteQuick, setSiteQuick] = useState<SiteQuickSummary[]>([]);
    useEffect(() => {
        let active = true;
        void getSiteProjects().then((list) => { if (active) setSiteProjects(list); });
        void getSiteQuickEstimates().then((list) => { if (active) setSiteQuick(list); });
        return () => { active = false; };
    }, []);

    return { siteProjects, siteQuick };
}
