'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/components/providers/AuthProvider';
import { CONTRACTOR_TRADES, ZIMBABWE_SERVICE_AREAS } from '@/components/contractors/constants';
import {
  getMyContractorProfile,
  updateContractorProfile,
  type ContractorRow,
} from '@/lib/services/contractors';
import { getContractorEnquiries, updateContactRequestStatus } from '@/lib/services/leads';
import type { ContactRequest } from '@/lib/database.types';
import {
  ArrowRight,
  CheckCircle,
  Eye,
  EyeSlash,
  SpinnerGap,
  WarningCircle,
} from '@phosphor-icons/react';

type FormState = {
  company_name: string;
  contact_phone: string;
  contact_email: string;
  trades: string[];
  service_areas: string[];
  years_experience: string;
  about: string;
  default_markup_pct: string;
  is_listed: boolean;
};

const emptyForm: FormState = {
  company_name: '',
  contact_phone: '',
  contact_email: '',
  trades: [],
  service_areas: [],
  years_experience: '',
  about: '',
  default_markup_pct: '15',
  is_listed: false,
};

const fromContractor = (contractor: ContractorRow): FormState => ({
  company_name: contractor.company_name || '',
  contact_phone: contractor.contact_phone || '',
  contact_email: contractor.contact_email || '',
  trades: contractor.trades || [],
  service_areas: contractor.service_areas || [],
  years_experience: contractor.years_experience?.toString() || '',
  about: contractor.about || '',
  default_markup_pct: contractor.default_markup_pct?.toString() || '15',
  is_listed: contractor.is_listed,
});

export default function ContractorProfilePage() {
  const router = useRouter();
  const { user, profile, isAuthenticated, isLoading: authLoading } = useAuth();
  const [contractor, setContractor] = useState<ContractorRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [enquiries, setEnquiries] = useState<ContactRequest[]>([]);

  const isContractor = String(profile?.user_type) === 'contractor';

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      router.replace('/auth/login?redirect=/contractor/profile');
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      const result = await getMyContractorProfile(user.id);
      setContractor(result);
      if (result) {
        setForm(fromContractor(result));
        setEnquiries(await getContractorEnquiries(result.id));
      }
      setLoading(false);
    };

    loadProfile();
  }, [authLoading, isAuthenticated, router, user]);

  const newEnquiryCount = enquiries.filter((entry) => entry.status === 'new').length;

  const markEnquiryRead = async (enquiryId: string) => {
    // Optimistic: the badge should drop the moment it is clicked. A failed
    // write leaves the row untouched in the database and the next load puts
    // it back, which is a better outcome than a spinner on a status flag.
    setEnquiries((current) =>
      current.map((entry) => (entry.id === enquiryId ? { ...entry, status: 'read' } : entry))
    );
    await updateContactRequestStatus(enquiryId, 'read');
  };

  const publicSummary = useMemo(() => {
    const exposed = ['Company name', 'Trades', 'Service areas', 'Phone', 'Email'];
    return exposed.join(', ');
  }, []);

  const updateField = (field: keyof FormState, value: string | boolean | string[]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleArrayValue = (field: 'trades' | 'service_areas', value: string) => {
    setForm((current) => {
      const existing = current[field];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];
      return { ...current, [field]: next };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contractor) return;

    setSaving(true);
    setStatus(null);

    const years = form.years_experience ? Number(form.years_experience) : null;
    const markup = Number(form.default_markup_pct || 15);

    if (!form.company_name.trim()) {
      setStatus({ type: 'error', message: 'Company name is required.' });
      setSaving(false);
      return;
    }

    if (Number.isNaN(markup) || markup < 0 || markup > 100) {
      setStatus({ type: 'error', message: 'Default markup must be between 0 and 100.' });
      setSaving(false);
      return;
    }

    const result = await updateContractorProfile(contractor.id, {
      company_name: form.company_name.trim(),
      contact_phone: form.contact_phone.trim() || null,
      contact_email: form.contact_email.trim() || null,
      trades: form.trades,
      service_areas: form.service_areas,
      years_experience: years,
      about: form.about.trim() || null,
      default_markup_pct: markup,
      is_listed: form.is_listed,
    });

    if (result.success) {
      const refreshed = await getMyContractorProfile(contractor.user_id);
      if (refreshed) {
        setContractor(refreshed);
        setForm(fromContractor(refreshed));
      }
      setStatus({ type: 'success', message: 'Contractor profile saved.' });
    } else {
      setStatus({ type: 'error', message: result.error || 'Could not save contractor profile.' });
    }

    setSaving(false);
  };

  return (
    <MainLayout fullWidth>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Contractor profile</p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Manage your public contractor listing.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Keep your company details, trades, service areas and default markup current. You control whether the profile is listed publicly.
              </p>
            </div>
            {contractor?.is_listed && (
              <Link
                href={`/contractors/${contractor.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                View public profile
                <ArrowRight size={15} weight="bold" />
              </Link>
            )}
          </div>
        </section>

        {authLoading || loading ? (
          <div className="mt-6 flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white text-slate-500">
            <SpinnerGap size={32} className="animate-spin" />
            <p>Loading contractor profile...</p>
          </div>
        ) : !isContractor ? (
          <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6">
            <div className="flex gap-3">
              <WarningCircle size={22} weight="duotone" className="shrink-0 text-amber-700" />
              <div>
                <h2 className="font-bold text-amber-950">Contractor account required</h2>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  This page is for signed-in contractors. Register as a contractor before managing a public listing.
                </p>
                <Link href="/contractor/register" className="mt-4 inline-flex font-semibold text-amber-950 underline">
                  Go to contractor registration
                </Link>
              </div>
            </div>
          </section>
        ) : !contractor ? (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">No contractor profile found</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your contractor account does not have a profile row yet. Complete contractor registration first.
            </p>
            <Link href="/contractor/register" className="mt-4 inline-flex font-semibold text-blue-700 underline">
              Open contractor registration
            </Link>
          </section>
        ) : (
          <>
            {/* Contractors had no inbox at all: the only route to one was a
                mailto: link that left no trace. Enquiries land here now, above
                the listing form, because a waiting customer matters more than
                editing your trades list. */}
            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-950">
                  Enquiries
                  {newEnquiryCount > 0 && (
                    <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                      {newEnquiryCount} new
                    </span>
                  )}
                </h2>
                <span className="text-xs text-slate-500">{enquiries.length} total</span>
              </div>

              {enquiries.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  No enquiries yet. People who find your listing can send one without
                  needing an account, and it will appear here.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {enquiries.map((enquiry) => (
                    <li
                      key={enquiry.id}
                      className={`rounded-md border p-4 ${
                        enquiry.status === 'new'
                          ? 'border-blue-200 bg-blue-50/60'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-slate-950">
                          {enquiry.builder_name || 'Someone'}
                        </strong>
                        <span className="text-xs text-slate-500">
                          {new Date(enquiry.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                        {enquiry.message}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                        {enquiry.builder_email && (
                          <a
                            href={`mailto:${enquiry.builder_email}`}
                            className="font-semibold text-blue-700 underline"
                          >
                            {enquiry.builder_email}
                          </a>
                        )}
                        {enquiry.builder_phone && (
                          <a
                            href={`tel:${enquiry.builder_phone}`}
                            className="font-semibold text-blue-700 underline"
                          >
                            {enquiry.builder_phone}
                          </a>
                        )}
                        {enquiry.status === 'new' && (
                          <button
                            type="button"
                            onClick={() => markEnquiryRead(enquiry.id)}
                            className="ml-auto rounded-md border border-slate-300 px-3 py-1 font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="space-y-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Company name
                  <input
                    value={form.company_name}
                    onChange={(event) => updateField('company_name', event.target.value)}
                    className="h-11 rounded-md border border-slate-200 px-3 font-normal outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Default markup %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.default_markup_pct}
                    onChange={(event) => updateField('default_markup_pct', event.target.value)}
                    className="h-11 rounded-md border border-slate-200 px-3 font-normal outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Contact phone
                  <input
                    value={form.contact_phone}
                    onChange={(event) => updateField('contact_phone', event.target.value)}
                    className="h-11 rounded-md border border-slate-200 px-3 font-normal outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="+263..."
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Contact email
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(event) => updateField('contact_email', event.target.value)}
                    className="h-11 rounded-md border border-slate-200 px-3 font-normal outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="name@example.com"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                  Years of experience
                  <input
                    type="number"
                    min="0"
                    max="80"
                    value={form.years_experience}
                    onChange={(event) => updateField('years_experience', event.target.value)}
                    className="h-11 rounded-md border border-slate-200 px-3 font-normal outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                About your company
                <textarea
                  value={form.about}
                  onChange={(event) => updateField('about', event.target.value)}
                  rows={5}
                  className="resize-y rounded-md border border-slate-200 px-3 py-3 font-normal leading-6 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Describe your work, preferred project types, and how clients should contact you."
                />
              </label>

              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Trades</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CONTRACTOR_TRADES.map((trade) => {
                    const active = form.trades.includes(trade);
                    return (
                      <button
                        type="button"
                        key={trade}
                        onClick={() => toggleArrayValue('trades', trade)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                          active
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50'
                        }`}
                      >
                        {trade}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Service areas</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ZIMBABWE_SERVICE_AREAS.map((area) => {
                    const active = form.service_areas.includes(area);
                    return (
                      <button
                        type="button"
                        key={area}
                        onClick={() => toggleArrayValue('service_areas', area)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                          active
                            ? 'border-slate-950 bg-slate-950 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="h-fit space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={form.is_listed}
                  onChange={(event) => updateField('is_listed', event.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="flex items-center gap-2 font-bold text-slate-950">
                    {form.is_listed ? <Eye size={18} weight="duotone" /> : <EyeSlash size={18} weight="duotone" />}
                    List me in the directory
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">
                    When enabled, {publicSummary} become visible to anyone, whether or not they are signed in.
                  </span>
                </span>
              </label>

              <div className="rounded-md border border-slate-200 p-4 text-sm leading-6 text-slate-600">
                <strong className="block text-slate-950">No verification badge</strong>
                This listing does not mark you as verified. Verification status is reserved for a future workflow.
              </div>

              {status && (
                <div
                  className={`flex gap-2 rounded-md border p-3 text-sm ${
                    status.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {status.type === 'success' ? <CheckCircle size={18} weight="duotone" /> : <WarningCircle size={18} weight="duotone" />}
                  {status.message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <SpinnerGap size={16} className="animate-spin" />}
                Save contractor profile
              </button>
            </aside>
            </form>
          </>
        )}
      </main>
    </MainLayout>
  );
}
