'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Briefcase,
  CheckCircle,
  Eye,
  LockKey,
  MapPin,
  Percent,
  UserCircle,
  Wrench,
} from '@phosphor-icons/react';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { getMyContractorProfile, registerAsContractor, updateContractorProfile } from '@/lib/services/contractors';
import {
  clearRegistrationDraft,
  loadRegistrationDraft,
  saveRegistrationDraft,
  setPostAuthRedirect,
} from '@/lib/registrationDraft';
// Shared with the directory filter — see the note in constants.ts. Using a
// separate list here meant a contractor could register with a trade the
// directory could never filter for.
import { CONTRACTOR_TRADES, ZIMBABWE_SERVICE_AREAS } from '@/components/contractors/constants';
import DemandProof from '@/components/marketplace/DemandProof';
import ContactSupportLink from '@/components/support/ContactSupportLink';
import styles from './register.module.css';

/**
 * Self-serve contractor registration.
 *
 * No approval queue by design: contractor features are private pricing tools
 * (markup, client view), not a public listing. Directory visibility is an
 * explicit opt-in below and defaults to off.
 *
 * No sign-in wall either. This page used to sit behind ProtectedRoute, so
 * someone arriving from the marketplace CTA met a login form before a single
 * word about what a contractor account gives them. Nothing on the form needs an
 * account until submit, so the account is created there instead — by which
 * point they have already done the work and are finishing rather than starting.
 */

interface ContractorDraft {
  companyName: string;
  contactPhone: string;
  contactEmail: string;
  trades: string[];
  serviceAreas: string[];
  yearsExperience: string;
  about: string;
  listInDirectory: boolean;
}

function ContractorRegisterContent() {
  const router = useRouter();
  const { profile, refreshProfile, signUp, isAuthenticated, isLoading: authLoading } = useAuth();
  const { success, error: showError } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [trades, setTrades] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState('');
  const [about, setAbout] = useState('');
  // contractors.is_listed defaults to false and register_as_contractor never
  // sets it, so before this every contractor finished registration invisible
  // and the directory could only ever report "0 listed contractors". Asking
  // here — opt-in, unticked — is what actually populates it.
  const [listInDirectory, setListInDirectory] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // Only collected when there is no account yet; the form above is the same
  // either way.
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const draftPayload = (): ContractorDraft => ({
    companyName,
    contactPhone,
    contactEmail,
    trades,
    serviceAreas,
    yearsExperience,
    about,
    listInDirectory,
  });

  // Three cases share this effect: an existing contractor editing their
  // details, someone returning from email confirmation with a draft waiting,
  // and a first-time visitor with neither.
  useEffect(() => {
    let active = true;

    const applyDraft = () => {
      const draft = loadRegistrationDraft<ContractorDraft>('contractor');
      if (!draft || !active) return false;
      setCompanyName(draft.companyName ?? '');
      setContactPhone(draft.contactPhone ?? '');
      setContactEmail(draft.contactEmail ?? '');
      setTrades(draft.trades ?? []);
      setServiceAreas(draft.serviceAreas ?? []);
      setYearsExperience(draft.yearsExperience ?? '');
      setAbout(draft.about ?? '');
      setListInDirectory(Boolean(draft.listInDirectory));
      return true;
    };

    const load = async () => {
      if (authLoading) return;

      if (!profile?.id) {
        // Signed out: nothing to fetch, but a draft may be waiting from a
        // half-finished attempt on this device.
        applyDraft();
        if (active) setIsLoading(false);
        return;
      }

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
        setListInDirectory(contractor.is_listed);
        // The saved record wins over any stale draft.
        clearRegistrationDraft('contractor');
      } else {
        applyDraft();
      }

      setIsLoading(false);
    };

    load();
    return () => { active = false; };
  }, [authLoading, profile?.id]);

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

    // No account yet: create one from the fields at the bottom of the form. The
    // draft is written first so nothing is lost whichever way signUp resolves.
    if (!isAuthenticated) {
      if (!accountEmail.trim() || !accountPassword) {
        showError('Enter an email and password to finish setting up your account.');
        setIsSubmitting(false);
        return;
      }
      if (accountPassword.length < 6) {
        showError('Password must be at least 6 characters.');
        setIsSubmitting(false);
        return;
      }

      saveRegistrationDraft('contractor', draftPayload());
      setPostAuthRedirect('/contractor/register');

      const { error: signUpError, data } = await signUp(accountEmail.trim(), accountPassword, companyName.trim());

      if (signUpError) {
        const message = signUpError.message.toLowerCase();
        showError(
          message.includes('already registered') || message.includes('already exists')
            ? 'An account with this email already exists — sign in and your details will still be here.'
            : signUpError.message
        );
        setIsSubmitting(false);
        return;
      }

      // Email confirmation is on: there is no session to register with yet.
      // Stop here and finish when they come back confirmed.
      if (!data?.session) {
        setAwaitingConfirmation(true);
        setIsSubmitting(false);
        return;
      }

      // Auto-confirmed, so a session exists and registration can continue below.
      await refreshProfile?.();
    }

    const parsedYears = parseInt(yearsExperience, 10);

    const { contractorId, error } = await registerAsContractor({
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

    // The RPC owns the record and the role switch but has no is_listed
    // parameter, so visibility is applied separately. Both directions: leaving
    // the box unticked on a re-save has to be able to unlist you again.
    if (contractorId) {
      const { success: listingSaved, error: listingError } = await updateContractorProfile(contractorId, {
        is_listed: listInDirectory,
      });
      if (!listingSaved) {
        showError(listingError || 'Details saved, but directory listing could not be updated.');
      }
    }

    // user_type has changed server-side; without this the app keeps the old
    // role until a reload and contractor features stay hidden.
    await refreshProfile?.();

    clearRegistrationDraft('contractor');
    success(alreadyRegistered ? 'Contractor details updated.' : 'You are now set up as a contractor.');
    // Somewhere they can see the result of the choice they just made, rather
    // than the quick-projects list which says nothing about being listed.
    router.push(listInDirectory && contractorId ? `/contractors/${contractorId}` : '/quick-projects');
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

  // Their details are saved on this device; the confirmation link brings them
  // back here and the effect above refills the form.
  if (awaitingConfirmation) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <CheckCircle size={40} weight="duotone" className="mx-auto text-emerald-600" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">Confirm your email to finish</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            We sent a confirmation link to <strong>{accountEmail}</strong>. Open it and you will
            land back on this page — your details for {companyName} are saved, so you only need
            to press the button once more.
          </p>
        </div>
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
    <div className={styles.page}>
      <header className={styles.intro}>
        <span className={styles.eyebrow}>
          <Briefcase size={15} weight="fill" aria-hidden="true" />
          {alreadyRegistered ? 'Contractor account' : 'Contractor setup'}
        </span>
        <h1>{alreadyRegistered ? 'Keep your contractor profile current.' : 'Build for clients with better numbers.'}</h1>
        <p>
          Add the details clients need, choose where you work, and decide whether your profile appears in the public directory.
        </p>
        <DemandProof audience="contractor" className={styles.demandProof} />
      </header>

      <div className={styles.layout}>
        <aside className={styles.summary} aria-label="Contractor account benefits">
          <h2>What you get</h2>
          <ul>
            <li><Percent size={19} weight="duotone" /><span><strong>Private markup</strong>Set your margin on each estimate.</span></li>
            <li><Eye size={19} weight="duotone" /><span><strong>Client-ready view</strong>Share the BOQ without exposing margin.</span></li>
            <li><UserCircle size={19} weight="duotone" /><span><strong>Optional public profile</strong>Be found by trade and service area.</span></li>
          </ul>
          <p>Nothing is published unless you turn on directory listing in step 5.</p>
        </aside>

        <form onSubmit={handleSubmit} className={styles.form}>
          <section className={styles.formSection} aria-labelledby="business-heading">
            <div className={styles.sectionHeading}>
              <span>1</span>
              <div><h2 id="business-heading">Business details</h2><p>How clients can identify and contact you.</p></div>
            </div>
            <div className={styles.fields}>
              <label className={styles.fieldWide} htmlFor="company">
                <span>Trading name <b>*</b></span>
                <input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Chikwanha Building Contractors" required />
              </label>
              <label htmlFor="phone">
                <span>Phone</span>
                <input id="phone" type="tel" autoComplete="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+263 ..." />
              </label>
              <label htmlFor="email">
                <span>Contact email</span>
                <input id="email" type="email" autoComplete="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@example.com" />
              </label>
              <label htmlFor="years">
                <span>Years in the trade</span>
                <input id="years" type="number" inputMode="numeric" min={0} max={80} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="e.g. 8" />
              </label>
            </div>
          </section>

          <fieldset className={styles.formSection}>
            <div className={styles.sectionHeading}>
              <span>2</span>
              <div><legend>Trades and services</legend><p>Select every type of work you take on.</p></div>
              {trades.length > 0 && <strong>{trades.length} selected</strong>}
            </div>
            <div className={styles.choiceGrid}>
              {CONTRACTOR_TRADES.map((trade) => {
                const on = trades.includes(trade);
                return (
                  <label key={trade} className={`${styles.choice} ${on ? styles.choiceSelected : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(trades, trade, setTrades)} />
                    <Wrench size={16} weight={on ? 'fill' : 'regular'} aria-hidden="true" />
                    <span>{trade}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className={styles.formSection}>
            <div className={styles.sectionHeading}>
              <span>3</span>
              <div><legend>Service areas</legend><p>Choose the places where clients can hire you.</p></div>
              {serviceAreas.length > 0 && <strong>{serviceAreas.length} selected</strong>}
            </div>
            <div className={styles.choiceGrid}>
              {ZIMBABWE_SERVICE_AREAS.map((city) => {
                const on = serviceAreas.includes(city);
                return (
                  <label key={city} className={`${styles.choice} ${on ? styles.choiceSelected : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(serviceAreas, city, setServiceAreas)} />
                    <MapPin size={16} weight={on ? 'fill' : 'regular'} aria-hidden="true" />
                    <span>{city}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <section className={styles.formSection} aria-labelledby="profile-heading">
            <div className={styles.sectionHeading}>
              <span>4</span>
              <div><h2 id="profile-heading">Profile summary</h2><p>Give clients a useful reason to open your profile.</p></div>
            </div>
            <label className={styles.aboutField} htmlFor="about">
              <span>About your work <em>Optional</em></span>
              <textarea id="about" rows={5} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={800} placeholder="Describe the jobs you take on, your approach, and anything a client should know." />
              <small>{about.length}/800</small>
            </label>
          </section>

          <section className={styles.formSection} aria-labelledby="visibility-heading">
            <div className={styles.sectionHeading}>
              <span>5</span>
              <div><h2 id="visibility-heading">Directory visibility</h2><p>You control whether clients can find this profile.</p></div>
            </div>
            <label htmlFor="listed" className={`${styles.visibilityChoice} ${listInDirectory ? styles.visibilityChoiceOn : ''}`}>
              <input id="listed" type="checkbox" checked={listInDirectory} onChange={(e) => setListInDirectory(e.target.checked)} />
              <span className={styles.toggle} aria-hidden="true"><i /></span>
              <span>
                <strong>List me in the public contractor directory</strong>
                <small>
                  Clients searching for {trades.length > 0 ? trades.slice(0, 2).join(' or ').toLowerCase() : 'your trade'} in{' '}
                  {serviceAreas.length > 0 ? serviceAreas.slice(0, 2).join(' or ') : 'your area'} can see your trading name, trades, service areas, phone, and contact email.
                </small>
              </span>
            </label>
            <p className={styles.privateNote}>Leave this off and your contractor account remains private. You can change it later.</p>
          </section>

          {/* Last, not first. Everything above works signed out; the account is
              what turns a filled-in form into a saved one. */}
          {!isAuthenticated && (
            <section className={`${styles.formSection} ${styles.accountSection}`} aria-labelledby="account-heading">
              <div className={styles.sectionHeading}>
                <span><LockKey size={17} weight="bold" /></span>
                <div><h2 id="account-heading">Create your account to finish</h2><p>Your completed profile stays on this device if email confirmation is needed.</p></div>
              </div>
              <div className={styles.fields}>
                <label htmlFor="account-email">
                  <span>Email <b>*</b></span>
                  <input id="account-email" type="email" autoComplete="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="you@example.com" />
                </label>
                <label htmlFor="account-password">
                  <span>Password <b>*</b></span>
                  <input id="account-password" type="password" autoComplete="new-password" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="At least 6 characters" />
                </label>
              </div>
              <p className={styles.signInNote}>
                Already have an account?{' '}
                <Link href="/auth/login?redirect=%2Fcontractor%2Fregister" onClick={() => saveRegistrationDraft('contractor', draftPayload())}>Sign in</Link>
                {' '}and your entered details will stay here.
              </p>
            </section>
          )}

          <div className={styles.formFooter}>
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting} fullWidth className={styles.submitButton}>
              {alreadyRegistered ? 'Save changes' : isAuthenticated ? 'Set up contractor account' : 'Create account and finish'}
            </Button>
            <div>
              <Link href="/contractors">Cancel</Link>
              <span>Need help? <ContactSupportLink category="contractor" subject="Contractor registration" showIcon={false}>Contact support</ContactSupportLink></span>
            </div>
            {alreadyRegistered && (
              <p><CheckCircle size={15} weight="fill" /> This account already has contractor tools enabled.</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContractorRegisterPage() {
  return (
    <MainLayout>
      <ContractorRegisterContent />
    </MainLayout>
  );
}
