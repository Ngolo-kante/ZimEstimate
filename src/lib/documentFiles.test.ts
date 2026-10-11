import { describe, expect, it } from 'vitest';
import { validateDocumentFile } from './documentFiles';

describe('project document validation', () => {
  it('accepts supported photos and PDFs at the storage limit', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
      expect(validateDocumentFile({ type, size: 10 * 1024 * 1024 })).toBeNull();
    }
  });
  it('rejects empty, oversized and unsupported files before upload', () => {
    expect(validateDocumentFile({ type: 'application/pdf', size: 0 })).toMatch(/empty/);
    expect(validateDocumentFile({ type: 'image/jpeg', size: 10 * 1024 * 1024 + 1 })).toMatch(/too large/);
    expect(validateDocumentFile({ type: 'text/html', size: 100 })).toMatch(/Choose/);
  });
});
