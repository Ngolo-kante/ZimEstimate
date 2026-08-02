'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useReveal } from '@/hooks/useReveal';
import ContractorCard from '@/components/contractors/ContractorCard';
import { CONTRACTOR_TRADES, ZIMBABWE_SERVICE_AREAS } from '@/components/contractors/constants';
import { listListedContractors, type ContractorRow } from '@/lib/services/contractors';
import { MagnifyingGlass, SlidersHorizontal, SpinnerGap, UsersThree } from '@phosphor-icons/react';

const PAGE_SIZE = 24;

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<ContractorRow[]>([]);
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

  useReveal({ deps: [visibleContractors.length, loading, selectedTrade, selectedArea] });

  return (
    <MainLayout fullWidth>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8 md:py-10">
        <section className="reveal rounded-lg border border-slate-200 bg-white px-5 py-6 shadow-sm md:px-8 md:py-8" data-delay="1">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Contractor directory</p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
                Find listed construction contractors in Zimbabwe.
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Browse contractors who have chosen to make their company name, trades, service areas and contact details public.
              </p>
            </div>
            <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
              {totalCount} listed {totalCount === 1 ? 'contractor' : 'contractors'}
            </div>
          </div>
        </section>

        <section className="reveal grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_220px_220px]" data-delay="2">
          <label className="relative block">
            <span className="sr-only">Search contractors</span>
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, trade, area or contact..."
              className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="sr-only">Filter by trade</span>
            <select
              value={selectedTrade}
              onChange={(event) => setSelectedTrade(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All trades</option>
              {CONTRACTOR_TRADES.map((trade) => (
                <option key={trade} value={trade}>{trade}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="sr-only">Filter by service area</span>
            <select
              value={selectedArea}
              onChange={(event) => setSelectedArea(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All service areas</option>
              {ZIMBABWE_SERVICE_AREAS.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </label>
        </section>

        {loading ? (
          <div className="reveal flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white text-slate-500">
            <SpinnerGap size={32} className="animate-spin" />
            <p>Loading listed contractors...</p>
          </div>
        ) : error ? (
          <div className="reveal rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            Could not load contractors: {error}
          </div>
        ) : visibleContractors.length === 0 ? (
          <div className="reveal flex min-h-72 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <UsersThree size={44} weight="duotone" className="text-slate-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">No listed contractors found</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                Contractors only appear here after they turn on directory listing in their profile.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="reveal flex items-center gap-2 text-sm text-slate-500">
              <SlidersHorizontal size={16} />
              Showing {visibleContractors.length} of {totalCount} matching listed contractors
            </div>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleContractors.map((contractor, index) => (
                <div key={contractor.id} data-delay={(index % 7) + 1}>
                  <ContractorCard contractor={contractor} />
                </div>
              ))}
            </section>

            {hasMore && !searchQuery.trim() && (
              <div className="reveal flex justify-center">
                <button
                  type="button"
                  onClick={() => loadContractors(contractors.length, true)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore && <SpinnerGap size={16} className="animate-spin" />}
                  Load more contractors
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </MainLayout>
  );
}
