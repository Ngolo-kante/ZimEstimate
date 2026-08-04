import { redirect } from 'next/navigation';

// This page returned the same hardcoded supplier quote — "Baines Building
// Supplies", 5,000 bricks — whatever you uploaded, behind a timed fake progress
// bar, and made no API call at all. Then it navigated to /boq/new with query
// parameters the builder does not read, so even the invented items were
// dropped. Someone scanning a real quote got a stranger's numbers back.
//
// The real thing lives at /ai/boq-scanner. Kept as a redirect rather than
// deleted because the hub linked here and the URL may be bookmarked.
export default function QuoteScannerPage() {
  redirect('/ai/boq-scanner');
}
