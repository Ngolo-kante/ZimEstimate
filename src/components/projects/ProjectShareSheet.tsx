'use client';

// Share a copy of a full project — see ShareSheet. Giving a builder access to
// update it is a different thing, and lives under Invite (InviteModal).

import { useCallback, useEffect, useMemo, useState } from 'react';
import ShareSheet from '@/components/share/ShareSheet';
import { useToast } from '@/components/ui/Toast';
import { getBOQItems } from '@/lib/services/projects';
import { loadPdfExport, PDF_LOAD_ERROR } from '@/lib/loadPdfExport';
import { projectShareSummary } from '@/lib/projects/shareSummary';
import { getBrowserSiteUrl } from '@/lib/siteUrl';
import type { BOQItem, Project } from '@/lib/database.types';

interface ProjectShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  /** Pass when already loaded (the project page); fetched otherwise. */
  items?: BOQItem[];
}

export default function ProjectShareSheet({ isOpen, onClose, project, items: givenItems }: ProjectShareSheetProps) {
  const { error: showError } = useToast();
  const [loadedItems, setLoadedItems] = useState<BOQItem[] | null>(null);
  const items = givenItems ?? loadedItems;

  useEffect(() => {
    if (!isOpen || givenItems) return;
    let cancelled = false;
    void getBOQItems(project.id).then(({ items: fetched }) => { if (!cancelled) setLoadedItems(fetched); });
    return () => { cancelled = true; };
  }, [isOpen, givenItems, project.id]);

  const summary = useMemo(() => (items ? projectShareSummary(project, items, getBrowserSiteUrl()) : null), [items, project]);

  const buildPdf = useCallback(async () => {
    const pdf = await loadPdfExport('projects_list');
    return pdf && items ? pdf.getBOQPDFBlob(project, items) : null;
  }, [items, project]);

  const downloadPdf = useCallback(async () => {
    const pdf = await loadPdfExport('projects_list');
    if (pdf) pdf.downloadBOQPDF(project, items ?? []); else showError(PDF_LOAD_ERROR);
  }, [items, project, showError]);

  return (
    <ShareSheet
      isOpen={isOpen}
      onClose={onClose}
      name={project.name}
      summary={summary}
      hasItems={Boolean(items && items.length > 0)}
      buildPdf={buildPdf}
      downloadPdf={downloadPdf}
    />
  );
}
