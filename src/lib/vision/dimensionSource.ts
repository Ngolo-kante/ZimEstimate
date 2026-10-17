import type { DetectedRoom } from './types';

export function dimensionSourceLabel(source: DetectedRoom['dimensionSource']): string {
  switch (source) {
    case 'printed': return 'Printed dimension (scan)';
    case 'scaled': return 'Scaled from drawing';
    case 'estimated': return 'Estimated from layout';
    case 'user': return 'Entered by you';
    default: return 'Source unconfirmed';
  }
}

export function dimensionNeedsReview(source: DetectedRoom['dimensionSource']): boolean {
  return source !== 'printed' && source !== 'user';
}
