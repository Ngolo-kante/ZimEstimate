'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { getUsageHistory } from '@/lib/services/projects';
import { supabase } from '@/lib/supabase';
import type { MaterialUsage } from '@/lib/database.types';

/** The project's logged usage, kept current as builders log more. */
export function useUsageHistory(projectId: string, onUsageRecorded?: () => void | Promise<void>) {
  const { user } = useAuth();
  const { error: showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [usageHistory, setUsageHistory] = useState<MaterialUsage[]>([]);
  // Ref for debouncing realtime updates
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load usage history
  const loadUsage = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const { usage, error } = await getUsageHistory(projectId);
    if (error) {
      showError(error.message || 'Failed to load usage history');
    } else {
      setUsageHistory(usage);
    }
    setIsLoading(false);
  }, [projectId, showError, user?.id]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadUsage();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadUsage]);

  // Realtime subscription for material_usage changes
  useEffect(() => {
    const scheduleRefresh = () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        void loadUsage();
        onUsageRecorded?.();
      }, 250);
    };

    const channel = supabase
      .channel(`usage-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'material_usage',
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
  }, [loadUsage, projectId, onUsageRecorded]);

  return { isLoading, usageHistory, setUsageHistory };
}
