'use client';

import { useEffect, useRef } from 'react';
import { PROJECT_NAV_ITEMS, type ProjectView } from './SidebarSpine';

/**
 * Mobile navigation between a project's views.
 *
 * Replaces a floating action button that opened an off-canvas drawer. That
 * button sat at y732-788 while the global bottom navigation occupied y740-812
 * with the same z-index, so ~48px of the 56px control was underneath the nav
 * bar: tapping what looked like the project menu actually hit the bottom bar's
 * "Home" link and navigated out of the project. Every view behind the drawer —
 * Budget Planner, Documents, Configurations — was unreachable on a phone.
 *
 * A visible strip is also the better pattern regardless of that bug. The views
 * are discoverable without knowing to open anything, each is one tap rather
 * than two, and nothing overlaps the global navigation.
 */
export default function ProjectViewTabs({
  activeView,
  onViewChange,
}: {
  activeView: ProjectView;
  onViewChange: (view: ProjectView) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the current view on screen. Without this, opening a project deep in
  // the list (Documents, Configurations) shows a strip that appears to start at
  // "Overview", giving no sign of where you actually are.
  useEffect(() => {
    const el = activeRef.current;
    const list = listRef.current;
    if (!el || !list) return;

    const elBox = el.getBoundingClientRect();
    const listBox = list.getBoundingClientRect();
    if (elBox.left < listBox.left || elBox.right > listBox.right) {
      list.scrollTo({
        left: el.offsetLeft - list.clientWidth / 2 + el.clientWidth / 2,
        behavior: 'smooth',
      });
    }
  }, [activeView]);

  return (
    <>
      <div className="project-view-tabs">
        <div className="tabs-scroll" ref={listRef} role="tablist" aria-label="Project views">
          {PROJECT_NAV_ITEMS.map((item) => {
            const isActive = item.id === activeView;
            return (
              <button
                key={item.id}
                ref={isActive ? activeRef : undefined}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`view-tab ${isActive ? 'active' : ''}`}
                onClick={() => onViewChange(item.id)}
              >
                <span className="tab-icon" aria-hidden="true">{item.icon}</span>
                <span className="tab-label">{item.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .project-view-tabs {
          display: none;
        }

        @media (max-width: 768px) {
          .project-view-tabs {
            display: block;
            position: sticky;
            /* Clears the app header so the strip stays reachable while the
               long BOQ and usage lists scroll underneath it. */
            top: 56px;
            z-index: 30;
            margin: 0 -12px 14px;
            padding: 8px 0 0;
            background: var(--color-background, #f8fafc);
            border-bottom: 1px solid var(--color-border, #e2e8f0);
          }

          .tabs-scroll {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            scroll-snap-type: x proximity;
            padding: 0 12px 8px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }

          .tabs-scroll::-webkit-scrollbar {
            display: none;
          }

          .view-tab {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            flex: 0 0 auto;
            scroll-snap-align: center;
            /* 44px tall: the minimum comfortable touch target. */
            min-height: 44px;
            padding: 0 14px;
            border: 1px solid var(--color-border, #e2e8f0);
            border-radius: 999px;
            background: var(--color-surface, #fff);
            color: var(--color-text-secondary, #64748b);
            font: inherit;
            font-size: 0.8125rem;
            font-weight: 600;
            white-space: nowrap;
            cursor: pointer;
            transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
          }

          .view-tab :global(svg) {
            width: 16px;
            height: 16px;
          }

          .view-tab.active {
            background: var(--color-primary, #0B1F3B);
            border-color: var(--color-primary, #0B1F3B);
            color: #fff;
          }

          .view-tab:focus-visible {
            outline: 3px solid var(--color-accent, #2E6CF6);
            outline-offset: 2px;
          }

          @media (prefers-reduced-motion: reduce) {
            .view-tab {
              transition: none;
            }
          }
        }
      `}</style>
    </>
  );
}
