'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { getListedContractor, type ContractorRow } from '@/lib/services/contractors';
import EnquiryForm from '@/components/enquiries/EnquiryForm';
import { ArrowLeft, Briefcase, EnvelopeSimple, MapPin, Phone, SpinnerGap } from '@phosphor-icons/react';

export default function ContractorDetailPage() {
  const params = useParams<{ id: string }>();
  const [contractor, setContractor] = useState<ContractorRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadContractor = async () => {
      setLoading(true);
      const result = await getListedContractor(params.id);
      if (!active) return;
      setContractor(result);
      setLoading(false);
    };

    loadContractor();

    return () => {
      active = false;
    };
  }, [params.id]);

  return (
    <MainLayout fullWidth>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-10">
        <Link href="/contractors" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700">
          <ArrowLeft size={16} weight="bold" />
          Back to contractor directory
        </Link>

        {loading ? (
          <div className="mt-8 flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white text-slate-500">
            <SpinnerGap size={32} className="animate-spin" />
            <p>Loading contractor profile...</p>
          </div>
        ) : !contractor ? (
          <section className="mt-8 rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-slate-950">Contractor profile not available</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
              This contractor is not listed publicly, has been removed, or the profile does not exist.
            </p>
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-950 px-5 py-8 text-white md:px-8">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-300">Public contractor profile</p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">{contractor.company_name}</h1>
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                <Briefcase size={17} weight="duotone" />
                {contractor.years_experience ? `${contractor.years_experience}+ years experience` : 'Experience not provided'}
              </p>
            </div>

            <div className="grid gap-8 p-5 md:grid-cols-[1fr_280px] md:p-8">
              <div className="min-w-0 space-y-8">
                <section>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">About</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                    {contractor.about || 'This contractor has not added an about section yet.'}
                  </p>
                </section>

                <section>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Trades</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(contractor.trades?.length ? contractor.trades : ['Trade not specified']).map((trade) => (
                      <span key={trade} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                        {trade}
                      </span>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Service areas</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(contractor.service_areas?.length ? contractor.service_areas : ['Service area not specified']).map((area) => (
                      <span key={area} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                        {area}
                      </span>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="h-fit rounded-lg border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-base font-bold text-slate-950">Public contact details</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  {contractor.contact_phone && (
                    <a href={`tel:${contractor.contact_phone}`} className="flex min-w-0 items-center gap-2 rounded-md bg-white p-3 transition hover:text-blue-700">
                      <Phone size={17} weight="duotone" className="shrink-0 text-slate-400" />
                      <span className="truncate font-mono text-xs">{contractor.contact_phone}</span>
                    </a>
                  )}
                  {contractor.contact_email && (
                    <a href={`mailto:${contractor.contact_email}`} className="flex min-w-0 items-center gap-2 rounded-md bg-white p-3 transition hover:text-blue-700">
                      <EnvelopeSimple size={17} weight="duotone" className="shrink-0 text-slate-400" />
                      <span className="truncate">{contractor.contact_email}</span>
                    </a>
                  )}
                  {!contractor.contact_phone && !contractor.contact_email && (
                    <p className="rounded-md bg-white p-3 text-slate-500">No contact details provided.</p>
                  )}
                </div>

                {/* A tel:/mailto: link leaves nothing behind — the contractor
                    gets nothing if they miss it, and neither side has a record
                    to follow up against. This records the enquiry and notifies
                    them, without taking the phone buttons away. */}
                <div className="mt-4">
                  <EnquiryForm
                    contractorId={contractor.id}
                    recipientName={contractor.company_name}
                  />
                </div>

                <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  <MapPin size={15} className="mb-1" />
                  ZimEstimate shows only information the contractor chose to list publicly. No verification status is implied.
                </div>
              </aside>
            </div>
          </section>
        )}
      </main>
    </MainLayout>
  );
}
