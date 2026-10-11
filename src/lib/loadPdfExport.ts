/**
 * Loads the PDF export code when someone actually exports.
 *
 * jsPDF is about 100 KB compressed, and it was downloaded with the Budget
 * Estimator, the BOQ wizard and the projects list on every first visit — on
 * expensive mobile data, for a button most visitors never press. It is now
 * fetched on click instead.
 *
 * Fetching on click can fail where loading with the page would have
 * succeeded: the signal drops between opening the page and pressing the
 * button, which is common here. So this returns null rather than throwing,
 * and every caller says so plainly instead of leaving a spinner running.
 */

import { captureProductEvent } from '@/lib/productAnalytics';

export const PDF_LOAD_ERROR = 'Could not load the PDF tool — check your connection and try again.';

/** Where the export was pressed, for analytics. */
export type PdfSurface = 'budget_estimator' | 'boq_wizard' | 'projects_list' | 'saved_estimate' | 'export_page' | 'analytics' | 'vision_takeoff';

export async function loadPdfExport(surface: PdfSurface) {
  try {
    const pdf = await import('@/lib/pdf-export');
    // Counted here because every export goes through this, and only once the
    // export can actually happen.
    captureProductEvent('pdf_exported', { surface });
    return pdf;
  } catch {
    return null;
  }
}
