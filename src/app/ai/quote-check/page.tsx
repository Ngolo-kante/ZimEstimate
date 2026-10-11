import type { Metadata } from 'next';
import QuoteCheckClient from './QuoteCheckClient';

export const metadata: Metadata = {
  title: 'Check a builder’s quote | ZimEstimate',
  description: 'Photograph a builder’s or hardware quote and see each price against current Harare market prices.',
};

export default function QuoteCheckPage() {
  return <QuoteCheckClient />;
}
