'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Briefcase, CheckCircle, Percent } from '@phosphor-icons/react';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { getMyContractorProfile, registerAsContractor } from '@/lib/services/contractors';
// Shared with the directory filter — see the note in constants.ts. Using a
// separate list here meant a contractor could register with a trade the
// directory could never filter for.
import { CONTRACTOR_TRADES, ZIMBABWE_SERVICE_AREAS } from '@/components/contractors/constants';

/**
 * Self-serve contractor registration.
 *
 * No approval queue by design: contractor features are private pricing tools
 * (markup, client view), not a public listing. Directory visibility is a
 * separate opt-in on the contractor profile and defaults to off, so registering
 * here exposes nothing publicly.
 */

const INPUT =
  'w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

function ContractorRegisterContent() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const { success, error: showError } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [trades, setTrades] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState('');
  const [about, setAbout] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // Prefill when the account is already a contractor, so this page doubles as
  // "edit my details" rather than erroring or silently overwriting with blanks.
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!profile?.id) { setIsLoading(false); return; }
      const contractor = await getMyContractorProfile(profile.id);
      if (!active) return;
      if (contractor) {
        setAlreadyRegistered(true);
        setCompanyName(contractor.company_name);
        setContactPhone(contractor.contact_phone ?? '');
        setContactEmail(contractor.contact_email ?? '');
        setTrades(contractor.trades ?? []);
        setServiceAreas(contractor.service_areas ?? []);
        setYearsExperience(contractor.years_experience?.toString() ?? '');
        setAbout(contractor.about ?? '');
      }
      setIsLoading(false);
    };
    load();
    return () => { active = false; };
  }, [profile?.id]);

  const toggle = (list: string[], value: string, set: (v: string[]) => void) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      showError('Enter the name you trade under.');
      return;
    }

    setIsSubmitting(true);
    const parsedYears = parseInt(yearsExperience, 10);

    const { error } = await registerAsContractor({
      companyName,
      contactPhone: contactPhone || undefined,
      contactEmail: contactEmail || undefined,
      trades,
      serviceAreas,
      yearsExperience: Number.isFinite(parsedYears) ? parsedYears : null,
      about: about || undefined,
    });

    if (error) {
      showError(error.message || 'Could not complete registration.');
      setIsSubmitting(false);
      return;
    }

    // user_type has changed server-side; without this the app keeps the old
    // role until a reload and contractor features stay hidden.
    await refreshProfile?.();

    success(alreadyRegistered ? 'Contractor details updated.' : 'You are now set up as a contractor.');
    router.push('/quick-projects');
  };

  // A supplier or admin cannot become a contractor — register_as_contractor
  // refuses it. Say so here rather than letting them fill in a form that will
  // fail on submit.
  const blockedRole = profile?.user_type === 'supplier' || profile?.user_type === 'admin';

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (blockedRole) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <h1 className="text-lg font-bold text-slate-900">Not available on this account</h1>
          <p className="mt-2 text-sm text-slate-600">
            This account is registered as a {profile?.user_type}. Contractor tools are for
            accounts that build for clients. Use a separate account if you need both.
          </p>
          <Link
            href="/home"
            className="mt-4 inline-block text-sm font-bold text-blue-600 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          <Briefcase size={14} weight="fill" />
          {alreadyRegistered ? 'Contractor account' : 'Set up as a contractor'}
        </div>
        <h1 className="mt-3 text-2xl font-black text-slate-900">
          {alreadyRegistered ? 'Your contractor details' : 'Build for clients?'}
        </h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Contractor accounts get a markup on estimates and a client view that shares a
          BOQ without showing your margin. Nothing here is published — appearing in the
          public directory is a separate choice you make later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <label htmlFor="company" className="block text-xs font-bold text-slate-700 mb-1.5">
              Trading name <span className="text-red-500">*</span>
            </label>
            <input
              id="company"
              className={INPUT}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Chikwanha Building Contractors"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className="block text-xs font-bold text-slate-700 mb-1.5">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                className={INPUT}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+263 …"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 mb-1.5">
                Contact email
              </label>
              <input
                id="email"
                type="email"
                className={INPUT}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="years" className="block text-xs font-bold text-slate-700 mb-1.5">
              Years in the trade
            </label>
            <input
              id="years"
              type="number"
              inputMode="numeric"
              min={0}
              max={80}
              className={`${INPUT} sm:w-40`}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
            />
          </div>
        </div>

        <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
          <legend className="px-1 text-xs font-bold text-slate-700">What do you do?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CONTRACTOR_TRADES.map((t) => {
              const on = trades.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(trades, t, setTrades)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    on
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
          <legend className="px-1 text-xs font-bold text-slate-700">Where do you work?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ZIMBABWE_SERVICE_AREAS.map((city) => {
              const on = serviceAreas.includes(city);
              return (
                <button
                  key={city}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(serviceAreas, city, setServiceAreas)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    on
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <label htmlFor="about" className="block text-xs font-bold text-slate-700 mb-1.5">
            About your work <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="about"
            rows={4}
            className={INPUT}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="The kind of jobs you take on, and anything a client should know."
          />
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <Percent size={16} className="mt-0.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            Your markup starts at 15% and can be changed on any estimate. It is only ever
            shown to you — client view hides it.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
            {alreadyRegistered ? 'Save changes' : 'Set up contractor account'}
          </Button>
          <Link href="/home" className="text-sm font-semibold text-slate-500 hover:text-slate-700">
            Cancel
          </Link>
        </div>

        {alreadyRegistered && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle size={14} weight="fill" />
            This account already has contractor tools enabled.
          </p>
        )}
      </form>
    </div>
  );
}

export default function ContractorRegisterPage() {
  return (
    <ProtectedRoute>
      <MainLayout title="Contractor Account">
        <ContractorRegisterContent />
      </MainLayout>
    </ProtectedRoute>
  );
}
