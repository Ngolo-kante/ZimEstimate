import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type {
  NotificationDelivery,
  NotificationDeliveryInsert,
  PushSubscriptionInsert,
  Profile,
} from '@/lib/database.types';

// TYPE-003 FIX: Removed `as any` cast - use supabase directly with proper types

export type NotificationChannel = 'email' | 'whatsapp' | 'push';
export type NotificationTemplateKey =
  | 'rfq_received'
  | 'quote_submitted'
  | 'quote_accepted'
  | 'price_drop'
  | 'project_reminder'
  | 'supplier_application_submitted'
  | 'supplier_application_under_review'
  | 'supplier_application_approved'
  | 'supplier_application_rejected'
  | 'supplier_reverification_due'
  | 'subscription_upgraded'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'subscription_payment_failed'
  | 'subscription_expiring_soon';

type TemplateVariant = {
  title: string;
  body: string;
};

type NotificationTemplate = {
  description: string;
  email: TemplateVariant;
  whatsapp: TemplateVariant;
  push: TemplateVariant;
};

const templates: Record<NotificationTemplateKey, NotificationTemplate> = {
  rfq_received: {
    description: 'Supplier receives a new RFQ request',
    email: {
      title: 'New RFQ request from {{projectName}}',
      body: 'You received a new RFQ ({{rfqId}}) for {{itemCount}} items. Required by {{requiredBy}}.',
    },
    whatsapp: {
      title: 'New RFQ request',
      body: 'New RFQ ({{rfqId}}) from {{projectName}}. {{itemCount}} items. Due {{requiredBy}}.',
    },
    push: {
      title: 'New RFQ request',
      body: 'RFQ {{rfqId}} needs your quote by {{requiredBy}}.',
    },
  },
  quote_submitted: {
    description: 'Builder receives a supplier quote',
    email: {
      title: 'New quote received for {{projectName}}',
      body: '{{supplierName}} submitted a quote for RFQ {{rfqId}}.',
    },
    whatsapp: {
      title: 'Quote submitted',
      body: '{{supplierName}} sent a quote for RFQ {{rfqId}}.',
    },
    push: {
      title: 'Quote received',
      body: '{{supplierName}} submitted a quote for RFQ {{rfqId}}.',
    },
  },
  quote_accepted: {
    description: 'Supplier notified their quote was accepted',
    email: {
      title: 'Your quote was accepted',
      body: 'Good news! Your quote for RFQ {{rfqId}} was accepted by {{projectName}}.',
    },
    whatsapp: {
      title: 'Quote accepted',
      body: 'Your quote for RFQ {{rfqId}} was accepted by {{projectName}}.',
    },
    push: {
      title: 'Quote accepted',
      body: 'Your RFQ {{rfqId}} quote was accepted.',
    },
  },
  price_drop: {
    description: 'Watched material price drop alert',
    email: {
      title: 'Price drop for {{materialName}}',
      body: '{{materialName}} dropped to {{price}}. View details in the marketplace.',
    },
    whatsapp: {
      title: 'Price drop alert',
      body: '{{materialName}} is now {{price}}. Check the marketplace for details.',
    },
    push: {
      title: 'Price drop alert',
      body: '{{materialName}} is now {{price}}.',
    },
  },
  project_reminder: {
    description: 'Project reminder notification',
    email: {
      title: 'Project reminder: {{projectName}}',
      body: '{{message}}',
    },
    whatsapp: {
      title: 'Project reminder',
      body: '{{message}}',
    },
    push: {
      title: 'Project reminder',
      body: '{{message}}',
    },
  },
  supplier_application_submitted: {
    description: 'Supplier application confirmation',
    email: {
      title: 'We received your supplier application',
      body: 'Thanks for registering {{businessName}}. Our team will review your documents and get back to you within 3-5 days.',
    },
    whatsapp: {
      title: 'Supplier application received',
      body: 'We received your supplier application for {{businessName}}. Review takes 3-5 days.',
    },
    push: {
      title: 'Application received',
      body: 'We received your supplier application for {{businessName}}.',
    },
  },
  supplier_application_under_review: {
    description: 'Supplier application moved to review',
    email: {
      title: 'Your supplier application is under review',
      body: '{{businessName}} is now under review. We will notify you once verification is complete.',
    },
    whatsapp: {
      title: 'Application under review',
      body: '{{businessName}} is under review. We will update you once verification is complete.',
    },
    push: {
      title: 'Application under review',
      body: '{{businessName}} is under review.',
    },
  },
  supplier_application_approved: {
    description: 'Supplier application approved',
    email: {
      title: 'Your supplier application was approved',
      body: 'Congratulations! {{businessName}} has been approved. You can now access your supplier dashboard.',
    },
    whatsapp: {
      title: 'Application approved',
      body: 'Congrats! {{businessName}} is approved. You can now access your supplier dashboard.',
    },
    push: {
      title: 'Application approved',
      body: '{{businessName}} is now approved.',
    },
  },
  supplier_application_rejected: {
    description: 'Supplier application rejected',
    email: {
      title: 'Update on your supplier application',
      body: 'We could not approve {{businessName}} at this time. Reason: {{reason}}. You can re-apply once updates are ready.',
    },
    whatsapp: {
      title: 'Application update',
      body: 'We could not approve {{businessName}}. Reason: {{reason}}. You can re-apply once ready.',
    },
    push: {
      title: 'Application update',
      body: '{{businessName}} was not approved. Reason: {{reason}}.',
    },
  },
  supplier_reverification_due: {
    description: 'Supplier re-verification due',
    email: {
      title: 'Supplier re-verification due',
      body: '{{businessName}} is due for annual verification. Please upload updated documents by {{dueDate}}.',
    },
    whatsapp: {
      title: 'Re-verification due',
      body: '{{businessName}} is due for annual verification. Upload updated documents by {{dueDate}}.',
    },
    push: {
      title: 'Re-verification due',
      body: '{{businessName}} verification due by {{dueDate}}.',
    },
  },
  subscription_upgraded: {
    description: 'Supplier upgrades their subscription plan',
    email: {
      title: 'Welcome to {{planName}}!',
      body: 'Your ZimEstimate subscription has been upgraded to {{planName}}. Your new features are now active.',
    },
    whatsapp: {
      title: 'Plan upgraded',
      body: 'Your ZimEstimate plan has been upgraded to {{planName}}. New features are now active.',
    },
    push: {
      title: 'Plan upgraded to {{planName}}',
      body: 'Your new features are now active.',
    },
  },
  subscription_renewed: {
    description: 'Supplier subscription successfully renewed',
    email: {
      title: 'Subscription renewed — {{planName}}',
      body: 'Your {{planName}} subscription has been renewed. Next billing date: {{nextBillingDate}}.',
    },
    whatsapp: {
      title: 'Subscription renewed',
      body: '{{planName}} subscription renewed. Next billing: {{nextBillingDate}}.',
    },
    push: {
      title: 'Subscription renewed',
      body: '{{planName}} renewed. Next billing: {{nextBillingDate}}.',
    },
  },
  subscription_cancelled: {
    description: 'Supplier cancels their subscription',
    email: {
      title: 'Subscription cancelled',
      body: 'Your {{planName}} subscription has been cancelled. Access continues until {{expiryDate}}.',
    },
    whatsapp: {
      title: 'Subscription cancelled',
      body: '{{planName}} cancelled. Access until {{expiryDate}}.',
    },
    push: {
      title: 'Subscription cancelled',
      body: 'Access continues until {{expiryDate}}.',
    },
  },
  subscription_payment_failed: {
    description: 'Supplier payment attempt failed',
    email: {
      title: 'Payment failed — action required',
      body: 'Your payment for {{planName}} failed. Please update your payment method to keep your subscription active.',
    },
    whatsapp: {
      title: 'Payment failed',
      body: '{{planName}} payment failed. Update your payment method to avoid losing access.',
    },
    push: {
      title: 'Payment failed',
      body: 'Update your payment method to keep {{planName}} access.',
    },
  },
  subscription_expiring_soon: {
    description: 'Supplier subscription expires in 3 days',
    email: {
      title: 'Your subscription expires soon',
      body: 'Your {{planName}} subscription expires on {{expiryDate}}. Renew now to keep your features.',
    },
    whatsapp: {
      title: 'Subscription expiring soon',
      body: '{{planName}} expires on {{expiryDate}}. Renew to keep your features.',
    },
    push: {
      title: 'Subscription expiring soon',
      body: '{{planName}} expires {{expiryDate}}.',
    },
  },
};

function renderString(template: string, data: Record<string, string | number | null | undefined>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = data[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

/** Render a notification template by key and channel. */
export function renderNotificationTemplate(
  key: NotificationTemplateKey,
  channel: NotificationChannel,
  data: Record<string, string | number | null | undefined>
): TemplateVariant {
  const template = templates[key];
  const variant = template[channel];
  return {
    title: renderString(variant.title, data),
    body: renderString(variant.body, data),
  };
}

/** Fetch recent notification deliveries for a user. */
export async function getNotificationDeliveries(
  userId: string,
  limit = 10
): Promise<{ deliveries: NotificationDelivery[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('notification_deliveries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { deliveries: [], error: new Error(error.message) };
  }

  return { deliveries: (data || []) as NotificationDelivery[], error: null };
}

/** Queue a delivery record for a notification. */
export async function queueNotificationDelivery(
  payload: NotificationDeliveryInsert
): Promise<{ delivery: NotificationDelivery | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('notification_deliveries')
    .insert(payload as never)
    .select('*')
    .single();

  if (error) {
    // ERR-002 FIX: Log error for debugging rather than silent failure
    logger.error('Notifications: failed to queue delivery', { error });
    return { delivery: null, error: new Error(error.message) };
  }

  return { delivery: data as NotificationDelivery, error: null };
}

/** Fetch notification preferences for a user. */
export async function getNotificationPreferences(userId: string): Promise<{
  preferences: Pick<Profile, 'notify_email' | 'notify_whatsapp' | 'notify_push' | 'notify_rfq' | 'notify_quote_updates' | 'notify_price_alerts' | 'notify_project_reminders'> | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('notify_email, notify_whatsapp, notify_push, notify_rfq, notify_quote_updates, notify_price_alerts, notify_project_reminders')
    .eq('id', userId)
    .single();

  if (error) {
    return { preferences: null, error: new Error(error.message) };
  }

  return { preferences: data as Profile, error: null };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/** Register the current browser for push notifications. */
export async function subscribeToPushNotifications(): Promise<{ subscription: globalThis.PushSubscription | null; error: Error | null }> {
  // NOTIF-001 FIX: Add browser feature detection and proper error handling
  if (typeof window === 'undefined') {
    return { subscription: null, error: new Error('Push not supported') };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { subscription: null, error: new Error('Push not supported') };
  }

  // Check if Notification API is available
  if (!('Notification' in window)) {
    return { subscription: null, error: new Error('Notifications not supported') };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { subscription: null, error: new Error('Notification permission not granted') };
    }
  } catch (permError) {
    logger.error('Notifications: permission request failed', { error: permError });
    return { subscription: null, error: new Error('Failed to request notification permission') };
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return { subscription: null, error: new Error('Missing VAPID public key') };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const json = subscription.toJSON();
    const keys = json.keys || {};

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      return { subscription: null, error: new Error('Not authenticated') };
    }

    const payload: PushSubscriptionInsert = {
      user_id: authData.user.id,
      endpoint: json.endpoint || '',
      p256dh: (keys.p256dh as string) || null,
      auth: (keys.auth as string) || null,
      user_agent: navigator.userAgent,
    };

    const { error: insertError } = await supabase.from('push_subscriptions').insert(payload as never);
    if (insertError) {
      logger.error('Notifications: failed to store subscription', { error: insertError });
      return { subscription: null, error: new Error('Failed to save subscription') };
    }

    return { subscription, error: null };
  } catch (subError) {
    logger.error('Notifications: subscription failed', { error: subError });
    return { subscription: null, error: new Error('Failed to subscribe to push notifications') };
  }
}

/** Remove the current browser push subscription. */
export async function unsubscribeFromPushNotifications(): Promise<{ error: Error | null }> {
  if (typeof window === 'undefined') {
    return { error: null };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await subscription.unsubscribe();
  }

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { error: null };
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', authData.user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}
