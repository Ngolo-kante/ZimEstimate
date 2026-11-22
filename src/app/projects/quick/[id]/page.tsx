'use client';

import { formatUsd } from '@/lib/format';

// ─── Saved quick estimate ─────────────────────────────────────────────────────
// The BOQ for one saved quick estimate.
//
// Until this route existed there was nowhere to open a saved estimate. The card
// in My Work pointed at the quick list page, that page ignored the id entirely,
// and its own cards pushed users to /quick-projects/{type} — a blank form. So
// the only way to see work you had saved was to key it in again, and
// getQuickBOQ sat in the service layer with no callers at all.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProjectBreadcrumb from '@/components/projects/ProjectBreadcrumb';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Card from '@/components/ui/Card';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { priceQuickEstimate } from '@/lib/quick-projects/engine/boqEngine';
import QuickBOQTable from '@/components/quick-projects/QuickBOQTable';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  getQuickBOQ,
  stopSharingQuickBOQ,
  updateQuickBOQ,
  persistQuickBOQSession,
} from '@/lib/services/quickBoq';
import {
  listQuickQuotes,
  summariseQuotes,
  createQuickQuoteRequest,
  type QuoteSummary,
} from '@/lib/services/quickQuotes';
import BudgetPlanCard from '@/components/quick-projects/BudgetPlanCard';
import ComplianceCard from '@/components/quick-projects/ComplianceCard';
import NextStepsCard from '@/components/quick-projects/NextStepsCard';
import type { ComplianceStatus } from '@/lib/quick-projects/compliance';
import { QUICK_TYPE_LABELS } from '@/lib/services/savedWork';
import QuickShareSheet from '@/components/projects/QuickShareSheet';
import InviteModal from '@/components/projects/InviteModal';
import SiteView from '@/components/projects/SiteView';
import { getSiteAccess, type SiteAccess } from '@/lib/services/site';
import { estimateName as estimateNameFor } from '@/lib/quick-projects/savedEstimate';
import type { BOQItem, LaborConfig, QuickBOQ } from '@/lib/quick-projects/engine/types';
import { PencilSimple, ShareNetwork, Download, UserPlus, Warning } from '@phosphor-icons/react';
import { loadPdfExport, PDF_LOAD_ERROR } from '@/lib/loadPdfExport';
import { captureProductEvent } from '@/lib/productAnalytics';

// Shared with the public view of a shared estimate, so both name it the same.
const estimateName = (boq: QuickBOQ) => estimateNameFor(boq.projectType, boq.answers);

function SavedQuickEstimate() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { success, error: showError } = useToast();

  const [boq, setBoq] = useState<QuickBOQ | null>(null);
  const [labor, setLabor] = useState<LaborConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Null until loaded, so "Waiting on 2 suppliers" is never rendered as a
  // confident zero while the request is still in flight.
  const [quotes, setQuotes] = useState<QuoteSummary | null>(null);
  const [requestingQuotes, setRequestingQuotes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { boq: found, error } = await getQuickBOQ(id);
      if (cancelled) return;
      if (error || !found) {
        setNotFound(true);
      } else {
        setBoq(found);
        setLabor(found.labor);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Separate from the BOQ load: quotes are secondary, and a failure to read
  // them should not stop the estimate itself from opening.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { requests, error } = await listQuickQuotes(id);
      if (cancelled || error) return;
      setQuotes(summariseQuotes(requests));
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const total = useMemo(() => {
    if (!boq) return 0;
    return priceQuickEstimate(boq.boqItems, boq.labor, boq.markupPct).totals.grandTotalUsd;
  }, [boq]);

  // Saving here means updating what is already stored, not creating a second
  // copy — the estimate keeps its id, so the card in My Work stays the card
  // the user came in through.
  const handleSave = useCallback(
    async (items: BOQItem[], markupPct: number) => {
      if (!boq || !labor) return;
      const { error } = await updateQuickBOQ(boq.id, { boqItems: items, labor, markupPct });
      if (error) {
        showError(error.message || 'Could not save your changes.');
        return;
      }
      setBoq({ ...boq, boqItems: items, labor, markupPct });
      success('Changes saved.');
    },
    [boq, labor, showError, success],
  );

  const handlePlanSave = useCallback(
    async (patch: { targetDate: string | null; fundsSavedUsd: number }) => {
      if (!boq) return;
      const { error } = await updateQuickBOQ(boq.id, patch);
      if (error) {
        showError('Could not save your plan.');
        return;
      }
      setBoq({ ...boq, targetDate: patch.targetDate, fundsSavedUsd: patch.fundsSavedUsd });
      success('Plan saved.');
    },
    [boq, showError, success],
  );

  // Optimistic: a dropdown that waits on a round trip before showing the value
  // you picked feels broken. Reverted on failure so the UI never claims a
  // status the database does not hold.
  const handleComplianceChange = useCallback(
    async (reqId: string, status: ComplianceStatus) => {
      if (!boq) return;
      const previous = boq.compliance;
      const next = { ...previous, [reqId]: status };
      setBoq({ ...boq, compliance: next });

      const { error } = await updateQuickBOQ(boq.id, { compliance: next });
      if (error) {
        setBoq((current) => (current ? { ...current, compliance: previous } : current));
        showError('Could not save that change.');
      }
    },
    [boq, showError],
  );

  const handleRequestQuotes = useCallback(async () => {
    if (!boq) return;
    setRequestingQuotes(true);
    const { error } = await createQuickQuoteRequest(boq.id, boq.boqItems);
    if (error) {
      showError(error.message || 'Could not send the request.');
    } else {
      const { requests } = await listQuickQuotes(boq.id);
      setQuotes(summariseQuotes(requests));
      success('Request sent. Suppliers will be notified.');
    }
    setRequestingQuotes(false);
  }, [boq, showError, success]);

  // Reopens the wizard with these answers filled in. Routed through the same
  // session mechanism the sign-in bounce uses, so there is one restore path
  // rather than two that can drift apart.
  const handleEditInputs = useCallback(() => {
    if (!boq) return;
    persistQuickBOQSession({
      projectType: boq.projectType,
      answers: boq.answers as unknown as Record<string, unknown>,
      // Empty on purpose: an item list would send the wizard straight to the
      // finished BOQ, and the point of this button is to reach the questions.
      boqItems: [],
      labor: boq.labor,
      markupPct: boq.markupPct ?? 0,
      currency: boq.currency ?? 'USD',
    });
    router.push(`/quick-projects/${boq.projectType}`);
  }, [boq, router]);

  // Shared with the card menu in My Work via downloadQuickEstimatePDF, so the
  // PDF from either place is generated the same way rather than two functions
  // quietly drifting apart.
  const handleDownloadPdf = useCallback(async () => {
    if (!boq) return;
    const pdf = await loadPdfExport('saved_estimate');
    if (!pdf) {
      showError(PDF_LOAD_ERROR);
      return;
    }
    const { error } = pdf.downloadQuickEstimatePDF({
      name: estimateName(boq),
      typeLabel: QUICK_TYPE_LABELS[boq.projectType] ?? boq.projectType,
      location: (boq.answers?.project_location as string) || null,
      boqItems: boq.boqItems,
      markupPct: boq.markupPct,
      labor: boq.labor,
    });
    if (error) showError(error);
  }, [boq, showError]);

  // The same "Share a copy" sheet as the card menu and full projects: PDF,
  // summary, and the view-only link (/estimate/<token>), which it creates on
  // request. Re-read on close so "Stop sharing" appears once a link exists.
  const [shareOpen, setShareOpen] = useState(false);
  // Invite gives access (an installer reports progress); Share sends a copy.
  const [inviteOpen, setInviteOpen] = useState(false);
  const handleShare = useCallback(() => {
    if (!boq) return;
    setShareOpen(true);
    captureProductEvent('estimate_shared', { estimate: `saved_${boq.projectType}`, method: 'share_sheet' });
  }, [boq]);
  const closeShare = useCallback(async () => {
    setShareOpen(false);
    if (!boq) return;
    const { boq: fresh } = await getQuickBOQ(boq.id);
    if (fresh && fresh.shareToken !== boq.shareToken) setBoq({ ...boq, shareToken: fresh.shareToken });
  }, [boq]);

  const handleStopSharing = useCallback(async () => {
    if (!boq) return;
    const { error } = await stopSharingQuickBOQ(boq.id);
    if (error) {
      showError('Could not stop sharing — check your connection and try again.');
      return;
    }
    setBoq({ ...boq, shareToken: null });
    success('Sharing stopped. The old link no longer opens this estimate.');
  }, [boq, success, showError]);

  if (isLoading) {
    return (
      <div className="wrap">
        <div className="skeleton-head" />
        <div className="skeleton-body" />
        <style jsx>{`
          .wrap { max-width: 1000px; margin: 0 auto; padding: 32px 24px; }
          .skeleton-head { height: 72px; border-radius: 12px; background: var(--color-border); margin-bottom: 16px; }
          .skeleton-body { height: 320px; border-radius: 12px; background: var(--color-background); }
        `}</style>
      </div>
    );
  }

  if (notFound || !boq || !labor) {
    return (
      <div className="wrap">
        <Card>
          <div className="empty">
            <Warning size={40} weight="duotone" />
            <h2>We could not open that estimate</h2>
            <p>It may have been deleted, or it belongs to another account.</p>
            <Link href="/projects" className="back-link">My projects</Link>
          </div>
        </Card>
        <style jsx>{`
          .wrap { max-width: 1000px; margin: 0 auto; padding: 32px 24px; }
          .empty { padding: 56px 24px; text-align: center; color: var(--color-text-secondary); }
          .empty h2 { font-size: 1.125rem; font-weight: 600; color: var(--color-text); margin: 12px 0 6px; }
          .back-link {
            display: inline-block; margin-top: 20px; padding: 10px 18px; border-radius: 8px;
            background: var(--color-accent); color: #fff; font-weight: 600; font-size: 0.9rem; text-decoration: none;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="wrap">
      <ProjectBreadcrumb name={estimateName(boq)} />

      <header className="head">
        <div className="head-text">
          <span className="type-chip">{QUICK_TYPE_LABELS[boq.projectType] ?? 'Quick'}</span>
          <h1>{estimateName(boq)}</h1>
          <p className="meta">
            Saved {new Date(boq.updatedAt || boq.createdAt).toLocaleDateString('en-ZW', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
            {' · '}
            {formatUsd(total, { wholeDollars: true })}
          </p>
          {boq.shareToken && (
            <p className="sharing-note mt-1 text-xs text-[var(--color-text-secondary)]">
              Shared — anyone with the link can view the estimate (not your savings, dates or checklist).{' '}
              <button
                type="button"
                onClick={handleStopSharing}
                className="font-semibold text-[var(--color-accent)] underline underline-offset-2"
              >
                Stop sharing
              </button>
            </p>
          )}
        </div>

        {/* Icons carry these on a phone; the labels return once there is room. */}
        <div className="actions">
          {/* Named for screen readers too: on phones the words are hidden and
              the buttons used to be announced as nothing at all. */}
          <button type="button" onClick={handleEditInputs} className="act" aria-label="Edit inputs">
            <PencilSimple size={16} weight="bold" aria-hidden="true" /><span>Edit inputs</span>
          </button>
          <button type="button" onClick={handleShare} className="act" aria-label="Share a copy">
            <ShareNetwork size={16} weight="bold" aria-hidden="true" /><span>Share</span>
          </button>
          <button type="button" onClick={() => setInviteOpen(true)} className="act" aria-label="Invite people">
            <UserPlus size={16} weight="bold" aria-hidden="true" /><span>Invite</span>
          </button>
          <button type="button" onClick={handleDownloadPdf} className="act" aria-label="Download BOQ PDF">
            <Download size={16} weight="bold" aria-hidden="true" /><span>PDF</span>
          </button>
        </div>
      </header>

      {/* The estimate is the project surface. No stages, no workspace — the
          user was explicit that neither applies to a borehole — but everything
          that does travel: what it costs, what to put aside, what it has to
          clear legally, who can price or build it, and (On site) the job's
          steps, photos and materials used, which an invited installer updates. */}
      <BudgetPlanCard
        totalUsd={total}
        targetDate={boq.targetDate}
        fundsSavedUsd={boq.fundsSavedUsd}
        onSave={handlePlanSave}
      />

      <NextStepsCard
        projectType={boq.projectType}
        area={(boq.answers?.project_location as string) || undefined}
        quoteSummary={quotes}
        onRequestQuotes={() => void handleRequestQuotes()}
        requestingQuotes={requestingQuotes}
      />

      {/* Steps, photos and materials used — what an invited installer
          updates, and what the owner follows. */}
      <SiteView target={{ kind: 'quick', id: boq.id }} embedded onInvite={() => setInviteOpen(true)} />

      <ComplianceCard
        projectType={boq.projectType}
        answers={boq.answers as unknown as Record<string, unknown>}
        statuses={boq.compliance as Record<string, ComplianceStatus>}
        onChange={(reqId, status) => void handleComplianceChange(reqId, status)}
      />

      <QuickBOQTable
        projectType={boq.projectType}
        initialItems={boq.boqItems}
        initialMarkupPct={boq.markupPct}
        labor={labor}
        onLaborChange={setLabor}
        isContractor={profile?.user_type === 'contractor'}
        answers={boq.answers as unknown as Record<string, unknown>}
        returnTo={`/projects/quick/${boq.id}`}
        onSave={handleSave}
      />

      <style jsx>{`
        .wrap { max-width: 1000px; margin: 0 auto; padding: 32px 24px; }
        .head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; flex-wrap: wrap; margin-bottom: 24px;
        }
        .type-chip {
          display: inline-block; padding: 3px 10px; border-radius: 999px; margin-bottom: 8px;
          background: var(--color-accent-muted); color: var(--color-accent);
          font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
        }
        .head h1 { font-size: 1.5rem; font-weight: 700; color: var(--color-text); margin: 0; }
        .meta { font-size: 0.875rem; color: var(--color-text-secondary); margin-top: 4px; }
        .actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .act {
          min-height: 44px;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 9px 14px; border-radius: 8px; cursor: pointer;
          border: 1px solid var(--color-border); background: var(--color-surface);
          color: var(--color-text); font-size: 0.85rem; font-weight: 600;
          transition: none;
        }
        @media (hover: hover) and (pointer: fine) { .act:hover { border-color: var(--color-accent); color: var(--color-accent); } }

        @media (max-width: 640px) {
          .wrap {
            margin-inline: -24px;
            padding: 20px 16px;
          }
          .head { gap: 12px; }
          .head h1 { color: white; }
          .meta, .sharing-note { color: var(--color-muted-on-navy); }
          .sharing-note button { color: var(--color-link-on-navy); }
          .type-chip { background: var(--color-selected-surface); color: var(--color-selected-ink); }
          .wrap > :global(nav[aria-label="Breadcrumb"]) { color: var(--color-muted-on-navy); }
          .wrap > :global(nav[aria-label="Breadcrumb"] a:focus-visible),
          .act:focus-visible, .sharing-note button:focus-visible {
            outline: 2px solid var(--color-gold-on-navy);
            outline-offset: 3px;
          }
          .actions { width: 100%; }
          /* Equal share of the row, icon only — four words across a 360px
             screen wrapped onto three lines and pushed the BOQ below the fold. */
          .act { flex: 1; padding: 11px 8px; }
          .act :global(svg) { color: var(--color-gold-ink); }
          .act span { display: none; }
        }
      `}</style>

      <InviteModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        projectName={estimateName(boq)}
        projectId={boq.id}
        kind="quick"
      />

      {shareOpen && (
        <QuickShareSheet
          isOpen
          onClose={() => void closeShare()}
          quickId={boq.id}
          name={estimateName(boq)}
          typeLabel={QUICK_TYPE_LABELS[boq.projectType] ?? boq.projectType}
        />
      )}
    </div>
  );
}

/**
 * The owner gets the whole estimate. Anyone it was shared with gets the site
 * view — steps, photos, materials without prices — because they cannot read
 * quick_boqs at all (migration 061).
 */
function QuickEstimateAccessGate() {
  const { id } = useParams<{ id: string }>();
  const [access, setAccess] = useState<SiteAccess | 'none' | null>(null);

  useEffect(() => {
    let active = true;
    void getSiteAccess({ kind: 'quick', id }).then((result) => { if (active) setAccess(result ?? 'none'); });
    return () => { active = false; };
  }, [id]);

  if (access === null) return null;
  if (access === 'edit' || access === 'view') {
    return <div className="max-[640px]:rounded-xl max-[640px]:bg-surface max-[640px]:p-3"><SiteView target={{ kind: 'quick', id }} /></div>;
  }
  // The owner, or no access: the estimate page says "could not open" itself.
  return <SavedQuickEstimate />;
}

export default function SavedQuickEstimatePage() {
  return (
    <MainLayout mobileNavy>
      <ProtectedRoute>
        <QuickEstimateAccessGate />
      </ProtectedRoute>
    </MainLayout>
  );
}
