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

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            if (once) {
              obs.unobserve(entry.target);
            }
          }
        });
      },
      { threshold, rootMargin }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [selector, threshold, rootMargin, once, depsSignature]);
}
