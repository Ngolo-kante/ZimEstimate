import { redirect } from 'next/navigation';

// "Price Outlook" showed 1–12 month price predictions with confidence scores,
// all typed into the page by hand — no model, no data behind them. Presenting
// invented forecasts as an outlook is worse than having none. Market Insights
// shows the prices we actually observe; the URL redirects there in case it
// was bookmarked or shared.
export default function PriceOutlookPage() {
  redirect('/market-insights');
}
