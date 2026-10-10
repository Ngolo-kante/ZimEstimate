export const DOCUMENT_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';
export function validateDocumentFile(file: Pick<File, 'size' | 'type'>): string | null {
  if (!DOCUMENT_ACCEPT.split(',').includes(file.type)) return 'Choose a JPG, PNG, GIF, WEBP image or PDF.';
  if (file.size === 0) return 'This file is empty. Please choose another file.';
  if (file.size > 10 * 1024 * 1024) return 'This file is too large. Choose a file under 10 MB.';
  return null;
}
