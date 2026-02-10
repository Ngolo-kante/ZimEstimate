import { useEffect } from 'react';

type RevealOptions = {
  selector?: string;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  deps?: ReadonlyArray<unknown>;
};

export function useReveal({
  selector = '.reveal',
  threshold = 0.1,
  rootMargin = '0px 0px -50px 0px',
  once = false,
  deps = [],
}: RevealOptions = {}) {
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
  }, deps);
}
