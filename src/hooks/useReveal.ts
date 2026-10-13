import { useEffect } from 'react';

type RevealOptions = {
  selector?: string;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  deps?: ReadonlyArray<unknown>;
};

const serializeDep = (value: unknown): string => {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'object') {
    try {
      return `object:${JSON.stringify(value)}`;
    } catch {
      return `object:${Object.prototype.toString.call(value)}`;
    }
  }
  if (type === 'function') {
    return `function:${(value as { name?: string }).name || 'anonymous'}`;
  }
  return `${type}:${String(value)}`;
};

export function useReveal({
  selector = '.reveal',
  threshold = 0.1,
  rootMargin = '0px 0px -50px 0px',
  once = false,
  deps = [],
}: RevealOptions = {}) {
  const depsSignature = deps.map(serializeDep).join('|');

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll(selector));
    if (!elements.length) return;

    // A section is shown once `threshold` of it is on screen — or 120px of
    // it, for sections taller than the screen. A long price list (17,000px on
    // a phone) can never be 10% visible, so it used to stay at opacity 0.
    const enough = (entry: IntersectionObserverEntry) =>
      entry.isIntersecting && (entry.intersectionRatio >= threshold || entry.intersectionRect.height >= 120);

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (enough(entry)) {
            entry.target.classList.add('in-view');
            if (once) {
              obs.unobserve(entry.target);
            }
          }
        });
      },
      // Several steps, so tall sections are re-checked as they scroll in
      // rather than only when the single threshold is crossed.
      { threshold: [0, 0.01, 0.02, 0.05, threshold], rootMargin }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [selector, threshold, rootMargin, once, depsSignature]);
}
