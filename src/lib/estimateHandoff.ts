export interface EstimateHandoff {
  name: string;
  location: string;
  type?: string | null;
  priority?: string | null;
}

export type ScanMethod = 'upload' | 'photo';

export function storeEstimateHandoff(method: ScanMethod, details: EstimateHandoff) {
  sessionStorage.setItem(`zimestimate_scan_${method}`, JSON.stringify(details));
}

export function readEstimateHandoff(method: ScanMethod): EstimateHandoff | null {
  try {
    const key = `zimestimate_scan_${method}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    sessionStorage.removeItem(key);
    return typeof value.name === 'string' && typeof value.location === 'string' ? value : null;
  } catch {
    return null;
  }
}
