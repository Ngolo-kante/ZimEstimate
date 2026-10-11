'use client';

// The reminder channels this deployment can actually send on, in the order
// to offer them. Email always; WhatsApp and SMS only once their provider
// settings are in place (see docs/launch/reminder-channels-setup.md) — so a
// channel appears in the pickers the day it starts working, and nobody is
// offered one that would silently never arrive.

import { useEffect, useState } from 'react';
import type { NotificationChannel } from '@/components/ui/BudgetPlanner';

const ORDER: NotificationChannel[] = ['email', 'whatsapp', 'sms'];
const EMAIL_ONLY: NotificationChannel[] = ['email'];

let cached: NotificationChannel[] | null = null;
let inflight: Promise<NotificationChannel[]> | null = null;

function load(): Promise<NotificationChannel[]> {
  if (cached) return Promise.resolve(cached);
  inflight ??= fetch('/api/notifications/channels')
    .then((response) => response.json())
    .then((status: Partial<Record<NotificationChannel, boolean>>) => {
      // Email is offered even if the check fails: it is the one that works.
      cached = ORDER.filter((channel) => channel === 'email' || status[channel] === true);
      return cached;
    })
    .catch(() => EMAIL_ONLY)
    .finally(() => { inflight = null; });
  return inflight;
}

export function useReminderChannels(): NotificationChannel[] {
  const [channels, setChannels] = useState<NotificationChannel[]>(cached ?? EMAIL_ONLY);
  useEffect(() => {
    let active = true;
    void load().then((list) => { if (active) setChannels(list); });
    return () => { active = false; };
  }, []);
  return channels;
}
