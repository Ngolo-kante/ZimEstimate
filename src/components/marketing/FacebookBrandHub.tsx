'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  ThumbsUp,
  ChatCircle,
  ShareNetwork,
  WhatsappLogo,
  Globe,
  MagnifyingGlass,
  Sparkle,
  TrendUp,
  House,
  ShieldCheck,
  Tag,
  ArrowRight,
  Copy,
  Check,
} from '@phosphor-icons/react';
import Link from 'next/link';

export default function FacebookBrandHub() {
  const [activeTab, setActiveTab] = useState<'feed' | 'prices' | 'diaspora' | 'contractors'>('feed');
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({ p1: true, p2: false, p3: false });
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({ p1: 142, p2: 89, p3: 215 });
  const [copiedShare, setCopiedShare] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);

  // Quick estimator mini state
  const [quickRooms, setQuickRooms] = useState('3');
  const [quickStage, setQuickStage] = useState('entire');

  const toggleLike = (postId: string) => {
    setLikedPosts((prev) => {
      const current = Boolean(prev[postId]);
      setLikeCounts((cPrev) => ({
        ...cPrev,
        [postId]: current ? cPrev[postId] - 1 : cPrev[postId] + 1,
      }));
      return { ...prev, [postId]: !current };
    });
  };

  const handleCopyShareText = () => {
    const shareText = `🏗️ Check out ZimEstimate - Zimbabwe's #1 Construction Cost & BOQ Estimator!
Real-time cement, brick & roofing prices for Harare, Bulawayo & Mutare.
Calculate your exact house build cost in 3 minutes: https://zimestimate.co.zw/boq/new`;
    navigator.clipboard.writeText(shareText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const quickEstimatedCost = () => {
    const base = parseInt(quickRooms, 10) || 3;
    const factor = quickStage === 'entire' ? 4200 : 1800;
    return (base * factor + 5500).toLocaleString('en-US');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* ── Official Facebook Page Header ───────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm">
        {/* Cover Photo */}
        <div className="relative h-44 sm:h-64 w-full bg-[var(--color-primary)] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-85"
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(6,20,47,0.2), rgba(6,20,47,0.85)), url('/marketing/fb_cover.jpg')`,
            }}
          />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-[var(--color-surface)]/90">
            <span className="inline-flex items-center gap-1 font-semibold bg-[var(--color-primary-dark)]/70 px-2.5 py-1 rounded-lg backdrop-blur-md">
              <Globe size={14} className="text-[var(--color-accent)]" /> Official Facebook Community Page
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 bg-[var(--color-primary-dark)]/70 px-2.5 py-1 rounded-lg backdrop-blur-md">
              Updated Daily • Harare, Zimbabwe
            </span>
          </div>
        </div>

        {/* Profile Details Bar */}
        <div className="px-4 pb-4 pt-3 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-3 sm:gap-4 -mt-10 sm:-mt-14">
              <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl border-4 border-[var(--color-surface)] bg-[var(--color-primary)] text-[var(--color-surface)] shadow-md">
                <House size={40} className="text-[var(--color-accent)]" />
                <span className="absolute bottom-0 right-0 rounded-full bg-[var(--color-success)] p-1 ring-2 ring-[var(--color-surface)]" />
              </div>
              <div className="mb-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg sm:text-2xl font-black text-[var(--color-text)]">ZimEstimate</h1>
                  <CheckCircle size={20} weight="fill" className="text-[var(--color-accent)]" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-[var(--color-text-secondary)]">
                  Zimbabwe Construction Cost Estimator & Material Benchmark
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text)]">14.8k Likes</span>
                  <span>•</span>
                  <span className="font-semibold text-[var(--color-text)]">16.2k Followers</span>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
              <Link
                href="/boq/new"
                className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs sm:text-sm font-bold text-[var(--color-surface)] shadow-sm transition hover:bg-[var(--color-primary-light)] active:scale-[0.98]"
              >
                <Sparkle size={16} className="text-[var(--color-accent)]" />
                <span>Calculate BOQ Now</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowWhatsappModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition"
              >
                <WhatsappLogo size={18} weight="fill" />
                <span className="hidden sm:inline">WhatsApp Community</span>
              </button>
              <button
                type="button"
                onClick={handleCopyShareText}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-2.5 text-[var(--color-text)] hover:bg-[var(--color-surface)] transition"
                title="Share Community Page"
                aria-label="Share Community Page"
              >
                {copiedShare ? <Check size={18} className="text-[var(--color-success)]" /> : <ShareNetwork size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-t border-[var(--color-border-light)] px-4 sm:px-6">
          <div className="flex gap-2 overflow-x-auto py-2">
            {[
              { id: 'feed', label: 'Community Feed' },
              { id: 'prices', label: 'Price Watch 🇿🇼' },
              { id: 'diaspora', label: 'Diaspora Stories' },
              { id: 'contractors', label: 'Verified Builders' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition ${
                  activeTab === tab.id
                    ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main Layout Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left/Middle Column: Feed & Posts */}
        <div className="space-y-4 lg:col-span-2">
          {/* Post 1: Live Price Watch Alert */}
          {(activeTab === 'feed' || activeTab === 'prices') && (
            <motion.article
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-2xs"
            >
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-[var(--color-surface)]">
                      <Tag size={20} className="text-[var(--color-accent)]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-[var(--color-text)]">ZimEstimate Official</span>
                        <CheckCircle size={14} weight="fill" className="text-[var(--color-accent)]" />
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">2 hours ago • Weekly Price Benchmark</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[var(--color-accent-bg)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-accent)]">
                    Harare Hardware Alert
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[var(--color-text)] leading-relaxed">
                  📊 <strong>Weekly Construction Material Price Check (Harare & Bulawayo):</strong><br />
                  Don't pay inflated contractor prices! Here are current hardware averages across major Zim suppliers:
                </p>

                {/* Price Benchmark Table */}
                <div className="overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)]">
                  <div className="divide-y divide-[var(--color-border-light)] text-xs">
                    <div className="flex items-center justify-between p-2.5 font-semibold text-[var(--color-text)]">
                      <span>Sino-Zim Cement (50kg Bag)</span>
                      <span className="font-bold text-[var(--color-success)]">$10.50 USD</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 font-semibold text-[var(--color-text)]">
                      <span>Red Burnt Farm Bricks (per 1,000)</span>
                      <span className="font-bold text-[var(--color-success)]">$80.00 USD</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 font-semibold text-[var(--color-text)]">
                      <span>0.4mm IBR Roofing Sheets (6m)</span>
                      <span className="font-bold text-[var(--color-success)]">$18.00 USD</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href="/boq/new"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] hover:underline"
                  >
                    <span>Run a custom BOQ estimate for your site location</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              {/* Like / Share Bar */}
              <div className="flex items-center justify-between border-t border-[var(--color-border-light)] bg-[var(--color-background)] px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                <button
                  type="button"
                  onClick={() => toggleLike('p1')}
                  className={`inline-flex items-center gap-1.5 transition ${
                    likedPosts.p1 ? 'text-[var(--color-accent)] font-bold' : 'hover:text-[var(--color-text)]'
                  }`}
                >
                  <ThumbsUp size={16} weight={likedPosts.p1 ? 'fill' : 'regular'} />
                  <span>{likeCounts.p1} Likes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowWhatsappModal(true)}
                  className="inline-flex items-center gap-1.5 hover:text-[var(--color-success)] transition"
                >
                  <WhatsappLogo size={16} weight="fill" className="text-[var(--color-success)]" />
                  <span>Share to WhatsApp</span>
                </button>
              </div>
            </motion.article>
          )}

          {/* Post 2: Diaspora Success Case Study */}
          {(activeTab === 'feed' || activeTab === 'diaspora') && (
            <motion.article
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-2xs"
            >
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-surface)] font-bold">
                      TN
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-xs sm:text-sm text-[var(--color-text)]">Tinashe N. (UK Diaspora)</span>
                        <span className="rounded-md bg-[var(--color-accent-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">Verified Owner</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">Yesterday at 14:20 • Ruwa House Build</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-[var(--color-text)] leading-relaxed">
                  "Being based in London and trying to build a 4-bedroom house in Ruwa was terrifying. My first contractor gave me a quote of $32,000 just for substructure & brickwork. 😱<br /><br />
                  I ran the project specs through <strong>ZimEstimate</strong> and found out the actual material & labor baseline was $18,400. That single BOQ report saved me over $13,000! Highly recommend for anyone building from abroad."
                </p>

                <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-primary-bg)] p-3 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={20} className="text-[var(--color-accent)]" />
                    <div>
                      <p className="font-bold text-[var(--color-text)]">Ruwa 4-Bed House BOQ Report</p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">Verified baseline total: $18,400 USD</p>
                    </div>
                  </div>
                  <Link
                    href="/boq/new"
                    className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-surface)] hover:opacity-90"
                  >
                    View Template
                  </Link>
                </div>
              </div>

              {/* Like / Share Bar */}
              <div className="flex items-center justify-between border-t border-[var(--color-border-light)] bg-[var(--color-background)] px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                <button
                  type="button"
                  onClick={() => toggleLike('p2')}
                  className={`inline-flex items-center gap-1.5 transition ${
                    likedPosts.p2 ? 'text-[var(--color-accent)] font-bold' : 'hover:text-[var(--color-text)]'
                  }`}
                >
                  <ThumbsUp size={16} weight={likedPosts.p2 ? 'fill' : 'regular'} />
                  <span>{likeCounts.p2} Likes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowWhatsappModal(true)}
                  className="inline-flex items-center gap-1.5 hover:text-[var(--color-success)] transition"
                >
                  <WhatsappLogo size={16} weight="fill" className="text-[var(--color-success)]" />
                  <span>Share Case Study</span>
                </button>
              </div>
            </motion.article>
          )}
        </div>

        {/* Right Column: Quick Estimator & Community Stats */}
        <div className="space-y-4">
          {/* Quick Estimator Widget */}
          <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <Sparkle size={20} className="text-[var(--color-accent)]" />
              <h3 className="font-bold text-sm sm:text-base text-[var(--color-text)]">Instant Cost Estimator</h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Quick 10-second cost benchmark for residential building in Zimbabwe.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase">Bedrooms</label>
                <select
                  value={quickRooms}
                  onChange={(e) => setQuickRooms(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-2 text-xs font-bold text-[var(--color-text)] outline-none"
                >
                  <option value="2">2 Bedroom House</option>
                  <option value="3">3 Bedroom House</option>
                  <option value="4">4 Bedroom House</option>
                  <option value="5">5 Bedroom House / Mansion</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase">Building Scope</label>
                <select
                  value={quickStage}
                  onChange={(e) => setQuickStage(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-2 text-xs font-bold text-[var(--color-text)] outline-none"
                >
                  <option value="entire">Full Build (Substructure to Roof Lock-up)</option>
                  <option value="foundation">Substructure & Slab Only</option>
                </select>
              </div>

              <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-primary)] p-3 text-center text-[var(--color-surface)]">
                <p className="text-[10px] uppercase text-[var(--color-text-secondary)] font-semibold">Estimated Cost Range</p>
                <p className="text-xl font-black text-[var(--color-surface)]">${quickEstimatedCost()} USD</p>
              </div>

              <Link
                href="/boq/new"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--color-accent)] py-2.5 text-xs font-bold text-[var(--color-surface)] hover:bg-[var(--color-accent-dark)] transition"
              >
                <span>Get Itemized BOQ</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* WhatsApp Group Invite Card */}
          <div className="rounded-2xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <WhatsappLogo size={24} weight="fill" className="text-[var(--color-success)]" />
              <h3 className="font-bold text-xs sm:text-sm text-[var(--color-text)]">Join Zim Building WhatsApp Group</h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Connect with 4,500+ Zimbabwean builders, vetted contractors, and hardware suppliers sharing daily price alerts.
            </p>
            <button
              type="button"
              onClick={() => setShowWhatsappModal(true)}
              className="w-full rounded-xl bg-[var(--color-success)] py-2 text-xs font-bold text-white hover:opacity-90 transition shadow-2xs"
            >
              Join WhatsApp Community
            </button>
          </div>
        </div>
      </div>

      {/* ── WhatsApp Share Modal ────────────────────────────────────────────── */}
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
                <div className="flex items-center gap-2">
                  <WhatsappLogo size={24} weight="fill" className="text-[var(--color-success)]" />
                  <h3 className="font-bold text-base text-[var(--color-text)]">Share ZimEstimate on WhatsApp</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWhatsappModal(false)}
                  className="rounded-lg p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Copy and share this pre-formatted message directly into family or WhatsApp construction groups:
              </p>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-xs font-mono text-[var(--color-text)] whitespace-pre-line select-all">
                {`🏗️ ZimEstimate - Zimbabwe Construction Cost & BOQ Estimator!

Real-time cement, brick & roofing prices for Harare, Bulawayo & Mutare.
Calculate your exact house build cost in 3 minutes:
https://zimestimate.co.zw/boq/new`}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyShareText}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-success)] px-4 py-2.5 text-xs font-bold text-white hover:opacity-90 transition"
                >
                  {copiedShare ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedShare ? 'Copied to Clipboard!' : 'Copy WhatsApp Link'}</span>
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
