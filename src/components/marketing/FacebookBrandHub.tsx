'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WhatsappLogo,
  Sparkle,
  House,
  Tag,
  ArrowRight,
  Copy,
  Check,
  Calculator,
} from '@phosphor-icons/react';
import Link from 'next/link';

/**
 * ZimEstimate community page.
 *
 * This was previously built as a mock Facebook page and stated a good deal that
 * is not true: 14.8k likes and 16.2k followers, verified check marks, "Official
 * Facebook Community Page", per-post like counts, a 4,500-member WhatsApp group,
 * "Zimbabwe's #1" and "Real-time cement, brick & roofing prices for Harare,
 * Bulawayo & Mutare" — while price_sources and price_weekly are empty and there
 * is no Mutare data at all. It also carried a testimonial from a named person,
 * "Tinashe N. (UK Diaspora)", badged "Verified Owner", describing a $13,000
 * saving that never happened.
 *
 * Everything stated here is now either true or explicitly framed as a worked
 * example. Reinstate social proof only with real figures, and testimonials only
 * with the customer's permission.
 */

/** Catalogue rates from data/boq/materials_pricing.csv. Keep in step with it. */
const REFERENCE_PRICES = [
  { label: 'Cement 32.5R (50kg bag)', value: '$11.29' },
  { label: 'Common bricks (per 1,000)', value: '$120.00' },
  { label: 'IBR roofing sheet 0.4mm (3m)', value: '$15.00' },
];

export default function FacebookBrandHub() {
  const [copiedShare, setCopiedShare] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);

  const shareText = `🏗️ ZimEstimate — Zimbabwe construction cost & BOQ estimator
Work out what your build needs, stage by stage, with Zimbabwe material rates.
https://zimestimate.com/quick-budget`;

  const handleCopyShareText = () => {
    navigator.clipboard.writeText(shareText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm">
        <div className="relative h-36 sm:h-52 w-full bg-[var(--color-primary)] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-85"
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(6,20,47,0.2), rgba(6,20,47,0.85)), url('/marketing/fb_cover.jpg')`,
            }}
          />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-[var(--color-surface)]/90">
            <span className="inline-flex items-center gap-1 font-semibold bg-[var(--color-primary-dark)]/70 px-2.5 py-1 rounded-lg backdrop-blur-md">
              <House size={14} className="text-[var(--color-accent)]" /> Community
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 bg-[var(--color-primary-dark)]/70 px-2.5 py-1 rounded-lg backdrop-blur-md">
              Harare, Zimbabwe
            </span>
          </div>
        </div>

        <div className="px-4 pb-5 pt-3 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-3 sm:gap-4 -mt-10 sm:-mt-14">
              <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl border-4 border-[var(--color-surface)] bg-[var(--color-primary)] text-[var(--color-surface)] shadow-md">
                <House size={40} className="text-[var(--color-accent)]" />
              </div>
              <div className="mb-1">
                <h1 className="text-lg sm:text-2xl font-black text-[var(--color-text)]">ZimEstimate</h1>
                <p className="text-xs sm:text-sm font-medium text-[var(--color-text-secondary)]">
                  Zimbabwe construction cost estimator and material reference
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
              <Link
                href="/quick-budget"
                className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs sm:text-sm font-bold text-[var(--color-surface)] shadow-sm transition hover:bg-[var(--color-primary-light)] active:scale-[0.98]"
              >
                <Sparkle size={16} className="text-[var(--color-accent)]" />
                <span>Check your budget</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowWhatsappModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface)] transition"
              >
                <Copy size={16} />
                <span className="hidden sm:inline">Share</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Material price reference */}
          <article className="overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-2xs">
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-[var(--color-surface)]">
                  <Tag size={20} className="text-[var(--color-accent)]" />
                </div>
                <div>
                  <p className="font-bold text-xs sm:text-sm text-[var(--color-text)]">Material price reference</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    Catalogue rates used by the estimator
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[var(--color-text)] leading-relaxed">
                These are the Harare rates our estimates are built on. They come from our
                material catalogue rather than a live feed, so treat them as a starting
                point and confirm with your supplier before buying.
              </p>

              <div className="overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)]">
                <div className="divide-y divide-[var(--color-border-light)] text-xs">
                  {REFERENCE_PRICES.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between p-2.5 font-semibold text-[var(--color-text)]"
                    >
                      <span>{row.label}</span>
                      <span className="font-bold tabular-nums">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <Link
                  href="/market-insights"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] hover:underline"
                >
                  <span>See the full price list</span>
                  <ArrowRight size={14} />
                </Link>
                <Link
                  href="/boq/new"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] hover:underline"
                >
                  <span>Build a BOQ for your site</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </article>

          {/* How the estimate is put together */}
          <article className="overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-2xs">
            <div className="p-4 sm:p-5 space-y-3">
              <p className="font-bold text-xs sm:text-sm text-[var(--color-text)]">
                What goes into an estimate
              </p>
              <p className="text-xs sm:text-sm text-[var(--color-text)] leading-relaxed">
                Every build is costed in five stages — foundation, walls and frame,
                roofing, finishing, and external works. Boundary walls, gates and paving
                sit in that last stage, and most published &ldquo;cost to build a
                house&rdquo; figures leave them out, so compare like with like.
              </p>
              <p className="text-xs sm:text-sm text-[var(--color-text)] leading-relaxed">
                Labour is quoted separately and typically runs 25&ndash;30% of materials
                on Zimbabwe builds. You can include or exclude it, and adjust the
                percentage, on any estimate.
              </p>
              <Link
                href="/quick-budget"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] hover:underline"
              >
                <span>See how far your budget goes</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </article>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Calculator size={20} className="text-[var(--color-accent)]" />
              <h2 className="font-bold text-sm sm:text-base text-[var(--color-text)]">Budget Estimator</h2>
            </div>
            {/* The widget here previously produced a number from a made-up
                formula (bedrooms * 4200 + 5500) unconnected to the real
                estimator. Linking to the actual tool instead of inventing a
                second answer. */}
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Enter what you have to spend and see which stages it carries — foundation,
              walls, roof — before you commit to anything.
            </p>
            <Link
              href="/quick-budget"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--color-accent)] py-2.5 text-xs font-bold text-[var(--color-surface)] hover:bg-[var(--color-accent-dark)] transition"
            >
              <span>Open the estimator</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <WhatsappLogo size={22} weight="fill" className="text-[var(--color-success)]" />
              <h2 className="font-bold text-xs sm:text-sm text-[var(--color-text)]">Share with your build group</h2>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Copy a short message to send into a family or contractor WhatsApp group.
            </p>
            <button
              type="button"
              onClick={() => setShowWhatsappModal(true)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-background)] transition"
            >
              Get the message
            </button>
          </div>
        </div>
      </div>

      {/* ── Share modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showWhatsappModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-3">
                <h3 className="font-bold text-base text-[var(--color-text)]">Share ZimEstimate</h3>
                <button
                  type="button"
                  onClick={() => setShowWhatsappModal(false)}
                  className="rounded-lg p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-xs font-mono text-[var(--color-text)] whitespace-pre-line select-all">
                {shareText}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyShareText}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-bold text-[var(--color-surface)] hover:opacity-90 transition"
                >
                  {copiedShare ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedShare ? 'Copied' : 'Copy message'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowWhatsappModal(false)}
                  className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
