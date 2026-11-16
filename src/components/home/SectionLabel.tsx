'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A numbered section label ("01 · Start from what you have") that draws its
 * gold tick and slides in once, the first time it scrolls into view.
 *
 * Visible by default, so it reads fine before hydration or without JS. Only a
 * label still below the fold at mount is hidden ("waiting") and revealed when
 * it enters the viewport. Labels already on screen, and people who prefer
 * reduced motion, never animate.
 */
export default function SectionLabel({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<'idle' | 'waiting' | 'shown'>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    // Hide only after confirming it is off screen, then reveal on entry.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time setup from a DOM measurement
    setState('waiting');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setState('shown');
        observer.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={ref} className={className} data-reveal={state}>
      {children}
    </span>
  );
}
