'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { getSuppliers, getProjectDocuments } from '@/lib/services/projects';
import { getProjectRfqs, type RfqWithDetails } from '@/lib/services/rfq';
import { supabase } from '@/lib/supabase';
import type { ProjectDocument, Supplier } from '@/lib/database.types';

/**
 * Quote requests, suppliers and receipts; purchases are owned by the workspace.
 * Reload when quotes or documents change elsewhere.
 */
export function useProcurementData(projectId: string) {
  const { error: showError } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rfqs, setRfqs] = useState<RfqWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receiptDocs, setReceiptDocs] = useState<ProjectDocument[]>([]);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [rfqsData, suppliersData, receiptsData] = await Promise.all([
        getProjectRfqs(projectId),
        getSuppliers(),
        getProjectDocuments(projectId, 'receipt'),
      ]);

      const requestError = rfqsData.error || suppliersData.error || receiptsData.error;
      if (requestError) throw requestError;

      setRfqs(rfqsData.rfqs);
      setSuppliers(suppliersData.suppliers);
      setReceiptDocs(receiptsData.documents);
    } catch (err) {
      console.error('Failed to load procurement data:', err);
      setLoadError('Procurement data could not be loaded. Check your connection and try again.');
      showError('Failed to load procurement data');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, showError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        void loadData();
      }, 250);
    };

    const channel = supabase
      .channel(`procurement-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rfq_requests',
          filter: `project_id=eq.${projectId}`,
        },
        () => scheduleRefresh()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_documents',
          filter: `project_id=eq.${projectId}`,
        },
        () => scheduleRefresh()
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadData, projectId]);

  return { isLoading, loadError, loadData, rfqs, suppliers, receiptDocs, setReceiptDocs };
}
