'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Storefront,
  MapPin,
  Phone,
  Envelope,
  Globe,
  Truck,
  CreditCard,
  Spinner,
  Check,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import {
  getUserSupplierProfile,
  updateSupplierProfile,
  MATERIAL_CATEGORIES,
  PAYMENT_TERMS_OPTIONS,
  ZIMBABWE_CITIES,
} from '@/lib/services/suppliers';
import type { Supplier } from '@/lib/database.types';

export default function EditSupplierProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    physicalAddress: '',
    contactPhone: '',
    contactEmail: '',
    website: '',
    deliveryRadiusKm: 50,
    materialCategories: [] as string[],
    paymentTerms: '',
  });

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      const supplierProfile = await getUserSupplierProfile(user.id);

      if (!supplierProfile) {
        router.push('/supplier/register');
        return;
      }

      setSupplier(supplierProfile);
      setFormData({
        name: supplierProfile.name || '',
        location: supplierProfile.location || '',
        physicalAddress: supplierProfile.physical_address || '',
        contactPhone: supplierProfile.contact_phone || '',
        contactEmail: supplierProfile.contact_email || '',
        website: supplierProfile.website || '',
        deliveryRadiusKm: supplierProfile.delivery_radius_km || 50,
        materialCategories: supplierProfile.material_categories || [],
        paymentTerms: supplierProfile.payment_terms || '',
      });

      setLoading(false);
    }

    loadData();
  }, [router]);

  const updateField = (field: string, value: string | number | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Business name is required';
    }
    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = 'Phone number is required';
    }
    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Email is required';
    }
    if (formData.materialCategories.length === 0) {
      newErrors.materialCategories = 'Select at least one category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!supplier || !validate()) return;

    setSaving(true);
    setSuccess(false);

    const result = await updateSupplierProfile(supplier.id, {
      name: formData.name,
      location: formData.location || undefined,
      physical_address: formData.physicalAddress || undefined,
      contact_phone: formData.contactPhone,
      contact_email: formData.contactEmail,
      website: formData.website || undefined,
      delivery_radius_km: formData.deliveryRadiusKm,
      material_categories: formData.materialCategories,
      payment_terms: formData.paymentTerms || undefined,
    });

    setSaving(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setErrors({ save: result.error || 'Failed to save changes' });
    }
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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link
            href="/supplier/dashboard"
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
            Back to Dashboard
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Edit Profile</h1>
        </div>

        {/* Success Message */}
        {success && (
          <div style={{
            backgroundColor: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#166534',
          }}>
            <Check size={20} weight="bold" />
            Profile updated successfully!
          </div>
        )}

        {/* Form */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Business Name */}
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
                  value={formData.name}
                  onChange={e => updateField('name', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    border: `1px solid ${errors.name ? '#ef4444' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              {errors.name && (
                <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{errors.name}</span>
              )}
            </div>

            {/* Location */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                City
              </label>
              <select
                value={formData.location}
                onChange={e => updateField('location', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
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
            </div>

            {/* Physical Address */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Physical Address
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
                  onChange={e => updateField('physicalAddress', e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

            {/* Contact Phone */}
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
                  onChange={e => updateField('contactPhone', e.target.value)}
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

            {/* Contact Email */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Email *
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
                  onChange={e => updateField('contactEmail', e.target.value)}
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

            {/* Website */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Website
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
                  onChange={e => updateField('website', e.target.value)}
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

            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

            {/* Material Categories */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Material Categories *
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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

            {/* Delivery Radius */}
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
                  onChange={e => updateField('deliveryRadiusKm', parseInt(e.target.value))}
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
            </div>

            {/* Payment Terms */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                <CreditCard size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Payment Terms
              </label>
              <select
                value={formData.paymentTerms}
                onChange={e => updateField('paymentTerms', e.target.value)}
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

            {/* Error Message */}
            {errors.save && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '1rem',
                color: '#991b1b',
                fontSize: '0.875rem',
              }}>
                {errors.save}
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '1rem',
                backgroundColor: saving ? '#94a3b8' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? (
                <>
                  <Spinner size={20} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={20} weight="bold" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
