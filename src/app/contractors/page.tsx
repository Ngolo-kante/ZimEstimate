'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useReveal } from '@/hooks/useReveal';
import ContractorCard from '@/components/contractors/ContractorCard';
import { CONTRACTOR_TRADES, ZIMBABWE_SERVICE_AREAS } from '@/components/contractors/constants';
import { listListedContractors, type PublicContractorRow } from '@/lib/services/contractors';
import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  MagnifyingGlass,
  ShieldCheck,
  SlidersHorizontal,
  SpinnerGap,
  UsersThree,
  X,
} from '@phosphor-icons/react';
import styles from './contractors.module.css';

const PAGE_SIZE = 24;

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<PublicContractorRow[]>([]);
  const [selectedTrade, setSelectedTrade] = useState('all');
  const [selectedArea, setSelectedArea] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Estimates link here with the trade they need already chosen. Filters are
  // read on mount rather than seeded into useState so the server and client
  // first render agree; the fetch waits for them so it only runs once.
  const [filtersReady, setFiltersReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    /* eslint-disable react-hooks/set-state-in-effect -- reading window.location
       has to happen after mount; seeding useState from it would make the server
       and client first render disagree. */
    const trade = params.get('trade');
    if (trade && CONTRACTOR_TRADES.includes(trade)) setSelectedTrade(trade);

    const area = params.get('area');
    if (area && ZIMBABWE_SERVICE_AREAS.includes(area)) setSelectedArea(area);

    setFiltersReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const loadContractors = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) setLoading(true);
    if (offset > 0) setLoadingMore(true);
    setError(null);

    const result = await listListedContractors({
      trade: selectedTrade,
      serviceArea: selectedArea,
      limit: PAGE_SIZE,
      offset,
    });

    if (result.error) setError(result.error);
    setContractors((prev) => (append ? [...prev, ...result.contractors] : result.contractors));
    setTotalCount(result.count);
    setLoading(false);
    setLoadingMore(false);
  }, [selectedArea, selectedTrade]);

  useEffect(() => {
    if (!filtersReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filters intentionally trigger a fresh query.
    loadContractors(0, false);
  }, [filtersReady, loadContractors]);

  const visibleContractors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contractors;
    return contractors.filter((contractor) => {
      const haystack = [
        contractor.company_name,
        contractor.contact_phone,
        contractor.contact_email,
        ...(contractor.trades || []),
        ...(contractor.service_areas || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [contractors, searchQuery]);

  const hasMore = contractors.length < totalCount;
  const hasActiveFilters = selectedTrade !== 'all' || selectedArea !== 'all' || searchQuery.trim().length > 0;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTrade('all');
    setSelectedArea('all');
  };

  useReveal({ deps: [visibleContractors.length, loading, selectedTrade, selectedArea] });

  return (
    <MainLayout fullWidth>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="contractor-directory-heading">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Contractor directory</span>
              <h1 id="contractor-directory-heading">Find the right trade for your next build.</h1>
              <p>
                Search public contractor profiles by the work you need and the places they serve across Zimbabwe.
              </p>
              <div className={styles.disclaimer}>
                <ShieldCheck size={18} weight="duotone" aria-hidden="true" />
                <span>Profiles are contractor-submitted. A listing does not imply verification by ZimEstimate.</span>
              </div>
            </div>
            <div className={styles.heroAction}>
              <Briefcase size={28} weight="duotone" aria-hidden="true" />
              <strong>Build for clients?</strong>
              <span>Create a contractor profile and choose whether to appear here.</span>
              <Link href="/contractor/register">
                List your business
                <ArrowRight size={17} weight="bold" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className={styles.content}>
          <section className={styles.filters} aria-label="Filter contractors">
            <label className={styles.searchField}>
              <span>Search directory</span>
              <div className={styles.inputWrap}>
                <MagnifyingGlass size={19} aria-hidden="true" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Company, trade, area or contact"
                  type="search"
                />
              </div>
            </label>

            <label>
              <span>Trade</span>
              <select value={selectedTrade} onChange={(event) => setSelectedTrade(event.target.value)}>
                <option value="all">All trades</option>
                {CONTRACTOR_TRADES.map((trade) => (
                  <option key={trade} value={trade}>{trade}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Service area</span>
              <select value={selectedArea} onChange={(event) => setSelectedArea(event.target.value)}>
                <option value="all">All service areas</option>
                {ZIMBABWE_SERVICE_AREAS.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </label>

            {hasActiveFilters && (
              <button type="button" className={styles.clearButton} onClick={clearFilters}>
                <X size={15} weight="bold" aria-hidden="true" />
                Clear
              </button>
            )}
          </section>

          {loading ? (
            <div className={styles.statePanel}>
              <SpinnerGap size={32} className="animate-spin" />
              <p>Loading listed contractors...</p>
            </div>
          ) : error ? (
            <div className={`${styles.statePanel} ${styles.errorPanel}`}>
              <h2>We could not load the directory</h2>
              <p>{error}</p>
              <button type="button" onClick={() => loadContractors(0, false)}>Try again</button>
            </div>
          ) : visibleContractors.length === 0 ? (
            <div className={styles.statePanel}>
              <UsersThree size={44} weight="duotone" aria-hidden="true" />
              <h2>No contractors match these filters</h2>
              <p>Try another trade or service area, or clear the current search.</p>
              {hasActiveFilters ? (
                <button type="button" onClick={clearFilters}>Clear all filters</button>
              ) : (
                <Link href="/contractor/register">Create the first public profile</Link>
              )}
            </div>
          ) : (
            <>
              <div className={styles.resultsHeader}>
                <div>
                  <SlidersHorizontal size={17} aria-hidden="true" />
                  <span>
                    Showing <strong>{visibleContractors.length}</strong> of <strong>{totalCount}</strong> listed contractors
                  </span>
                </div>
                <span>Public profiles only</span>
              </div>

              <section className={styles.resultsGrid} aria-label="Contractor results">
                {visibleContractors.map((contractor) => (
                  <ContractorCard key={contractor.id} contractor={contractor} />
                ))}
              </section>

              {hasMore && !searchQuery.trim() && (
                <div className={styles.loadMore}>
                  <button type="button" onClick={() => loadContractors(contractors.length, true)} disabled={loadingMore}>
                    {loadingMore && <SpinnerGap size={16} className="animate-spin" />}
                    Load more contractors
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </MainLayout>
  );
}
