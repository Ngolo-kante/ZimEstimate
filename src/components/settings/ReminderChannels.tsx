'use client';

// Where reminders can reach you, and a button to prove each one works.
//
// Telegram is connected by opening the bot from here (no chat ID to find);
// SMS and WhatsApp use the phone number above; email uses the account
// address. Channels this deployment cannot send on yet are shown as such
// rather than offered and silently failing.

import { useEffect, useState } from 'react';
import { ChatCircleText, EnvelopeSimple, PaperPlaneTilt, TelegramLogo, WhatsappLogo, CircleNotch, CheckCircle } from '@phosphor-icons/react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

type Channel = 'email' | 'sms' | 'whatsapp' | 'telegram';

async function authorisedFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), ...(init.headers || {}) },
  });
}

export default function ReminderChannels({ phoneNumber }: { phoneNumber: string }) {
  const { profile, refreshProfile, updateProfile } = useAuth();
  const { success, error: showError } = useToast();
  const [available, setAvailable] = useState<Record<Channel, boolean> | null>(null);
  const [testing, setTesting] = useState<Channel | null>(null);
  const [connecting, setConnecting] = useState(false);
  const telegramConnected = Boolean(profile?.telegram_chat_id);

  useEffect(() => {
    fetch('/api/notifications/channels').then((r) => r.json()).then(setAvailable).catch(() => setAvailable(null));
  }, []);

  // Connecting happens in the Telegram app; pick up the result on return.
  useEffect(() => {
    if (!connecting) return;
    const onFocus = () => { void refreshProfile(); };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => { void refreshProfile(); }, 4000);
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(timer); };
  }, [connecting, refreshProfile]);

  useEffect(() => {
    if (connecting && telegramConnected) {
      setConnecting(false);
      success('Telegram connected. Reminders sent by Telegram will arrive there.');
    }
  }, [connecting, telegramConnected, success]);

  const sendTest = async (channel: Channel) => {
    setTesting(channel);
    try {
      const response = await authorisedFetch('/api/notifications/test', { method: 'POST', body: JSON.stringify({ channel }) });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.sent) success('Test sent — check your ' + (channel === 'email' ? 'inbox' : channel === 'telegram' ? 'Telegram' : 'phone') + '.');
      else showError(result.error || 'The test could not be sent.');
    } catch {
      showError('Could not reach the server.');
    } finally {
      setTesting(null);
    }
  };

  const connectTelegram = async () => {
    // Opened before the request so the browser does not block it as a pop-up.
    const tab = window.open('', '_blank');
    try {
      const response = await authorisedFetch('/api/telegram/link', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.error || 'Could not start connecting Telegram.');
      if (tab) tab.location.href = result.url; else window.location.href = result.url;
      setConnecting(true);
    } catch (error) {
      tab?.close();
      showError(error instanceof Error ? error.message : 'Could not start connecting Telegram.');
    }
  };

  const disconnectTelegram = async () => {
    const { error } = await updateProfile({ telegram_chat_id: null });
    if (error) showError('Could not disconnect Telegram.');
    else success('Telegram disconnected.');
  };

  const rows: { channel: Channel; icon: React.ReactNode; label: string; detail: string; ready: boolean; needs?: string }[] = [
    { channel: 'email', icon: <EnvelopeSimple size={18} />, label: 'Email', detail: profile?.email || '', ready: true },
    { channel: 'whatsapp', icon: <WhatsappLogo size={18} />, label: 'WhatsApp', detail: phoneNumber || 'Add your phone number above', ready: Boolean(phoneNumber), needs: 'phone' },
    { channel: 'sms', icon: <ChatCircleText size={18} />, label: 'SMS', detail: phoneNumber ? `${phoneNumber} · Econet and NetOne` : 'Add your phone number above', ready: Boolean(phoneNumber), needs: 'phone' },
    { channel: 'telegram', icon: <TelegramLogo size={18} />, label: 'Telegram', detail: telegramConnected ? 'Connected' : 'Not connected', ready: telegramConnected },
  ];

  return (
    <div className="channels">
      <div className="title">Where reminders can reach you</div>
      <p className="hint">Choose the channel when you set a reminder on a project. Send yourself a test first to be sure it arrives.</p>
      <ul>
        {rows.map((row) => {
          const offered = available ? available[row.channel] !== false : true;
          return (
            <li key={row.channel}>
              <span className="icon">{row.icon}</span>
              <span className="text">
                <strong>{row.label}</strong>
                <span>{offered ? row.detail : 'Not available yet'}</span>
              </span>
              {offered && row.channel === 'telegram' && !telegramConnected && (
                <button type="button" onClick={() => void connectTelegram()} disabled={connecting}>
                  {connecting ? <><CircleNotch size={14} className="spin" /> Waiting…</> : 'Connect'}
                </button>
              )}
              {offered && row.channel === 'telegram' && telegramConnected && (
                <button type="button" className="quiet" onClick={() => void disconnectTelegram()}>Disconnect</button>
              )}
              {offered && row.ready && (
                <button type="button" onClick={() => void sendTest(row.channel)} disabled={testing !== null} aria-label={`Send a test ${row.label} message`}>
                  {testing === row.channel ? <CircleNotch size={14} className="spin" /> : row.channel === 'telegram' && telegramConnected ? <CheckCircle size={14} /> : <PaperPlaneTilt size={14} />} Test
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {connecting && (
        <p className="hint">Press <strong>Start</strong> in Telegram, then come back here.</p>
      )}

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
        button.quiet { border-color: transparent; color: var(--color-text-secondary); }
        button:disabled { opacity: 0.6; cursor: default; }
        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
