'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  CheckCircle
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import {
  submitSupplierApplication,
  getUserSupplierApplication,
  uploadSupplierDocument,
  MATERIAL_CATEGORIES,
  PAYMENT_TERMS_OPTIONS,
  ZIMBABWE_CITIES,
} from '@/lib/services/suppliers';

type Step = 'business' | 'contact' | 'products' | 'documents' | 'review';

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'business', label: 'Business Info', icon: Storefront },
  { key: 'contact', label: 'Contact Details', icon: User },
  { key: 'products', label: 'Products & Delivery', icon: Package },
  { key: 'documents', label: 'Documents', icon: Certificate },
  { key: 'review', label: 'Review & Submit', icon: Check },
];

export default function SupplierRegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('business');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [existingApplication, setExistingApplication] = useState<{
    status: string;
    created_at: string;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form data
  const [formData, setFormData] = useState({
    businessName: '',
    registrationNumber: '',
    yearsInBusiness: '',
    physicalAddress: '',
    city: '',
    contactPhone: '',
    contactEmail: '',
    website: '',
    materialCategories: [] as string[],
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

  useEffect(() => {
    async function checkAuth() {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.push('/auth/login?redirect=/supplier/register');
        return;
      }

      setUser({ id: authUser.id, email: authUser.email || '' });
      setFormData(prev => ({ ...prev, contactEmail: authUser.email || '' }));

      // Check for existing application
      const application = await getUserSupplierApplication(authUser.id);
      if (application) {
        setExistingApplication({
          status: application.status,
          created_at: application.created_at,
        });
      }

      setLoading(false);
    }

    checkAuth();
  }, [router]);

  const updateFormData = (field: string, value: string | string[] | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const toggleCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      materialCategories: prev.materialCategories.includes(category)
        ? prev.materialCategories.filter(c => c !== category)
        : [...prev.materialCategories, category],
    }));
  };

  const handleDocumentChange = (field: keyof typeof documentFiles) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;
    setDocumentFiles(prev => ({ ...prev, [field]: file }));
  };

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 'business') {
      if (!formData.businessName.trim()) {
        newErrors.businessName = 'Business name is required';
      }
      if (!formData.physicalAddress.trim()) {
        newErrors.physicalAddress = 'Physical address is required';
      }
      if (!formData.city) {
        newErrors.city = 'City is required';
      }
    }

    if (step === 'contact') {
      if (!formData.contactPhone.trim()) {
        newErrors.contactPhone = 'Phone number is required';
      }
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return;

    const currentIndex = STEPS.findIndex(s => s.key === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].key);
    }
  };

  const goToPrevStep = () => {
    const currentIndex = STEPS.findIndex(s => s.key === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].key);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

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
      customerReferences: formData.customerReferences.filter(r => r.trim()),
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
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
          setErrors({ submit: 'Application submitted, but some documents failed to upload.' });
        }
      }

      setExistingApplication({
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    } else {
      setErrors({ submit: result.error || 'Failed to submit application' });
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
      }}>
        <Spinner size={32} className="animate-spin" style={{ color: '#3b82f6' }} />
      </div>
    );
  }

  // Show application status if already submitted
  if (existingApplication) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        padding: '2rem',
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            {existingApplication.status === 'pending' && (
              <>
                <Clock size={48} style={{ color: '#f59e0b', marginBottom: '1rem' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Application Pending
                </h1>
                <p style={{ color: '#64748b' }}>
                  Your supplier application was submitted on{' '}
                  {new Date(existingApplication.created_at).toLocaleDateString()}.
                  Our team is reviewing your application.
                </p>
              </>
            )}
            {existingApplication.status === 'under_review' && (
              <>
                <Clock size={48} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Under Review
                </h1>
                <p style={{ color: '#64748b' }}>
                  Your application is currently being reviewed by our team.
                  We&apos;ll notify you once a decision is made.
                </p>
              </>
            )}
            {existingApplication.status === 'approved' && (
              <>
                <CheckCircle size={48} style={{ color: '#16a34a', marginBottom: '1rem' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Application Approved!
                </h1>
                <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                  Congratulations! Your supplier account is now active.
                </p>
                <Link
                  href="/supplier/dashboard"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#16a34a',
                    color: 'white',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Go to Dashboard
                  <ArrowRight size={18} />
                </Link>
              </>
            )}
            {existingApplication.status === 'rejected' && (
              <>
                <Warning size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Application Not Approved
                </h1>
                <p style={{ color: '#64748b' }}>
                  Unfortunately, your application was not approved at this time.
                  Please contact support for more information.
                </p>
              </>
            )}
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#64748b',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={18} />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#64748b',
              textDecoration: 'none',
              marginBottom: '1rem',
            }}
          >
            <ArrowLeft size={18} />
            Back to Home
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Become a Supplier
          </h1>
          <p style={{ color: '#64748b' }}>
            Join ZimEstimate&apos;s marketplace and reach thousands of builders across Zimbabwe.
          </p>
        </div>

        {/* Progress Steps */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          position: 'relative',
        }}>
          {/* Progress Line */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '40px',
            right: '40px',
            height: '2px',
            backgroundColor: '#e2e8f0',
          }} />
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '40px',
            width: `${(currentStepIndex / (STEPS.length - 1)) * (100 - 10)}%`,
            height: '2px',
            backgroundColor: '#3b82f6',
            transition: 'width 0.3s ease',
          }} />

          {STEPS.map((step, index) => {
            const isComplete = index < currentStepIndex;
            const isCurrent = step.key === currentStep;
            const Icon = step.icon;

            return (
              <div
                key={step.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isComplete ? '#16a34a' : isCurrent ? '#3b82f6' : 'white',
                  border: `2px solid ${isComplete ? '#16a34a' : isCurrent ? '#3b82f6' : '#e2e8f0'}`,
                  color: isComplete || isCurrent ? 'white' : '#94a3b8',
                  transition: 'all 0.3s ease',
                }}>
                  {isComplete ? <Check size={20} weight="bold" /> : <Icon size={20} />}
                </div>
                <span style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? '#1e293b' : '#64748b',
                }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Form Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          {/* Step 1: Business Info */}
          {currentStep === 'business' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                Business Information
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Business Name *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Storefront size={20} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                    }} />
                    <input
                      type="text"
                      value={formData.businessName}
                      onChange={e => updateFormData('businessName', e.target.value)}
                      placeholder="Your company name"
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                        border: `1px solid ${errors.businessName ? '#ef4444' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        fontSize: '1rem',
                      }}
                    />
                  </div>
                  {errors.businessName && (
                    <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{errors.businessName}</span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Registration Number (optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Certificate size={20} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                    }} />
                    <input
                      type="text"
                      value={formData.registrationNumber}
                      onChange={e => updateFormData('registrationNumber', e.target.value)}
                      placeholder="Business registration number"
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '1rem',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Years in Business (optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.yearsInBusiness}
                    onChange={e => updateFormData('yearsInBusiness', e.target.value)}
                    placeholder="How long have you been in business?"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Physical Address *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={20} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '12px',
                      color: '#94a3b8',
                    }} />
                    <textarea
                      value={formData.physicalAddress}
                      onChange={e => updateFormData('physicalAddress', e.target.value)}
                      placeholder="Street address, building, etc."
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                        border: `1px solid ${errors.physicalAddress ? '#ef4444' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        fontSize: '1rem',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                  {errors.physicalAddress && (
                    <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{errors.physicalAddress}</span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    City *
                  </label>
                  <select
                    value={formData.city}
                    onChange={e => updateFormData('city', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${errors.city ? '#ef4444' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      fontSize: '1rem',
                      backgroundColor: 'white',
                    }}
                  >
                    <option value="">Select city</option>
                    {ZIMBABWE_CITIES.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  {errors.city && (
                    <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{errors.city}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Details */}
          {currentStep === 'contact' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                Contact Details
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Phone Number *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={20} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                    }} />
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={e => updateFormData('contactPhone', e.target.value)}
                      placeholder="+263 77 123 4567"
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                        border: `1px solid ${errors.contactPhone ? '#ef4444' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        fontSize: '1rem',
                      }}
                    />
                  </div>
                  {errors.contactPhone && (
                    <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{errors.contactPhone}</span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Email Address *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Envelope size={20} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                    }} />
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={e => updateFormData('contactEmail', e.target.value)}
                      placeholder="sales@yourcompany.co.zw"
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                        border: `1px solid ${errors.contactEmail ? '#ef4444' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        fontSize: '1rem',
                      }}
                    />
                  </div>
                  {errors.contactEmail && (
                    <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{errors.contactEmail}</span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Website (optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Globe size={20} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                    }} />
                    <input
                      type="url"
                      value={formData.website}
                      onChange={e => updateFormData('website', e.target.value)}
                      placeholder="https://yourcompany.co.zw"
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '1rem',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Customer References (optional)
                  </label>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.75rem' }}>
                    Provide up to 3 references we can contact
                  </p>
                  {formData.customerReferences.map((ref, index) => (
                    <input
                      key={index}
                      type="text"
                      value={ref}
                      onChange={e => {
                        const newRefs = [...formData.customerReferences];
                        newRefs[index] = e.target.value;
                        updateFormData('customerReferences', newRefs);
                      }}
                      placeholder={`Reference ${index + 1} (name & contact)`}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        marginBottom: '0.5rem',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Products & Delivery */}
          {currentStep === 'products' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                Products & Delivery
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Material Categories *
                  </label>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.75rem' }}>
                    Select all categories you supply
                  </p>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}>
                    {MATERIAL_CATEGORIES.map(category => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCategory(category)}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '20px',
                          border: formData.materialCategories.includes(category)
                            ? '2px solid #3b82f6'
                            : '1px solid #e2e8f0',
                          backgroundColor: formData.materialCategories.includes(category)
                            ? '#eff6ff'
                            : 'white',
                          color: formData.materialCategories.includes(category)
                            ? '#3b82f6'
                            : '#64748b',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  {errors.materialCategories && (
                    <span style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
                      {errors.materialCategories}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    <Truck size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Delivery Radius (km)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input
                      type="range"
                      min="1"
                      max="500"
                      value={formData.deliveryRadiusKm}
                      onChange={e => updateFormData('deliveryRadiusKm', parseInt(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{
                      minWidth: '60px',
                      padding: '0.5rem',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '4px',
                      textAlign: 'center',
                      fontWeight: 500,
                    }}>
                      {formData.deliveryRadiusKm} km
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    Maximum distance you can deliver from {formData.city || 'your location'}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    <CreditCard size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Payment Terms
                  </label>
                  <select
                    value={formData.paymentTerms}
                    onChange={e => updateFormData('paymentTerms', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      backgroundColor: 'white',
                    }}
                  >
                    <option value="">Select payment terms</option>
                    {PAYMENT_TERMS_OPTIONS.map(term => (
                      <option key={term} value={term}>{term}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Documents */}
          {currentStep === 'documents' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                Verification Documents
              </h2>
              <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>
                Uploading your documents helps us verify your business faster. You can submit now and upload later, but
                verification will only be completed once documents are reviewed.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    <Upload size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Business Registration / License
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleDocumentChange('businessLicense')}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      backgroundColor: 'white',
                    }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    {documentFiles.businessLicense ? `Selected: ${documentFiles.businessLicense.name}` : 'PDF or image file'}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    <Upload size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Tax Clearance (optional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleDocumentChange('taxClearance')}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      backgroundColor: 'white',
                    }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    {documentFiles.taxClearance ? `Selected: ${documentFiles.taxClearance.name}` : 'Optional but recommended'}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    <Upload size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Proof of Address (optional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleDocumentChange('proofOfAddress')}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      backgroundColor: 'white',
                    }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    {documentFiles.proofOfAddress ? `Selected: ${documentFiles.proofOfAddress.name}` : 'Utility bill, lease, or municipal statement'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 'review' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                Review Your Application
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  padding: '1rem',
                }}>
                  <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#475569' }}>
                    Business Information
                  </h3>
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <div><strong>Name:</strong> {formData.businessName}</div>
                    {formData.registrationNumber && (
                      <div><strong>Registration:</strong> {formData.registrationNumber}</div>
                    )}
                    {formData.yearsInBusiness && (
                      <div><strong>Years in Business:</strong> {formData.yearsInBusiness}</div>
                    )}
                    <div><strong>Address:</strong> {formData.physicalAddress}</div>
                    <div><strong>City:</strong> {formData.city}</div>
                  </div>
                </div>

                <div style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  padding: '1rem',
                }}>
                  <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#475569' }}>
                    Contact Details
                  </h3>
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <div><strong>Phone:</strong> {formData.contactPhone}</div>
                    <div><strong>Email:</strong> {formData.contactEmail}</div>
                    {formData.website && <div><strong>Website:</strong> {formData.website}</div>}
                  </div>
                </div>

                <div style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  padding: '1rem',
                }}>
                  <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#475569' }}>
                    Products & Delivery
                  </h3>
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <div>
                      <strong>Categories:</strong>
                      <div style={{ marginTop: '0.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {formData.materialCategories.map(cat => (
                          <span
                            key={cat}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#dbeafe',
                              color: '#1d4ed8',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                            }}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div><strong>Delivery Radius:</strong> {formData.deliveryRadiusKm} km</div>
                    {formData.paymentTerms && (
                      <div><strong>Payment Terms:</strong> {formData.paymentTerms}</div>
                    )}
                  </div>
                </div>

                <div style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  padding: '1rem',
                }}>
                  <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#475569' }}>
                    Verification Documents
                  </h3>
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <div>
                      <strong>Business License:</strong>{' '}
                      {documentFiles.businessLicense ? documentFiles.businessLicense.name : 'Not uploaded'}
                    </div>
                    <div>
                      <strong>Tax Clearance:</strong>{' '}
                      {documentFiles.taxClearance ? documentFiles.taxClearance.name : 'Not uploaded'}
                    </div>
                    <div>
                      <strong>Proof of Address:</strong>{' '}
                      {documentFiles.proofOfAddress ? documentFiles.proofOfAddress.name : 'Not uploaded'}
                    </div>
                  </div>
                </div>

                <div style={{
                  backgroundColor: '#fefce8',
                  border: '1px solid #fef08a',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  gap: '0.75rem',
                }}>
                  <Warning size={24} style={{ color: '#ca8a04', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.875rem', color: '#713f12' }}>
                    <strong>What happens next?</strong>
                    <p style={{ marginTop: '0.25rem' }}>
                      Our team will review your application within 2-3 business days.
                      Once approved, you&apos;ll be able to manage your product catalog and pricing.
                    </p>
                  </div>
                </div>

                {errors.submit && (
                  <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '1rem',
                    color: '#991b1b',
                    fontSize: '0.875rem',
                  }}>
                    {errors.submit}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #e2e8f0',
          }}>
            {currentStepIndex > 0 ? (
              <button
                onClick={goToPrevStep}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <ArrowLeft size={18} />
                Back
              </button>
            ) : (
              <div />
            )}

            {currentStep === 'review' ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 2rem',
                  backgroundColor: submitting ? '#94a3b8' : '#16a34a',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {submitting ? (
                  <>
                    <Spinner size={18} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Application
                    <Check size={18} weight="bold" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={goToNextStep}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Continue
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
