'use client';

// Share a copy of a quick estimate — the same sheet as a full project (see
// ShareSheet), plus the view-only link quick estimates already had
// (/estimate/<token>, migration 053).

import { useCallback, useEffect, useMemo, useState } from 'react';
import ShareSheet from '@/components/share/ShareSheet';
import { useToast } from '@/components/ui/Toast';
import { getQuickBOQ, startSharingQuickBOQ } from '@/lib/services/quickBoq';
import { loadPdfExport, PDF_LOAD_ERROR } from '@/lib/loadPdfExport';
import { projectShareSummary } from '@/lib/projects/shareSummary';
import { priceQuickEstimate } from '@/lib/quick-projects/engine/boqEngine';
import { getBrowserSiteUrl } from '@/lib/siteUrl';
import type { QuickBOQ } from '@/lib/quick-projects/engine/types';

interface QuickShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  quickId: string;
  name: string;
  typeLabel: string;
}

export default function QuickShareSheet({ isOpen, onClose, quickId, name, typeLabel }: QuickShareSheetProps) {
  const { error: showError } = useToast();
  const [boq, setBoq] = useState<QuickBOQ | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void getQuickBOQ(quickId).then(({ boq: loaded }) => { if (!cancelled) setBoq(loaded); });
    return () => { cancelled = true; };
  }, [isOpen, quickId]);

  const included = useMemo(
    () => boq ? priceQuickEstimate(boq.boqItems, boq.labor, boq.markupPct).quotedLines : [],
    [boq],
  );
  const location = (boq?.answers?.project_location as string) || null;

  const summary = useMemo(() => (boq
    ? projectShareSummary(
        { name, location },
        included.map((i) => ({ category: i.category, quantity: i.quantity, unit_price_usd: i.unitCostUsd, total_usd: i.totalCostUsd })),
        getBrowserSiteUrl(),
      )
    : null), [boq, included, name, location]);

  const source = useMemo(() => (boq ? { name, typeLabel, location, boqItems: boq.boqItems, labor: boq.labor, markupPct: boq.markupPct } : null), [boq, name, typeLabel, location]);

  const buildPdf = useCallback(async () => {
    const pdf = await loadPdfExport('saved_estimate');
    return pdf && source ? pdf.getQuickEstimatePDFBlob(source) : null;
  }, [source]);

  const downloadPdf = useCallback(async () => {
    const pdf = await loadPdfExport('saved_estimate');
    if (!pdf || !source) { showError(PDF_LOAD_ERROR); return; }
    const { error } = pdf.downloadQuickEstimatePDF(source);
    if (error) showError(error);
  }, [source, showError]);

  const getLink = useCallback(async () => {
    const { token } = await startSharingQuickBOQ(quickId);
    return token ? `${window.location.origin}/estimate/${token}` : null;
  }, [quickId]);

  return (
    <ShareSheet
      isOpen={isOpen}
      onClose={onClose}
      name={name}
      summary={summary}
      hasItems={included.length > 0}
      buildPdf={buildPdf}
      downloadPdf={downloadPdf}
      getLink={getLink}
    />
  );
}
