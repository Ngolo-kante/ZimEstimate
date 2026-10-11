'use client';

// Where reminders can reach you, and a button to prove each one works.
//
// Email uses the account address; WhatsApp and SMS use the phone number
// above. Email and WhatsApp come first — they are what people here use.
// Telegram was offered too and is set aside for now. Channels this
// deployment cannot send on yet are shown as such
// rather than offered and silently failing.

import { useState } from 'react';
import { useReminderChannels } from '@/hooks/useReminderChannels';
import { ChatCircleText, EnvelopeSimple, PaperPlaneTilt, WhatsappLogo, CircleNotch } from '@phosphor-icons/react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

type Channel = 'email' | 'whatsapp' | 'sms';

async function authorisedFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), ...(init.headers || {}) },
  });
}

export default function ReminderChannels({ phoneNumber }: { phoneNumber: string }) {
  const { profile } = useAuth();
  const { success, error: showError } = useToast();
  // Only channels that can send now: email until WhatsApp is set up.
  const available = useReminderChannels();
  const [testing, setTesting] = useState<Channel | null>(null);

  const sendTest = async (channel: Channel) => {
    setTesting(channel);
    try {
      const response = await authorisedFetch('/api/notifications/test', { method: 'POST', body: JSON.stringify({ channel }) });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.sent) success(`Test sent — check your ${channel === 'email' ? 'inbox' : channel === 'whatsapp' ? 'WhatsApp' : 'messages'}.`);
      else showError(result.error || 'The test could not be sent.');
    } catch {
      showError('Could not reach the server.');
    } finally {
      setTesting(null);
    }
  };

  const rows: { channel: Channel; icon: React.ReactNode; label: string; detail: string; ready: boolean }[] = [
    { channel: 'email', icon: <EnvelopeSimple size={18} />, label: 'Email', detail: profile?.email || '', ready: Boolean(profile?.email) },
    { channel: 'whatsapp', icon: <WhatsappLogo size={18} />, label: 'WhatsApp', detail: phoneNumber || 'Add your phone number above', ready: Boolean(phoneNumber) },
    { channel: 'sms', icon: <ChatCircleText size={18} />, label: 'SMS', detail: phoneNumber ? `${phoneNumber} · Econet and NetOne` : 'Add your phone number above', ready: Boolean(phoneNumber) },
  ];

  return (
    <div className="channels">
      <div className="title">Where reminders can reach you</div>
      <p className="hint">
        {available.length > 1
          ? 'Choose the channel when you set a reminder on a project. Send yourself a test first to be sure it arrives.'
          : 'Project reminders are sent to your email. Send yourself a test to be sure they arrive (check spam the first time).'}
      </p>
      <ul>
        {rows.filter((row) => available.includes(row.channel)).map((row) => (
            <li key={row.channel}>
              <span className="icon">{row.icon}</span>
              <span className="text">
                <strong>{row.label}</strong>
                <span>{row.detail}</span>
              </span>
              {row.ready && (
                <button type="button" onClick={() => void sendTest(row.channel)} disabled={testing !== null} aria-label={`Send a test ${row.label} message`}>
                  {testing === row.channel ? <CircleNotch size={14} className="spin" /> : <PaperPlaneTilt size={14} />} Test
                </button>
              )}
            </li>
        ))}
      </ul>

      <style jsx>{`
        .channels { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--color-border-light, var(--color-border)); }
        .title { font-size: 0.8rem; font-weight: 700; color: var(--color-text); text-transform: uppercase; letter-spacing: 0.04em; }
        .hint { margin: 4px 0 10px; font-size: 0.8rem; color: var(--color-text-secondary); }
        ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); }
        .icon { display: inline-flex; color: var(--color-text-secondary); }
        .text { flex: 1; min-width: 0; display: grid; }
        .text strong { font-size: 0.88rem; color: var(--color-text); }
        .text span { font-size: 0.78rem; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-size: 0.78rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
        button:disabled { opacity: 0.6; cursor: default; }
        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
