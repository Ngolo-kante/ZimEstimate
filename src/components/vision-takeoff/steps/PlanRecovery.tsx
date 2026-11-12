'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowClockwise,
  ArrowRight,
  FilePdf,
  FolderOpen,
  PencilSimpleLine,
  Ruler,
  Toilet,
} from '@phosphor-icons/react';
import { recoveryActions, type PlanFailureCode, type RecoveryAction } from '@/lib/vision/planFailure';
import { isUsableFloorArea, MAX_FLOOR_AREA_M2, MIN_FLOOR_AREA_M2 } from '@/lib/vision/planFallback';
import type { PlanFailure } from '@/hooks/useVisionTakeoff';

/* A read that fails used to drop the person back at an empty upload box with
   one red sentence. This keeps their file in front of them and gives every
   failure a button that ends in a priced estimate: read it again, mark the
   rooms on the plan themselves, or type the floor area and carry on. */

interface PlanRecoveryProps {
  failure: PlanFailure;
  fileName: string;
  /** A picture of the plan, when there is one to show and to mark rooms on. */
  planImageUrl: string | null;
  onRetry: () => void;
  onChooseFile: () => void;
  onMarkRooms: () => void;
  onEnterArea: (floorAreaM2: number) => void;
}

const TITLES: Record<PlanFailureCode, string> = {
  busy: 'The plan reader is busy right now',
  timeout: 'Reading your plan took too long',
  network: 'Your plan did not upload',
  cancelled: 'Reading stopped',
  not_floor_plan: 'This is not the floor plan page',
  too_large: 'That file is too big to upload',
  unreadable: 'We could not make out the rooms',
  unavailable: 'The plan reader is not available right now',
};

/* Where the reader's own sentence would only repeat the heading or name a
   button that is now on the screen, a shorter line says what matters. */
const BODIES: Partial<Record<PlanFailureCode, string>> = {
  busy: 'Your file is safe. This usually clears within a minute.',
  timeout: 'Your file is safe. Check it is the page with the rooms, then read it again or carry on another way.',
  network: 'Check your connection. Your file is still here.',
  cancelled: 'Your file is still here.',
  unavailable: 'Trying again will not help just now. You can still get your estimate another way.',
  too_large: 'Export the plan at a smaller size, or send a screenshot of the floor plan page.',
  unreadable: 'The drawing may be too small or too faint to read. You can still get your estimate from it.',
};

export default function PlanRecovery({ failure, fileName, planImageUrl, onRetry, onChooseFile, onMarkRooms, onEnterArea }: PlanRecoveryProps) {
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const areaId = useId();
  const statedArea = failure.partial?.statedTotalAreaM2;
  const printedRooms = failure.partial?.rooms?.length ?? 0;
  const [area, setArea] = useState(statedArea ? String(statedArea) : '');
  const [areaError, setAreaError] = useState<string | null>(null);

  const { primary, others } = recoveryActions(failure.code, { sheet: failure.sheet, canShowPlan: planImageUrl !== null });
  const offered = [primary, ...others];

  const submitArea = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(area.replace(',', '.'));
    if (!isUsableFloorArea(value)) {
      setAreaError(`Enter the floor area in square metres, between ${MIN_FLOOR_AREA_M2} and ${MAX_FLOOR_AREA_M2.toLocaleString()}.`);
      return;
    }
    setAreaError(null);
    onEnterArea(value);
  };

  const chooseLabel = failure.code === 'not_floor_plan' ? 'Choose the floor plan page' : failure.code === 'too_large' ? 'Choose a smaller file' : 'Choose another file';

  const button = (action: RecoveryAction, isPrimary: boolean): ReactNode => {
    const className = `action ${isPrimary ? 'primary' : ''}`;
    switch (action) {
      case 'retry':
        return (
          <button key={action} type="button" className={className} onClick={onRetry}>
            <ArrowClockwise size={20} weight="bold" aria-hidden="true" />
            <span><strong>Try again</strong><small>Read the same file again.</small></span>
          </button>
        );
      case 'choose_file':
        return (
          <button key={action} type="button" className={className} onClick={onChooseFile}>
            <FolderOpen size={20} weight="bold" aria-hidden="true" />
            <span><strong>{chooseLabel}</strong><small>The page with the room names and sizes reads best.</small></span>
          </button>
        );
      case 'mark_rooms':
        return (
          <button key={action} type="button" className={className} onClick={onMarkRooms}>
            <PencilSimpleLine size={20} weight="bold" aria-hidden="true" />
            <span>
              <strong>Mark the rooms yourself</strong>
              <small>
                {printedRooms > 0
                  ? `Open your plan and add each room. ${printedRooms} ${printedRooms === 1 ? 'room' : 'rooms'} printed on it ${printedRooms === 1 ? 'is' : 'are'} already listed.`
                  : 'Open your plan, tap each room and type its size.'}
              </small>
            </span>
          </button>
        );
      case 'septic_estimate':
        return (
          <Link key={action} href="/quick-projects/septic" className={className}>
            <Toilet size={20} weight="bold" aria-hidden="true" />
            <span><strong>Estimate the septic tank</strong><small>A quick estimate for the tank on this drawing.</small></span>
          </Link>
        );
      default:
        return null;
    }
  };

  return (
    // The motion wrapper carries no styles: scoped styles only reach plain elements.
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
    <section className="plan-recovery" aria-labelledby={headingId}>
      <div className="file-row">
        {planImageUrl
          // The person's own file, from a blob URL: next/image has nothing to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={planImageUrl} alt="" className="thumb" />
          : <span className="thumb icon" aria-hidden="true"><FilePdf size={26} weight="light" /></span>}
        <div>
          <span className="file-label">Your file</span>
          <strong className="file-name">{fileName}</strong>
        </div>
      </div>

      <div role="alert">
        <h1 id={headingId}>{TITLES[failure.code]}</h1>
        <p className="body">{BODIES[failure.code] ?? failure.message}</p>
      </div>

      {/* Ways that keep this file first, then the floor area, then another file. */}
      <div className="actions">
        {offered.filter((action) => action !== 'enter_area' && (action === primary || action !== 'choose_file')).map((action) => button(action, action === primary))}
      </div>

      {offered.includes('enter_area') && (
        <form className={`area-form ${primary === 'enter_area' ? 'primary' : ''}`} onSubmit={submitArea} noValidate>
          <div className="area-heading">
            <Ruler size={20} weight="bold" aria-hidden="true" />
            <span><strong>Type the floor area</strong><small>The quickest way to a price. You can add rooms afterwards.</small></span>
          </div>
          <label htmlFor={areaId}>Floor area of the house (m²)</label>
          <div className="area-row">
            <input
              id={areaId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 120"
              value={area}
              onChange={(event) => { setArea(event.target.value); setAreaError(null); }}
              aria-invalid={areaError ? true : undefined}
              aria-describedby={areaError ? `${areaId}-error` : statedArea ? `${areaId}-note` : undefined}
            />
            <button type="submit" className="area-submit">Get my estimate <ArrowRight size={16} weight="bold" aria-hidden="true" /></button>
          </div>
          {statedArea && !areaError && <p id={`${areaId}-note`} className="area-note">{statedArea} m² was read from your plan. Please check it.</p>}
          {areaError && <p id={`${areaId}-error`} className="area-error" role="alert">{areaError}</p>}
        </form>
      )}

      {primary !== 'choose_file' && offered.includes('choose_file') && <div className="actions last">{button('choose_file', false)}</div>}

      <style jsx>{`
        .plan-recovery {
          max-width: 640px;
          margin: 0 auto;
          padding: 28px;
          border-radius: 20px;
          background: var(--color-surface);
          box-shadow: 0 0 0 1px rgba(226, 232, 240, 0.8), 0 10px 24px -12px rgba(15, 23, 42, 0.12);
        }

        .file-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-bottom: 20px;
          margin-bottom: 20px;
          border-bottom: 1px solid var(--color-border);
        }

        .thumb {
          flex: none;
          width: 64px;
          height: 64px;
          border-radius: 12px;
          border: 1px solid var(--color-border);
          background: var(--color-mist);
          object-fit: cover;
        }

        .thumb.icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-secondary);
        }

        .file-row > div {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .file-label {
          color: var(--color-text-secondary);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .file-name {
          overflow: hidden;
          color: var(--color-text);
          font-size: 0.9375rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        h1 {
          margin: 0 0 8px;
          color: var(--color-text);
          font-size: 1.375rem;
          font-weight: 700;
          line-height: 1.25;
        }

        .body {
          margin: 0 0 22px;
          color: var(--color-slate-light);
          font-size: 0.9375rem;
          line-height: 1.55;
        }

        .actions {
          display: grid;
          gap: 10px;
        }

        .actions.last {
          margin-top: 10px;
        }

        .plan-recovery :global(.action) {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          min-height: 60px;
          padding: 12px 16px;
          border: 1px solid var(--color-border-dark);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          color: var(--color-text);
          font: inherit;
          text-align: left;
          text-decoration: none;
          cursor: pointer;
          transition: border-color 0.15s ease, background-color 0.15s ease;
        }

        .plan-recovery :global(.action:hover) {
          border-color: var(--color-accent);
          background: var(--color-accent-muted);
        }

        .plan-recovery :global(.action:focus-visible),
        .area-submit:focus-visible,
        input:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .plan-recovery :global(.action.primary) {
          border-color: var(--color-primary);
          background: var(--color-primary);
          color: var(--color-text-inverse);
        }

        .plan-recovery :global(.action.primary:hover) {
          background: var(--color-primary-light);
        }

        .plan-recovery :global(.action span),
        .area-heading span {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .plan-recovery :global(.action strong),
        .area-heading strong {
          font-size: 0.9375rem;
          font-weight: 600;
        }

        .plan-recovery :global(.action small),
        .area-heading small {
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          line-height: 1.4;
        }

        .plan-recovery :global(.action.primary small) {
          color: rgba(255, 255, 255, 0.82);
        }

        .area-form {
          margin-top: 10px;
          padding: 16px;
          border: 1px solid var(--color-border-dark);
          border-radius: var(--radius-md);
        }

        .area-form.primary {
          border-color: var(--color-primary);
        }

        .area-heading {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 14px;
          color: var(--color-text);
        }

        label {
          display: block;
          margin-bottom: 6px;
          color: var(--color-text);
          font-size: 0.8125rem;
          font-weight: 600;
        }

        .area-row {
          display: flex;
          gap: 10px;
        }

        input {
          flex: 1;
          min-width: 0;
          height: 46px;
          padding: 0 14px;
          border: 1px solid var(--color-border-dark);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          color: var(--color-text);
          font: inherit;
          font-size: 1rem;
        }

        input[aria-invalid='true'] {
          border-color: var(--color-danger);
        }

        .area-submit {
          display: inline-flex;
          flex: none;
          align-items: center;
          gap: 8px;
          height: 46px;
          padding: 0 16px;
          border: 0;
          border-radius: var(--radius-md);
          background: var(--color-accent);
          color: var(--color-text-inverse);
          font: inherit;
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
        }

        .area-submit:hover {
          background: var(--color-accent-dark);
        }

        .area-note,
        .area-error {
          margin: 8px 0 0;
          font-size: 0.8125rem;
          line-height: 1.4;
        }

        .area-note {
          color: var(--color-text-secondary);
        }

        .area-error {
          color: var(--color-danger);
        }

        @media (max-width: 520px) {
          .plan-recovery {
            padding: 20px 16px;
          }

          h1 {
            font-size: 1.25rem;
          }

          .area-row {
            flex-direction: column;
          }

          .area-submit {
            justify-content: center;
          }
        }
      `}</style>
    </section>
    </motion.div>
  );
}
