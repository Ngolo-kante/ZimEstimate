import { redirect } from 'next/navigation';

// Quick estimates used to have their own list here, behind a third tab. My Work
// now shows them alongside full builds, so this page had nothing left to list —
// but it was still reachable, and still rendered its own three-tab sub-nav in a
// different order to every other page. Saving a quick estimate landed here, so
// the tabs visibly changed depending on which builder you had come from.
//
// Kept as a redirect rather than deleted: saved links and the post-save
// redirect both pointed here, and a 404 is a worse answer than the list.
export default function QuickBOQsPage() {
  redirect('/projects');
}
