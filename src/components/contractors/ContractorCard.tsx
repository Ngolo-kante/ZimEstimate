'use client';

import Link from 'next/link';
import { ArrowRight, Briefcase, EnvelopeSimple, MapPin, Phone } from '@phosphor-icons/react';
import type { ContractorRow } from '@/lib/services/contractors';

type ContractorCardProps = {
  contractor: ContractorRow;
};

const visibleTags = (values: string[] | null | undefined, fallback: string) => {
  const items = values?.filter(Boolean) || [];
  return items.length ? items : [fallback];
};

export default function ContractorCard({ contractor }: ContractorCardProps) {
  const trades = visibleTags(contractor.trades, 'Trade not specified');
  const areas = visibleTags(contractor.service_areas, 'Service area not specified');

  return (
    <article className="reveal flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-slate-950">{contractor.company_name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <Briefcase size={15} weight="duotone" />
            {contractor.years_experience ? `${contractor.years_experience}+ years experience` : 'Experience not provided'}
          </p>
        </div>
      </div>

      {contractor.about && (
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{contractor.about}</p>
      )}

      <div className="mt-5 space-y-3">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Trades</p>
          <div className="flex flex-wrap gap-2">
            {trades.slice(0, 4).map((trade) => (
              <span key={trade} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {trade}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            <MapPin size={13} />
            Service areas
          </p>
          <div className="flex flex-wrap gap-2">
            {areas.slice(0, 4).map((area) => (
              <span key={area} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {area}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
        {contractor.contact_phone && (
          <span className="flex min-w-0 items-center gap-2">
            <Phone size={15} weight="duotone" className="shrink-0 text-slate-400" />
            <span className="truncate font-mono text-xs">{contractor.contact_phone}</span>
          </span>
        )}
        {contractor.contact_email && (
          <span className="flex min-w-0 items-center gap-2">
            <EnvelopeSimple size={15} weight="duotone" className="shrink-0 text-slate-400" />
            <span className="truncate">{contractor.contact_email}</span>
          </span>
        )}
      </div>

      <Link
        href={`/contractors/${contractor.id}`}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        View profile
        <ArrowRight size={15} weight="bold" />
      </Link>
    </article>
  );
}
