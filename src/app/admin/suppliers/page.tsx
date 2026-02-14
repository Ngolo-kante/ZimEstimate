'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Storefront,
  CheckCircle,
  XCircle,
  Eye,
  ArrowLeft,
  Spinner,
  MagnifyingGlass,
  Funnel,
  Phone,
  Envelope,
  MapPin,
  Globe,
  Calendar,
  X,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import type { SupplierApplication, SupplierApplicationStatus, SupplierDocument } from '@/lib/database.types';
import {
  getSupplierApplicationDocuments,
  notifySupplierApplicationStatus,
  reviewSupplierDocument,
} from '@/lib/services/suppliers';

type FilterStatus = SupplierApplicationStatus | 'all';

const STATUS_CONFIG: Record<SupplierApplicationStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: '#f59e0b', bgColor: '#fef3c7' },
  under_review: { label: 'Under Review', color: '#3b82f6', bgColor: '#dbeafe' },
  approved: { label: 'Approved', color: '#16a34a', bgColor: '#dcfce7' },
  rejected: { label: 'Rejected', color: '#ef4444', bgColor: '#fef2f2' },
};

const DOCUMENT_LABELS: Record<string, string> = {
  business_license: 'Business License',
  tax_clearance: 'Tax Clearance',
  proof_of_address: 'Proof of Address',
  bank_confirmation: 'Bank Confirmation',
  other: 'Other Document',
};

export default function AdminSuppliersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<SupplierApplication[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState<SupplierApplication | null>(null);
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentActionId, setDocumentActionId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const loadApplications = async () => {
    setLoading(true);

    let query = supabase
      .from('supplier_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading applications:', error);
    } else {
      setApplications((data || []) as SupplierApplication[]);
    }

    setLoading(false);
  };

  const loadDocuments = async (applicationId: string) => {
    setDocumentsLoading(true);
    const docs = await getSupplierApplicationDocuments(applicationId);
    setDocuments(docs);
    setDocumentsLoading(false);
  };

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();

      const profileData = profile as { tier: string } | null;
      if (!profileData || profileData.tier !== 'admin') {
        router.push('/');
        return;
      }

      // Load applications
      await loadApplications();
    }

    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!loading) {
      loadApplications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  useEffect(() => {
    if (!selectedApp) {
      setDocuments([]);
      return;
    }
    loadDocuments(selectedApp.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApp?.id]);

  const filteredApplications = applications.filter(app =>
    app.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApprove = async (applicationId: string) => {
    if (!confirm('Approve this supplier application?')) return;

    setProcessing(true);

    const { data: { user } } = await supabase.auth.getUser();

    // Call the approval function
    const { error } = await supabase.rpc('approve_supplier_application' as never, {
      p_application_id: applicationId,
      p_reviewer_id: user?.id,
    } as never);

    setProcessing(false);

    if (error) {
      console.error('Error approving application:', error);
      alert('Failed to approve application: ' + error.message);
    } else {
      const application = applications.find(app => app.id === applicationId) || selectedApp;
      if (application) {
        await notifySupplierApplicationStatus(application, 'approved');
      }
      await loadApplications();
      setSelectedApp(null);
    }
  };

  const handleReject = async () => {
    if (!selectedApp || !rejectionReason.trim()) return;

    setProcessing(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.rpc('reject_supplier_application' as never, {
      p_application_id: selectedApp.id,
      p_reviewer_id: user?.id,
      p_reason: rejectionReason,
    } as never);

    setProcessing(false);

    if (error) {
      console.error('Error rejecting application:', error);
      alert('Failed to reject application: ' + error.message);
    } else {
      await notifySupplierApplicationStatus(selectedApp, 'rejected', rejectionReason.trim());
      await loadApplications();
      setSelectedApp(null);
      setShowRejectModal(false);
      setRejectionReason('');
    }
  };

  const handleMarkUnderReview = async (applicationId: string) => {
    const { error } = await supabase
      .from('supplier_applications')
      .update({ status: 'under_review' } as never)
      .eq('id', applicationId);

    if (error) {
      console.error('Error updating status:', error);
    } else {
      const application = applications.find(app => app.id === applicationId) || selectedApp;
      if (application) {
        await notifySupplierApplicationStatus(application, 'under_review');
      }
      await loadApplications();
    }
  };

  const handleDocumentReview = async (documentId: string, status: 'verified' | 'rejected') => {
    if (!selectedApp) return;
    const notes = status === 'rejected'
      ? prompt('Reason for rejecting this document?')?.trim() || null
      : null;

    setDocumentActionId(documentId);

    const { data: { user } } = await supabase.auth.getUser();
    const result = await reviewSupplierDocument(documentId, {
      status,
      reviewerId: user?.id,
      notes,
    });

    setDocumentActionId(null);

    if (!result.success) {
      alert(result.error || 'Failed to update document status.');
      return;
    }

    await loadDocuments(selectedApp.id);
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
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '1.5rem 2rem',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
        }}>
          <Link
            href="/dashboard"
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Supplier Applications
              </h1>
              <p style={{ color: '#64748b' }}>
                Review and manage supplier registration requests
              </p>
            </div>
            <div style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#7c3aed',
              color: 'white',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}>
              Admin Panel
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '1rem 2rem',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '300px' }}>
            <MagnifyingGlass size={20} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search applications..."
              style={{
                width: '100%',
                padding: '0.5rem 0.5rem 0.5rem 2.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Funnel size={18} style={{ color: '#64748b' }} />
            {(['all', 'pending', 'under_review', 'approved', 'rejected'] as FilterStatus[]).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: filterStatus === status ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  backgroundColor: filterStatus === status ? '#eff6ff' : 'white',
                  color: filterStatus === status ? '#3b82f6' : '#64748b',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontWeight: filterStatus === status ? 600 : 400,
                }}
              >
                {status === 'all' ? 'All' : STATUS_CONFIG[status].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '2rem',
        display: 'grid',
        gridTemplateColumns: selectedApp ? '1fr 400px' : '1fr',
        gap: '2rem',
      }}>
        {/* Applications List */}
        <div>
          {filteredApplications.length === 0 ? (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '3rem',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
              <Storefront size={48} style={{ color: '#94a3b8', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                No applications found
              </h3>
              <p style={{ color: '#64748b' }}>
                {filterStatus === 'all'
                  ? 'No supplier applications have been submitted yet.'
                  : `No ${STATUS_CONFIG[filterStatus as SupplierApplicationStatus].label.toLowerCase()} applications.`}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredApplications.map(app => {
                const statusConfig = STATUS_CONFIG[app.status];
                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      border: selectedApp?.id === app.id ? '2px solid #3b82f6' : '2px solid transparent',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          {app.business_name}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                          {app.city && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <MapPin size={14} />
                              {app.city}
                            </span>
                          )}
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Calendar size={14} />
                            {new Date(app.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        backgroundColor: statusConfig.bgColor,
                        color: statusConfig.color,
                      }}>
                        {statusConfig.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {app.material_categories?.slice(0, 4).map(cat => (
                        <span
                          key={cat}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#f1f5f9',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: '#64748b',
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                      {(app.material_categories?.length || 0) > 4 && (
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          color: '#64748b',
                        }}>
                          +{(app.material_categories?.length || 0) - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedApp && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            position: 'sticky',
            top: '2rem',
            maxHeight: 'calc(100vh - 4rem)',
            overflowY: 'auto',
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ fontWeight: 600 }}>Application Details</h3>
              <button
                onClick={() => setSelectedApp(null)}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {/* Business Info */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '0.75rem' }}>
                  Business Information
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Business Name</div>
                    <div style={{ fontWeight: 500 }}>{selectedApp.business_name}</div>
                  </div>
                  {selectedApp.registration_number && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Registration Number</div>
                      <div>{selectedApp.registration_number}</div>
                    </div>
                  )}
                  {selectedApp.years_in_business && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Years in Business</div>
                      <div>{selectedApp.years_in_business}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Address</div>
                    <div>{selectedApp.physical_address}</div>
                    <div style={{ color: '#64748b' }}>{selectedApp.city}</div>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '0.75rem' }}>
                  Contact Details
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedApp.contact_phone && (
                    <a
                      href={`tel:${selectedApp.contact_phone}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', textDecoration: 'none' }}
                    >
                      <Phone size={16} />
                      {selectedApp.contact_phone}
                    </a>
                  )}
                  {selectedApp.contact_email && (
                    <a
                      href={`mailto:${selectedApp.contact_email}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', textDecoration: 'none' }}
                    >
                      <Envelope size={16} />
                      {selectedApp.contact_email}
                    </a>
                  )}
                  {selectedApp.website && (
                    <a
                      href={selectedApp.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', textDecoration: 'none' }}
                    >
                      <Globe size={16} />
                      {selectedApp.website}
                    </a>
                  )}
                </div>
              </div>

              {/* Categories */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '0.75rem' }}>
                  Material Categories
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedApp.material_categories?.map(cat => (
                    <span
                      key={cat}
                      style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: '#eff6ff',
                        color: '#3b82f6',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Delivery & Payment */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '0.75rem' }}>
                  Delivery & Payment
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Delivery Radius:</span> {selectedApp.delivery_radius_km} km
                  </div>
                  {selectedApp.payment_terms && (
                    <div>
                      <span style={{ color: '#64748b' }}>Payment Terms:</span> {selectedApp.payment_terms}
                    </div>
                  )}
                </div>
              </div>

              {/* References */}
              {selectedApp.customer_references && selectedApp.customer_references.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '0.75rem' }}>
                    Customer References
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569' }}>
                    {selectedApp.customer_references.map((ref, i) => (
                      <li key={i}>{ref}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Documents */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '0.75rem' }}>
                  Documents
                </h4>
                {documentsLoading ? (
                  <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading documents...</div>
                ) : documents.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No documents uploaded yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {documents.map((doc) => {
                      const statusColor = doc.status === 'verified'
                        ? '#16a34a'
                        : doc.status === 'rejected'
                          ? '#ef4444'
                          : '#f59e0b';
                      return (
                        <div
                          key={doc.id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>
                            {DOCUMENT_LABELS[doc.document_type] || doc.document_type}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {doc.file_name || 'Document'}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {doc.file_url && (
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: '0.75rem', color: '#2563eb', textDecoration: 'none' }}
                              >
                                View file
                              </a>
                            )}
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '999px',
                              backgroundColor: `${statusColor}15`,
                              color: statusColor,
                            }}>
                              {doc.status.toUpperCase()}
                            </span>
                            {doc.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleDocumentReview(doc.id, 'verified')}
                                  disabled={documentActionId === doc.id}
                                  style={{
                                    border: 'none',
                                    backgroundColor: '#dcfce7',
                                    color: '#15803d',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    cursor: documentActionId === doc.id ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  Verify
                                </button>
                                <button
                                  onClick={() => handleDocumentReview(doc.id, 'rejected')}
                                  disabled={documentActionId === doc.id}
                                  style={{
                                    border: '1px solid #fecaca',
                                    backgroundColor: '#fef2f2',
                                    color: '#b91c1c',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    cursor: documentActionId === doc.id ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                          {doc.notes && (
                            <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
                              Notes: {doc.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              {(selectedApp.status === 'pending' || selectedApp.status === 'under_review') && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #e2e8f0',
                }}>
                  {selectedApp.status === 'pending' && (
                    <button
                      onClick={() => handleMarkUnderReview(selectedApp.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem',
                        backgroundColor: '#dbeafe',
                        color: '#1d4ed8',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      <Eye size={18} />
                      Mark as Under Review
                    </button>
                  )}
                  <button
                    onClick={() => handleApprove(selectedApp.id)}
                    disabled={processing}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem',
                      backgroundColor: processing ? '#94a3b8' : '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: processing ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {processing ? (
                      <Spinner size={18} className="animate-spin" />
                    ) : (
                      <CheckCircle size={18} weight="bold" />
                    )}
                    Approve Application
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem',
                      backgroundColor: '#fef2f2',
                      color: '#ef4444',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    <XCircle size={18} />
                    Reject Application
                  </button>
                </div>
              )}

              {/* Show rejection reason if rejected */}
              {selectedApp.status === 'rejected' && selectedApp.rejection_reason && (
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#fef2f2',
                  borderRadius: '8px',
                  marginTop: '1rem',
                }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.5rem' }}>
                    Rejection Reason
                  </div>
                  <p style={{ color: '#7f1d1d', margin: 0 }}>{selectedApp.rejection_reason}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            margin: '1rem',
          }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              Reject Application
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>
              Please provide a reason for rejecting this application.
            </p>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem',
                resize: 'vertical',
                marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  backgroundColor: processing || !rejectionReason.trim() ? '#94a3b8' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: processing || !rejectionReason.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {processing && <Spinner size={18} className="animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
