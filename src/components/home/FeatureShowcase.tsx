'use client';

// "Everything after the estimate": the features people do not expect from an
// estimating site, one at a time, each with a small moving picture of what it
// does. Turns every few seconds; stops while the visitor points at it, has
// it focused, or has picked one themselves. Under prefers-reduced-motion it
// neither turns nor animates — a plain list with one picture at a time.
//
// The pictures are illustrations, not data: no names, prices or people that
// could be read as real records.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  ChartLineUp,
  CheckCircle,
  Circle,
  FilePdf,
  Package,
  PiggyBank,
  ShareNetwork,
  ShieldCheck,
  UsersThree,
} from '@phosphor-icons/react';
import styles from './FeatureShowcase.module.css';

type Feature = {
  id: string;
  title: string;
  blurb: string;
  action: string;
  href: string;
  icon: typeof UsersThree;
  picture: ReactNode;
};

const ROTATE_MS = 6000;

const FEATURES: Feature[] = [
  {
    id: 'invite',
    title: 'Invite your builder',
    blurb: 'Your builder ticks off stages, logs materials and sends site photos. You are told each time — and they never see your prices. Ideal when you are building from abroad.',
    action: 'Invite your builder',
    href: '/projects',
    icon: UsersThree,
    picture: (
      <div className={styles.feed}>
        <div className={`${styles.feedItem} ${styles.d1}`}><CheckCircle size={16} weight="fill" /> Foundation marked done</div>
        <div className={`${styles.feedItem} ${styles.d2}`}><Camera size={16} weight="fill" /> New site photo: trench dug
          <span className={styles.photo} aria-hidden="true" />
        </div>
        <div className={`${styles.feedItem} ${styles.d3}`}><Package size={16} weight="fill" /> 20 bags of cement used</div>
        <div className={`${styles.feedNote} ${styles.d4}`}>Prices stay with you</div>
      </div>
    ),
  },
  {
    id: 'usage',
    title: 'Track material usage',
    blurb: 'Log what goes into the build and see what is left of every material. Get a warning before something runs out.',
    action: 'Open your projects',
    href: '/projects',
    icon: Package,
    picture: (
      <div className={styles.usage}>
        {[['Cement', 'u1'], ['Bricks', 'u2'], ['River sand', 'u3']].map(([name, cls]) => (
          <div key={name} className={styles.usageRow}>
            <span>{name}</span>
            <div className={styles.usageBar}><span className={styles[cls]} /></div>
          </div>
        ))}
        <span className={`${styles.lowBadge} ${styles.d4}`}>Low stock: river sand</span>
      </div>
    ),
  },
  {
    id: 'budget',
    title: 'Plan and save for it',
    blurb: 'Set a limit and a date, and see how much to put aside each week or month — with a reminder when it is time.',
    action: 'Check your budget',
    href: '/quick-budget',
    icon: PiggyBank,
    picture: (
      <div className={styles.savings}>
        <div className={styles.savingsRing} aria-hidden="true"><span /></div>
        <div className={styles.savingsCopy}>
          <strong>Save every week</strong>
          <span>to reach your target on time</span>
          <span className={`${styles.reminder} ${styles.d3}`}>Reminder set ✓</span>
        </div>
      </div>
    ),
  },
  {
    id: 'prices',
    title: 'Compare prices, get quotes',
    blurb: 'See current material prices and ask suppliers to quote on your list. Check a quote you were given against the market.',
    action: 'See material prices',
    href: '/market-insights',
    icon: ChartLineUp,
    picture: (
      <div className={styles.quotes}>
        {[['q1', 'Quote 1'], ['q2', 'Quote 2'], ['q3', 'Quote 3']].map(([cls, label]) => (
          <div key={cls} className={styles.quoteRow}>
            <span>{label}</span>
            <div className={styles.quoteBar}><span className={styles[cls]} /></div>
          </div>
        ))}
        <span className={`${styles.bestBadge} ${styles.d4}`}>Lowest highlighted</span>
      </div>
    ),
  },
  {
    id: 'compliance',
    title: 'Permits and inspections',
    blurb: 'Every certificate and approval your build needs, stage by stage, so an inspection never holds up the work.',
    action: 'Start your BOQ',
    href: '/estimate',
    icon: ShieldCheck,
    picture: (
      <ul className={styles.checklist}>
        {['Approved site plan', 'Foundation inspection', 'Roof certificate', 'Occupation certificate'].map((item, i) => (
          <li key={item} className={styles[`c${i + 1}`]}>
            <span className={styles.tick} aria-hidden="true"><CheckCircle size={18} weight="fill" /></span>
            <span className={styles.untick} aria-hidden="true"><Circle size={18} /></span>
            {item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: 'share',
    title: 'Share a copy',
    blurb: 'Send the bill of quantities as a PDF or a view-only link to family, a bank or a builder — on WhatsApp, email or anywhere else.',
    action: 'Start your BOQ',
    href: '/estimate',
    icon: ShareNetwork,
    picture: (
      <div className={styles.share}>
        <div className={styles.pdf}><FilePdf size={34} weight="duotone" /><span>BOQ.pdf</span></div>
        <div className={`${styles.sendLine} ${styles.d2}`} aria-hidden="true" />
        <div className={`${styles.sent} ${styles.d3}`}><ShareNetwork size={16} weight="bold" /> Shared</div>
      </div>
    ),
  },
];

export default function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLElement>(null);
  const tabList = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    const timer = window.setTimeout(update, 0);
    query.addEventListener('change', update);
    return () => { window.clearTimeout(timer); query.removeEventListener('change', update); };
  }, []);

  // Only turn while someone can see it.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rotating = !reduced && !paused && !chosen && inView;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setActive((i) => (i + 1) % FEATURES.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, active]);

  // On a phone the list is a sideways row: keep the current one in sight.
  // Scrolls only the row, never the page.
  useEffect(() => {
    const list = tabList.current;
    const tab = list?.children[active] as HTMLElement | undefined;
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: Math.max(0, tab.offsetLeft - list.offsetLeft - 16), behavior: reduced ? 'auto' : 'smooth' });
  }, [active, reduced]);

  const feature = FEATURES[active];
  const Icon = feature.icon;

  return (
    <section
      ref={root}
      className={styles.showcase}
      aria-labelledby="showcase-heading"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>Everything after the estimate</span>
          <h2 id="showcase-heading">The estimate does not end at a PDF.</h2>
          <p>Run the build from the same project — even when you are building from abroad.</p>
        </div>

        <div className={styles.body}>
          <div ref={tabList} className={styles.tabs} role="tablist" aria-label="Features">
            {FEATURES.map((f, i) => {
              const TabIcon = f.icon;
              const selected = i === active;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  id={`feature-tab-${f.id}`}
                  aria-selected={selected}
                  aria-controls="feature-panel"
                  className={`${styles.tab} ${selected ? styles.tabActive : ''}`}
                  onClick={() => { setActive(i); setChosen(true); }}
                >
                  <TabIcon size={20} weight={selected ? 'fill' : 'duotone'} aria-hidden="true" />
                  <span>{f.title}</span>
                  {/* How long until the next one. */}
                  {selected && rotating && <span key={active} className={styles.timer} style={{ animationDuration: `${ROTATE_MS}ms` }} aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div id="feature-panel" role="tabpanel" aria-labelledby={`feature-tab-${feature.id}`} className={styles.panel}>
            {/* A new key restarts the picture's animation for each feature. */}
            <div key={feature.id} className={`${styles.picture} ${reduced ? styles.still : ''}`}>
              {feature.picture}
            </div>
            <div className={styles.copy}>
              <h3><Icon size={22} weight="duotone" aria-hidden="true" /> {feature.title}</h3>
              <p>{feature.blurb}</p>
              <Link href={feature.href} className={styles.action}>
                {feature.action} <ArrowRight size={15} weight="bold" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
