'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getBrowserSiteUrl } from '@/lib/siteUrl';
import { RESEND_COOLDOWN_SECONDS } from '@/lib/authConfirmation';
import Button from '@/components/ui/Button';

interface ResendConfirmationProps {
    email: string;
    /** Start counting down at once (the email was just sent by sign-up). */
    startCoolingDown?: boolean;
}

/** "Resend confirmation email", with a short wait between sends. */
export default function ResendConfirmation({ email, startCoolingDown = false }: ResendConfirmationProps) {
    const [secondsLeft, setSecondsLeft] = useState(startCoolingDown ? RESEND_COOLDOWN_SECONDS : 0);
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (secondsLeft <= 0) return;
        const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [secondsLeft]);

    const resend = async () => {
        if (!email || secondsLeft > 0 || status === 'sending') return;
        setStatus('sending');
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: { emailRedirectTo: `${getBrowserSiteUrl()}/auth/callback` },
        });
        if (error) {
            setStatus('error');
            setMessage(/rate limit|too many/i.test(error.message)
                ? 'Too many emails sent. Please wait a few minutes and try again.'
                : 'We could not send the email. Please try again in a moment.');
            return;
        }
        setStatus('sent');
        setMessage(`Sent. Check ${email}, including the spam folder.`);
        setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    };

    return (
        <div className="resend-confirmation">
            <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={resend}
                loading={status === 'sending'}
                disabled={!email || secondsLeft > 0 || status === 'sending'}
            >
                {secondsLeft > 0 ? `Resend email in ${secondsLeft}s` : 'Resend confirmation email'}
            </Button>
            <p className={`resend-status ${status}`} role="status" aria-live="polite">{message}</p>
            <style jsx>{`
                .resend-confirmation { display: flex; flex-direction: column; gap: 8px; }
                .resend-status { min-height: 1.25rem; margin: 0; font-size: 0.875rem; color: var(--pw-ink-475569); text-align: center; }
                .resend-status.error { color: var(--color-danger-fg); }
                .resend-status.sent { color: var(--color-success-fg); }
            `}</style>
        </div>
    );
}
