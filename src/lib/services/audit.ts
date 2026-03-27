// Audit log service for ZimEstimate
// Uses service role client to bypass RLS — server-side only

import { createServiceRoleClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface AuditEventOptions {
  userId: string | null;
  action: string;         // e.g. 'subscription.upgraded', 'user.suspended'
  resourceType: string;   // e.g. 'supplier_subscription', 'profile'
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAuditEvent(options: AuditEventOptions): Promise<void> {
  try {
    const adminClient = createServiceRoleClient();
    const { error } = await adminClient
      .from('system_audit_logs')
      .insert({
        user_id: options.userId,
        action: options.action,
        resource_type: options.resourceType,
        resource_id: options.resourceId ?? null,
        metadata: options.metadata ?? {},
        ip_address: options.ipAddress ?? null,
      } as never);

    if (error) {
      logger.error('audit: failed to write audit log', { error, action: options.action });
    }
  } catch (err) {
    // Audit log failures should never crash the caller
    logger.error('audit: unexpected error writing log', { err, action: options.action });
  }
}
