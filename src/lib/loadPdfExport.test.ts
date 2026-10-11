import { describe, expect, it } from 'vitest';
import { loadPdfExport } from './loadPdfExport';

describe('loading the PDF export on demand', () => {
  it('finds every export the pages call', async () => {
    // The pages now reach these through loadPdfExport() instead of a static
    // import, so a renamed or moved export would only fail on click.
    const pdf = await loadPdfExport('budget_estimator');
    expect(pdf).not.toBeNull();
    for (const name of ['exportBOQToPDF', 'downloadBOQPDF', 'printBOQPDF', 'downloadQuickEstimatePDF', 'downloadAnalyticsPDF'] as const) {
      expect(typeof pdf?.[name], name).toBe('function');
    }
  });
});
