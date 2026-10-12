'use client';

import { useEffect, useRef, useState } from 'react';
import { DotsThree, X } from '@phosphor-icons/react';
import { PROJECT_NAV_ITEMS, type ProjectView } from './SidebarSpine';

const PRIMARY_VIEWS: ProjectView[] = ['overview', 'boq', 'budget', 'procurement'];
const MORE_VIEWS: ProjectView[] = ['usage', 'compliance', 'documents', 'settings'];

// One name per section on every device: the dock used "Buy" where the
// sidebar said "Procurement Hub".
const MOBILE_LABELS: Partial<Record<ProjectView, string>> = {};

const VIEW_DESCRIPTIONS: Partial<Record<ProjectView, string>> = {
  usage: 'Log materials used on site',
  compliance: 'Approvals, certificates and deadlines',
  documents: 'Plans, receipts and site records',
  settings: 'Stages, alerts and project details',
};

export default function ProjectViewTabs({
  activeView,
  onViewChange,
}: {
  activeView: ProjectView;
  onViewChange: (view: ProjectView) => void;
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isMoreActive = MORE_VIEWS.includes(activeView);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // A native modal dialog: showModal() moves focus inside, makes the page
  // behind inert, and Escape closes it. The old sheet only said
  // aria-modal="true" — focus stayed on More, behind it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isMoreOpen && !dialog.open) dialog.showModal();
    if (!isMoreOpen && dialog.open) dialog.close();
  }, [isMoreOpen]);

  // The sheet is phone-only; widening the window closes it rather than
  // leaving an invisible modal over the desktop layout.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 769px)');
    const onChange = () => { if (desktop.matches) setIsMoreOpen(false); };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  const selectView = (view: ProjectView) => {
    onViewChange(view);
    setIsMoreOpen(false);
  };

  return (
    <>
      <nav className="project-mobile-dock" aria-label="Project workspace">
        {PRIMARY_VIEWS.map((view) => {
          const item = PROJECT_NAV_ITEMS.find((candidate) => candidate.id === view)!;
          const isActive = activeView === view;
          return (
            <button
              key={view}
              type="button"
              className={`dock-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => selectView(view)}
            >
              <span className="dock-icon" aria-hidden="true">{item.icon}</span>
              <span>{MOBILE_LABELS[view] || item.short}</span>
            </button>
          );
        })}
        <button
          ref={moreButtonRef}
          type="button"
          className={`dock-item ${isMoreActive || isMoreOpen ? 'active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={isMoreOpen}
          aria-controls="project-more-sheet"
          aria-current={isMoreActive ? 'page' : undefined}
          aria-label={isMoreActive ? `More sections, on ${PROJECT_NAV_ITEMS.find((item) => item.id === activeView)?.label ?? 'this section'}` : 'More sections'}
          onClick={() => setIsMoreOpen((open) => !open)}
        >
          <span className="dock-icon" aria-hidden="true"><DotsThree size={21} weight="bold" /></span>
          <span>{isMoreActive ? (PROJECT_NAV_ITEMS.find((item) => item.id === activeView)?.short ?? 'More') : 'More'}</span>
        </button>
      </nav>

      <dialog
        ref={dialogRef}
        className="sheet-layer"
        id="project-more-sheet"
        aria-labelledby="project-more-title"
        onClose={() => {
          setIsMoreOpen(false);
          moreButtonRef.current?.focus();
        }}
        // A click on the dimmed area (the dialog itself, outside the sheet) closes it.
        onClick={(event) => { if (event.target === event.currentTarget) setIsMoreOpen(false); }}
      >
          <section className="more-sheet">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <div>
                <p>Project workspace</p>
                <h2 id="project-more-title">More tools</h2>
              </div>
              <button type="button" className="sheet-close" onClick={() => setIsMoreOpen(false)} aria-label="Close project tools">
                <X size={19} />
              </button>
            </div>
            <div className="sheet-list">
              {MORE_VIEWS.map((view) => {
                const item = PROJECT_NAV_ITEMS.find((candidate) => candidate.id === view)!;
                const isActive = activeView === view;
                return (
                  <button
                    key={view}
                    type="button"
                    className={`sheet-item ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => selectView(view)}
                  >
                    <span className="sheet-icon" aria-hidden="true">{item.icon}</span>
                    <span className="sheet-copy">
                      <strong>{item.short}</strong>
                      <small>{VIEW_DESCRIPTIONS[view]}</small>
                    </span>
                    {isActive && <span className="current-label">Current</span>}
                  </button>
                );
              })}
            </div>
          </section>
      </dialog>

      <style jsx>{`
        .project-mobile-dock,
        .sheet-layer {
          display: none;
        }

        @media (max-width: 768px) {
          .project-mobile-dock {
            position: fixed;
            z-index: 120;
            left: 0;
            right: 0;
            bottom: 0;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            min-height: 72px;
            padding: 6px 6px calc(6px + env(safe-area-inset-bottom, 0px));
            border-top: 1px solid #d8e0eb;
            background: rgba(255, 255, 255, 0.98);
            box-shadow: 0 -8px 24px rgba(11, 31, 59, 0.1);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
          }

          .dock-item {
            min-width: 0;
            min-height: 56px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 4px 1px;
            border: 0;
            border-radius: 7px;
            /* #475569 on white is 7.6:1; the old #748196 was 3.95:1 at 10px. */
            color: #475569;
            background: transparent;
            font: inherit;
            font-size: 0.7rem;
            font-weight: 650;
            cursor: pointer;
          }

          .dock-icon {
            width: 40px;
            height: 29px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid transparent;
            border-radius: 7px;
          }

          .dock-icon :global(svg) {
            width: 20px;
            height: 20px;
          }

          .dock-item.active {
            color: #0b1f3b;
            font-weight: 760;
          }

          .dock-item.active .dock-icon {
            color: #fff;
            border-color: #0b1f3b;
            background: #0b1f3b;
          }

          .dock-item:focus-visible,
          .sheet-item:focus-visible,
          .sheet-close:focus-visible {
            outline: 3px solid #2e6cf6;
            outline-offset: 1px;
          }

          .sheet-layer[open] {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            width: 100%;
            height: 100%;
            max-width: none;
            max-height: none;
            margin: 0;
            padding: 12px;
            border: 0;
            background: rgba(5, 18, 35, 0.46);
          }

          .sheet-layer::backdrop {
            background: transparent;
          }

          .more-sheet {
            width: min(100%, 520px);
            padding: 8px 12px calc(12px + env(safe-area-inset-bottom, 0px));
            border: 1px solid #d8e0eb;
            border-radius: 8px;
            background: #fff;
            box-shadow: 0 24px 60px rgba(5, 18, 35, 0.28);
            animation: sheet-in 180ms cubic-bezier(0.22, 1, 0.36, 1);
          }

          .sheet-handle {
            width: 42px;
            height: 4px;
            margin: 0 auto 8px;
            border-radius: 4px;
            background: #cbd5e1;
          }

          .sheet-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 6px 4px 12px;
            border-bottom: 1px solid #e6ebf2;
          }

          .sheet-header p,
          .sheet-header h2 {
            margin: 0;
            letter-spacing: 0;
          }

          .sheet-header p {
            color: #64748b;
            font-size: 0.67rem;
            font-weight: 750;
            text-transform: uppercase;
          }

          .sheet-header h2 {
            margin-top: 2px;
            color: #0b1f3b;
            font-size: 1.08rem;
          }

          .sheet-close {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #d8e0eb;
            border-radius: 7px;
            color: #526176;
            background: #fff;
          }

          .sheet-list {
            display: grid;
            gap: 4px;
            padding-top: 8px;
          }

          .sheet-item {
            width: 100%;
            min-height: 62px;
            display: grid;
            grid-template-columns: 40px minmax(0, 1fr) auto;
            align-items: center;
            gap: 11px;
            padding: 8px;
            border: 1px solid transparent;
            border-radius: 7px;
            color: #526176;
            background: transparent;
            text-align: left;
            font: inherit;
          }

          .sheet-item.active {
            border-color: #cfe0f3;
            color: #0b1f3b;
            background: #f2f6fa;
          }

          .sheet-icon {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 7px;
            color: #0b1f3b;
            background: #eaf0f7;
          }

          .sheet-copy {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .sheet-copy strong { font-size: 0.84rem; }
          .sheet-copy small { color: #748196; font-size: 0.7rem; line-height: 1.3; }
          .current-label { color: #2563eb; font-size: 0.66rem; font-weight: 750; }

          @keyframes sheet-in {
            from { opacity: 0; transform: translateY(18px); }
            to { opacity: 1; transform: translateY(0); }
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .more-sheet { animation: none; }
        }
      `}</style>
    </>
  );
}
