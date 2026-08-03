'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Storefront,
  User,
  Phone,
  Envelope,
  Globe,
  MapPin,
  Truck,
  Package,
  CreditCard,
  Certificate,
  Upload,
  Check,
  Warning,
  ArrowLeft,
  ArrowRight,
  Spinner,
  Clock,
  CheckCircle,
  LockKey,
} from '@phosphor-icons/react';
import MainLayout from '@/components/layout/MainLayout';
import DemandProof from '@/components/marketplace/DemandProof';
import ContactSupportLink from '@/components/support/ContactSupportLink';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  submitSupplierApplication,
  getUserSupplierApplication,
  uploadSupplierDocument,
  MATERIAL_CATEGORIES,
  PAYMENT_TERMS_OPTIONS,
  ZIMBABWE_CITIES,
} from '@/lib/services/suppliers';
import {
  clearRegistrationDraft,
  loadRegistrationDraft,
  saveRegistrationDraft,
  setPostAuthRedirect,
} from '@/lib/registrationDraft';

/**
 * Supplier registration.
 *
 * Two things changed here and they are related.
 *
 * 1. No sign-in wall. This page used to redirect to /auth/login on mount, so
 *    the marketplace's "Sell on ZimEstimate" CTA delivered a login form and
 *    nothing else — an ask for commitment before showing a single word of what
 *    is on offer. Business, contact and product details need no account, so
 *    they are filled in first and the account is created at the Documents step,
 *    which is the first thing that genuinely needs a user (uploads are stored
 *    under the user's id, and the application needs an owner for the queue).
 *
 * 2. Built on the design system. The previous version carried 129 inline style
 *    objects with hardcoded hex, ignored the theme entirely, and opted out of
 *    MainLayout — the most important acquisition page in the product looked
 *    like a different product.
 */

type Step = 'business' | 'contact' | 'products' | 'account' | 'documents' | 'review';

const STEP_META: Record<Step, { label: string; icon: React.ElementType }> = {
  business: { label: 'Business Info', icon: Storefront },
  contact: { label: 'Contact Details', icon: User },
  products: { label: 'Products & Delivery', icon: Package },
  account: { label: 'Your Account', icon: LockKey },
  documents: { label: 'Documents', icon: Certificate },
  review: { label: 'Review & Submit', icon: Check },
};

const INPUT =
  'w-full rounded-lg border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] ' +
  'transition focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20';

const inputBorder = (invalid?: string) =>
  invalid ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]';

const LABEL = 'mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-secondary)]';

interface SupplierDraft {
  businessName: string;
  registrationNumber: string;
  yearsInBusiness: string;
  physicalAddress: string;
  city: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  materialCategories: string[];
  deliveryRadiusKm: number;
  paymentTerms: string;
  customerReferences: string[];
}

export default function SupplierRegisterPage() {
  const { user, isAuthenticated, isLoading: authLoading, signUp, refreshProfile } = useAuth();

  const [currentStep, setCurrentStep] = useState<Step>('business');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingApplication, setExistingApplication] = useState<{
    status: string;
    created_at: string;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<SupplierDraft>({
    businessName: '',
    registrationNumber: '',
    yearsInBusiness: '',
    physicalAddress: '',
    city: '',
    contactPhone: '',
    contactEmail: '',
    website: '',
    materialCategories: [],
    deliveryRadiusKm: 50,
    paymentTerms: '',
    customerReferences: ['', '', ''],
  });

  const [documentFiles, setDocumentFiles] = useState<{
    businessLicense: File | null;
    taxClearance: File | null;
    proofOfAddress: File | null;
  }>({
    businessLicense: null,
    taxClearance: null,
    proofOfAddress: null,
  });

  // Account creation, only reachable while signed out.
  const [accountPassword, setAccountPassword] = useState('');
  const [accountConfirm, setAccountConfirm] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // The account step exists only for people who do not have one. Once a session
  // appears it drops out and the flow is the original five steps.
  const steps = useMemo<Step[]>(
    () =>
      isAuthenticated
        ? ['business', 'contact', 'products', 'documents', 'review']
        : ['business', 'contact', 'products', 'account', 'documents', 'review'],
    [isAuthenticated]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (authLoading) return;

      // A draft is waiting whenever someone filled the form, created an account
      // and came back through an email confirmation link. Files cannot be
      // serialised, so those are re-picked — the Documents step says so.
      const draft = loadRegistrationDraft<SupplierDraft>('supplier');
      if (draft && active) {
        setFormData((prev) => ({ ...prev, ...draft }));
      }

      if (!user) {
        if (active) setLoading(false);
        return;
      }

      const application = await getUserSupplierApplication(user.id);
      if (!active) return;

      if (application) {
        setExistingApplication({
          status: application.status,
          created_at: application.created_at,
        });
        clearRegistrationDraft('supplier');
      } else if (draft) {
        // They came back to finish. Drop them where the account step used to be.
        setCurrentStep('documents');
      }

      // Prefer the account email over whatever was typed before signing up.
      setFormData((prev) => ({ ...prev, contactEmail: prev.contactEmail || user.email || '' }));
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const updateFormData = (field: keyof SupplierDraft, value: string | string[] | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const toggleCategory = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      materialCategories: prev.materialCategories.includes(category)
        ? prev.materialCategories.filter((c) => c !== category)
        : [...prev.materialCategories, category],
    }));
  };

  const handleDocumentChange =
    (field: keyof typeof documentFiles) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setDocumentFiles((prev) => ({ ...prev, [field]: event.target.files?.[0] || null }));
    };

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 'business') {
      if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
      if (!formData.physicalAddress.trim()) newErrors.physicalAddress = 'Physical address is required';
      if (!formData.city) newErrors.city = 'City is required';
    }

    if (step === 'contact') {
      if (!formData.contactPhone.trim()) newErrors.contactPhone = 'Phone number is required';
      if (!formData.contactEmail.trim()) {
        newErrors.contactEmail = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
        newErrors.contactEmail = 'Invalid email format';
      }
    }

    if (step === 'products') {
      if (formData.materialCategories.length === 0) {
        newErrors.materialCategories = 'Select at least one category';
      }
      if (formData.deliveryRadiusKm < 1) {
        newErrors.deliveryRadiusKm = 'Delivery radius must be at least 1km';
      }
    }

    if (step === 'account') {
      if (accountPassword.length < 6) newErrors.accountPassword = 'Password must be at least 6 characters';
      if (accountPassword !== accountConfirm) newErrors.accountConfirm = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** Creates the account the Documents step needs. */
  const handleCreateAccount = async () => {
    if (!validateStep('account')) return;

    setSubmitting(true);
    saveRegistrationDraft('supplier', formData);
    setPostAuthRedirect('/supplier/register');

    const { error, data } = await signUp(formData.contactEmail.trim(), accountPassword, formData.businessName.trim());

    if (error) {
      const message = error.message.toLowerCase();
      setErrors({
        account:
          message.includes('already registered') || message.includes('already exists')
            ? 'An account with this email already exists. Sign in and your details will still be here.'
            : error.message,
      });
      setSubmitting(false);
      return;
    }

    if (!data?.session) {
      // Email confirmation required — they finish after clicking the link.
      setAwaitingConfirmation(true);
      setSubmitting(false);
      return;
    }

    await refreshProfile?.();
    setCurrentStep('documents');
    setSubmitting(false);
  };

  const goToNextStep = () => {
    if (currentStep === 'account') {
      handleCreateAccount();
      return;
    }
    if (!validateStep(currentStep)) return;

    // Persist as they go, not only at the account step: a browser crash or a
    // closed tab three steps in should not cost them the whole form.
    saveRegistrationDraft('supplier', formData);

    const index = steps.indexOf(currentStep);
    if (index < steps.length - 1) setCurrentStep(steps[index + 1]);
  };

  const goToPrevStep = () => {
    const index = steps.indexOf(currentStep);
    if (index > 0) setCurrentStep(steps[index - 1]);
  };

  const handleSubmit = async () => {
    if (!user) {
      setErrors({ submit: 'Your session expired. Sign in again to submit — your details are saved.' });
      return;
    }

    setSubmitting(true);

    const result = await submitSupplierApplication(user.id, {
      businessName: formData.businessName,
      registrationNumber: formData.registrationNumber || undefined,
      physicalAddress: formData.physicalAddress,
      city: formData.city,
      contactPhone: formData.contactPhone,
      contactEmail: formData.contactEmail,
      website: formData.website || undefined,
      deliveryRadiusKm: formData.deliveryRadiusKm,
      materialCategories: formData.materialCategories,
      paymentTerms: formData.paymentTerms || undefined,
      yearsInBusiness: formData.yearsInBusiness ? parseInt(formData.yearsInBusiness) : undefined,
      customerReferences: formData.customerReferences.filter((r) => r.trim()),
    });

    if (result.success) {
      const applicationId = result.applicationId;
      if (applicationId) {
        const uploads = [
          documentFiles.businessLicense
            ? uploadSupplierDocument({
                userId: user.id,
                applicationId,
                documentType: 'business_license',
                file: documentFiles.businessLicense,
              })
            : Promise.resolve({ success: true }),
          documentFiles.taxClearance
            ? uploadSupplierDocument({
                userId: user.id,
                applicationId,
                documentType: 'tax_clearance',
                file: documentFiles.taxClearance,
              })
            : Promise.resolve({ success: true }),
          documentFiles.proofOfAddress
            ? uploadSupplierDocument({
                userId: user.id,
                applicationId,
                documentType: 'proof_of_address',
                file: documentFiles.proofOfAddress,
              })
            : Promise.resolve({ success: true }),
        ];

        const results = await Promise.all(uploads);
        if (results.some((r) => !r.success)) {
          setErrors({ submit: 'Application submitted, but some documents failed to upload.' });
        }
      }

      clearRegistrationDraft('supplier');
      setExistingApplication({ status: 'pending', created_at: new Date().toISOString() });
    } else {
      setErrors({ submit: result.error || 'Failed to submit application' });
    }

    setSubmitting(false);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading || authLoading) {
    return (
      <MainLayout title="Become a Supplier">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner size={32} className="animate-spin text-[var(--color-accent)]" />
        </div>
      </MainLayout>
    );
  }

  // ── Awaiting email confirmation ────────────────────────────────────────────
  if (awaitingConfirmation) {
    return (
      <MainLayout title="Become a Supplier">
        <div className="mx-auto max-w-xl px-4 py-12">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
            <CheckCircle size={44} weight="duotone" className="mx-auto text-[var(--color-success)]" />
            <h1 className="mt-3 text-xl font-bold text-[var(--color-text)]">Confirm your email to continue</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--color-text-secondary)]">
              We sent a link to <strong>{formData.contactEmail}</strong>. Open it and you will come back
              here with everything you entered for {formData.businessName} still filled in — you will
              only need to attach your documents.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ── Existing application status ────────────────────────────────────────────
  if (existingApplication) {
    const STATUS_VIEW: Record<string, { icon: React.ElementType; tone: string; title: string; body: string }> = {
      pending: {
        icon: Clock,
        tone: 'text-[var(--color-warning)]',
        title: 'Application Pending',
        body: `Your application was submitted on ${new Date(existingApplication.created_at).toLocaleDateString()}. Our team is reviewing it.`,
      },
      under_review: {
        icon: Clock,
        tone: 'text-[var(--color-accent)]',
        title: 'Under Review',
        body: "Your application is currently being reviewed. We'll notify you once a decision is made.",
      },
      approved: {
        icon: CheckCircle,
        tone: 'text-[var(--color-success)]',
        title: 'Application Approved',
        body: 'Your supplier account is now active.',
      },
      rejected: {
        icon: Warning,
        tone: 'text-[var(--color-error)]',
        title: 'Application Not Approved',
        body: 'Your application was not approved at this time. Please contact support for more information.',
      },
    };

    const view = STATUS_VIEW[existingApplication.status] ?? STATUS_VIEW.pending;
    const StatusIcon = view.icon;

    return (
      <MainLayout title="Become a Supplier">
        <div className="mx-auto max-w-xl px-4 py-12">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
            <StatusIcon size={44} weight="duotone" className={`mx-auto ${view.tone}`} />
            <h1 className="mt-3 text-xl font-bold text-[var(--color-text)]">{view.title}</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {view.body}
            </p>

            {existingApplication.status === 'approved' && (
              <Link
                href="/supplier/dashboard"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--color-success)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Go to Dashboard
                <ArrowRight size={16} weight="bold" />
              </Link>
            )}
          </div>

          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-accent)]"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </MainLayout>
    );
  }

  // Signing in from another tab drops the account step out from under us. Land
  // on documents — the step it was standing in for — rather than an index of -1.
  const resolvedStep: Step = steps.includes(currentStep) ? currentStep : 'documents';
  const currentIndex = steps.indexOf(resolvedStep);
  const isLastStep = resolvedStep === 'review';

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <MainLayout title="Become a Supplier">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <header className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-accent)]"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          <h1 className="mt-4 text-2xl font-black text-[var(--color-text)] sm:text-3xl">
            Sell on ZimEstimate
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
            List your business so builders costing projects can find, price and contact you.
            {!isAuthenticated && ' No account needed to start — you create one before uploading documents.'}
          </p>
          <DemandProof audience="supplier" className="mt-4" />
        </header>

        {/* Progress */}
        <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2">
          {steps.map((step, index) => {
            const meta = STEP_META[step];
            const Icon = meta.icon;
            const done = index < currentIndex;
            const active = step === currentStep;
            return (
              <li key={step} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                      : done
                        ? 'border-[var(--color-success)] bg-transparent text-[var(--color-success)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {done ? <Check size={13} weight="bold" /> : <Icon size={13} weight="duotone" />}
                  <span className="hidden sm:inline">{meta.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <span className="hidden h-px w-4 bg-[var(--color-border)] sm:block" aria-hidden />
                )}
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7">
          {/* Step 1: Business */}
          {resolvedStep === 'business' && (
            <section className="space-y-5">
              <h2 className="text-lg font-bold text-[var(--color-text)]">Business Information</h2>

              <div>
                <label htmlFor="businessName" className={LABEL}>
                  <Storefront size={14} weight="duotone" /> Business Name *
                </label>
                <input
                  id="businessName"
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => updateFormData('businessName', e.target.value)}
                  placeholder="Your company name"
                  className={`${INPUT} ${inputBorder(errors.businessName)}`}
                />
                {errors.businessName && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.businessName}</p>}
              </div>

              <div>
                <label htmlFor="registrationNumber" className={LABEL}>
                  <Certificate size={14} weight="duotone" /> Registration Number{' '}
                  <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <input
                  id="registrationNumber"
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => updateFormData('registrationNumber', e.target.value)}
                  placeholder="Business registration number"
                  className={`${INPUT} ${inputBorder()}`}
                />
              </div>

              <div>
                <label htmlFor="yearsInBusiness" className={LABEL}>
                  Years in Business <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <input
                  id="yearsInBusiness"
                  type="number"
                  min="0"
                  value={formData.yearsInBusiness}
                  onChange={(e) => updateFormData('yearsInBusiness', e.target.value)}
                  placeholder="How long have you been trading?"
                  className={`${INPUT} ${inputBorder()} sm:max-w-48`}
                />
              </div>

              <div>
                <label htmlFor="physicalAddress" className={LABEL}>
                  <MapPin size={14} weight="duotone" /> Physical Address *
                </label>
                <textarea
                  id="physicalAddress"
                  rows={2}
                  value={formData.physicalAddress}
                  onChange={(e) => updateFormData('physicalAddress', e.target.value)}
                  placeholder="Street address, building, etc."
                  className={`${INPUT} ${inputBorder(errors.physicalAddress)} resize-y`}
                />
                {errors.physicalAddress && (
                  <p className="mt-1 text-xs text-[var(--color-error)]">{errors.physicalAddress}</p>
                )}
              </div>

              <div>
                <label htmlFor="city" className={LABEL}>
                  City *
                </label>
                <select
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateFormData('city', e.target.value)}
                  className={`${INPUT} ${inputBorder(errors.city)}`}
                >
                  <option value="">Select city</option>
                  {ZIMBABWE_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                {errors.city && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.city}</p>}
              </div>
            </section>
          )}

          {/* Step 2: Contact */}
          {resolvedStep === 'contact' && (
            <section className="space-y-5">
              <h2 className="text-lg font-bold text-[var(--color-text)]">Contact Details</h2>

              <div>
                <label htmlFor="contactPhone" className={LABEL}>
                  <Phone size={14} weight="duotone" /> Phone Number *
                </label>
                <input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => updateFormData('contactPhone', e.target.value)}
                  placeholder="+263 77 123 4567"
                  className={`${INPUT} ${inputBorder(errors.contactPhone)}`}
                />
                {errors.contactPhone && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.contactPhone}</p>}
              </div>

              <div>
                <label htmlFor="contactEmail" className={LABEL}>
                  <Envelope size={14} weight="duotone" /> Email Address *
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => updateFormData('contactEmail', e.target.value)}
                  placeholder="sales@yourcompany.co.zw"
                  className={`${INPUT} ${inputBorder(errors.contactEmail)}`}
                />
                {errors.contactEmail && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.contactEmail}</p>}
                {!isAuthenticated && (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    This is also the email you will sign in with.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="website" className={LABEL}>
                  <Globe size={14} weight="duotone" /> Website{' '}
                  <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => updateFormData('website', e.target.value)}
                  placeholder="https://yourcompany.co.zw"
                  className={`${INPUT} ${inputBorder()}`}
                />
              </div>

              <div>
                <span className={LABEL}>
                  Customer References <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                </span>
                <p className="mb-2 text-xs text-[var(--color-text-muted)]">
                  Up to 3 references we can contact.
                </p>
                <div className="space-y-2">
                  {formData.customerReferences.map((reference, index) => (
                    <input
                      key={index}
                      type="text"
                      value={reference}
                      onChange={(e) => {
                        const next = [...formData.customerReferences];
                        next[index] = e.target.value;
                        updateFormData('customerReferences', next);
                      }}
                      placeholder={`Reference ${index + 1} (name & contact)`}
                      aria-label={`Customer reference ${index + 1}`}
                      className={`${INPUT} ${inputBorder()}`}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Step 3: Products */}
          {resolvedStep === 'products' && (
            <section className="space-y-6">
              <h2 className="text-lg font-bold text-[var(--color-text)]">Products & Delivery</h2>

              <div>
                <span className={LABEL}>Material Categories *</span>
                <p className="mb-2.5 text-xs text-[var(--color-text-muted)]">Select everything you supply.</p>
                <div className="flex flex-wrap gap-2">
                  {MATERIAL_CATEGORIES.map((category) => {
                    const on = formData.materialCategories.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleCategory(category)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          on
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                            : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]'
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
                {errors.materialCategories && (
                  <p className="mt-2 text-xs text-[var(--color-error)]">{errors.materialCategories}</p>
                )}
              </div>

              <div>
                <label htmlFor="deliveryRadius" className={LABEL}>
                  <Truck size={14} weight="duotone" /> Delivery Radius
                </label>
                <div className="flex items-center gap-4">
                  <input
                    id="deliveryRadius"
                    type="range"
                    min="1"
                    max="500"
                    value={formData.deliveryRadiusKm}
                    onChange={(e) => updateFormData('deliveryRadiusKm', parseInt(e.target.value))}
                    className="flex-1 accent-[var(--color-accent)]"
                  />
                  <span className="min-w-20 rounded-lg bg-[var(--color-accent-bg)] px-3 py-1.5 text-center text-sm font-bold text-[var(--color-accent)]">
                    {formData.deliveryRadiusKm} km
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Maximum distance you deliver from {formData.city || 'your location'}.
                </p>
              </div>

              <div>
                <label htmlFor="paymentTerms" className={LABEL}>
                  <CreditCard size={14} weight="duotone" /> Payment Terms
                </label>
                <select
                  id="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={(e) => updateFormData('paymentTerms', e.target.value)}
                  className={`${INPUT} ${inputBorder()}`}
                >
                  <option value="">Select payment terms</option>
                  {PAYMENT_TERMS_OPTIONS.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          )}

          {/* Step 4 (signed out only): Account */}
          {resolvedStep === 'account' && (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">Create your account</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  Everything so far is saved. An account is needed from here because your documents
                  are stored privately against it, and it is how you will track the application.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3">
                <p className="text-xs text-[var(--color-text-muted)]">Signing in as</p>
                <p className="text-sm font-bold text-[var(--color-text)]">{formData.contactEmail}</p>
                <button
                  type="button"
                  onClick={() => setCurrentStep('contact')}
                  className="mt-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                >
                  Use a different email
                </button>
              </div>

              <div>
                <label htmlFor="accountPassword" className={LABEL}>
                  <LockKey size={14} weight="duotone" /> Password *
                </label>
                <input
                  id="accountPassword"
                  type="password"
                  autoComplete="new-password"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={`${INPUT} ${inputBorder(errors.accountPassword)}`}
                />
                {errors.accountPassword && (
                  <p className="mt-1 text-xs text-[var(--color-error)]">{errors.accountPassword}</p>
                )}
              </div>

              <div>
                <label htmlFor="accountConfirm" className={LABEL}>
                  <LockKey size={14} weight="duotone" /> Confirm password *
                </label>
                <input
                  id="accountConfirm"
                  type="password"
                  autoComplete="new-password"
                  value={accountConfirm}
                  onChange={(e) => setAccountConfirm(e.target.value)}
                  placeholder="Type it again"
                  className={`${INPUT} ${inputBorder(errors.accountConfirm)}`}
                />
                {errors.accountConfirm && (
                  <p className="mt-1 text-xs text-[var(--color-error)]">{errors.accountConfirm}</p>
                )}
              </div>

              {errors.account && (
                <div className="flex items-start gap-2 rounded-xl border border-[var(--color-error)] bg-[var(--color-error-bg)] px-4 py-3">
                  <Warning size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-error)]" />
                  <p className="text-xs text-[var(--color-error)]">{errors.account}</p>
                </div>
              )}

              <p className="text-xs text-[var(--color-text-muted)]">
                Already registered?{' '}
                <Link
                  href="/auth/login?redirect=%2Fsupplier%2Fregister"
                  onClick={() => saveRegistrationDraft('supplier', formData)}
                  className="font-bold text-[var(--color-accent)] hover:underline"
                >
                  Sign in
                </Link>{' '}
                — your answers stay saved.
              </p>
            </section>
          )}

          {/* Step 5: Documents */}
          {resolvedStep === 'documents' && (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">Verification Documents</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  Documents get your business verified faster. All optional — you can submit now and
                  upload later, but verification only completes once they have been reviewed.
                </p>
              </div>

              {[
                {
                  key: 'businessLicense' as const,
                  label: 'Business Registration / License',
                  hint: 'PDF or image file',
                },
                { key: 'taxClearance' as const, label: 'Tax Clearance', hint: 'Optional but recommended' },
                {
                  key: 'proofOfAddress' as const,
                  label: 'Proof of Address',
                  hint: 'Utility bill, lease, or municipal statement',
                },
              ].map(({ key, label, hint }) => (
                <div key={key}>
                  <label htmlFor={key} className={LABEL}>
                    <Upload size={14} weight="duotone" /> {label}
                  </label>
                  <input
                    id={key}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleDocumentChange(key)}
                    className={`${INPUT} ${inputBorder()} file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-accent-bg)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[var(--color-accent)]`}
                  />
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {documentFiles[key] ? `Selected: ${documentFiles[key]?.name}` : hint}
                  </p>
                </div>
              ))}
            </section>
          )}

          {/* Step 6: Review */}
          {resolvedStep === 'review' && (
            <section className="space-y-5">
              <h2 className="text-lg font-bold text-[var(--color-text)]">Review Your Application</h2>

              <div className="rounded-xl bg-[var(--color-background)] p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Business Information
                </h3>
                <dl className="grid gap-1.5 text-sm text-[var(--color-text)]">
                  <div>
                    <dt className="inline font-semibold">Name: </dt>
                    <dd className="inline">{formData.businessName}</dd>
                  </div>
                  {formData.registrationNumber && (
                    <div>
                      <dt className="inline font-semibold">Registration: </dt>
                      <dd className="inline">{formData.registrationNumber}</dd>
                    </div>
                  )}
                  {formData.yearsInBusiness && (
                    <div>
                      <dt className="inline font-semibold">Years in Business: </dt>
                      <dd className="inline">{formData.yearsInBusiness}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline font-semibold">Address: </dt>
                    <dd className="inline">{formData.physicalAddress}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">City: </dt>
                    <dd className="inline">{formData.city}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl bg-[var(--color-background)] p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Contact
                </h3>
                <dl className="grid gap-1.5 text-sm text-[var(--color-text)]">
                  <div>
                    <dt className="inline font-semibold">Phone: </dt>
                    <dd className="inline">{formData.contactPhone}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">Email: </dt>
                    <dd className="inline">{formData.contactEmail}</dd>
                  </div>
                  {formData.website && (
                    <div>
                      <dt className="inline font-semibold">Website: </dt>
                      <dd className="inline">{formData.website}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-xl bg-[var(--color-background)] p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Products & Delivery
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {formData.materialCategories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-[var(--color-accent-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)]"
                    >
                      {category}
                    </span>
                  ))}
                </div>
                <p className="mt-2.5 text-sm text-[var(--color-text)]">
                  <span className="font-semibold">Delivery radius: </span>
                  {formData.deliveryRadiusKm} km
                  {formData.paymentTerms && (
                    <>
                      {' · '}
                      <span className="font-semibold">Payment: </span>
                      {formData.paymentTerms}
                    </>
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-[var(--color-background)] p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Documents
                </h3>
                <ul className="space-y-1 text-sm text-[var(--color-text)]">
                  {(
                    [
                      ['Business license', documentFiles.businessLicense],
                      ['Tax clearance', documentFiles.taxClearance],
                      ['Proof of address', documentFiles.proofOfAddress],
                    ] as const
                  ).map(([label, file]) => (
                    <li key={label} className="flex items-center gap-2">
                      {file ? (
                        <Check size={14} weight="bold" className="text-[var(--color-success)]" />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full border border-[var(--color-border)]" />
                      )}
                      <span className={file ? '' : 'text-[var(--color-text-muted)]'}>
                        {label}
                        {file ? `: ${file.name}` : ' — not attached'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {errors.submit && (
                <div className="flex items-start gap-2 rounded-xl border border-[var(--color-error)] bg-[var(--color-error-bg)] px-4 py-3">
                  <Warning size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-error)]" />
                  <p className="text-xs text-[var(--color-error)]">{errors.submit}</p>
                </div>
              )}
            </section>
          )}

          {/* Stuck is a real outcome on a six-step form with document uploads.
              Carries the category so the queue shows where people give up. */}
          <p className="mt-6 text-xs text-[var(--color-text-muted)]">
            Stuck on this step?{' '}
            <ContactSupportLink category="supplier" subject="Supplier registration" showIcon={false}>
              Contact support
            </ContactSupportLink>{' '}
            and we will help you finish.
          </p>

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5">
            {currentIndex > 0 ? (
              <button
                type="button"
                onClick={goToPrevStep}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent)]"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            ) : (
              <span />
            )}

            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Spinner size={16} className="animate-spin" /> : <Check size={16} weight="bold" />}
                Submit Application
              </button>
            ) : (
              <button
                type="button"
                onClick={goToNextStep}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Spinner size={16} className="animate-spin" />}
                {currentStep === 'account' ? 'Create account and continue' : 'Continue'}
                <ArrowRight size={16} weight="bold" />
              </button>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
