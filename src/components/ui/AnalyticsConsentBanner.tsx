'use client';

import Link from 'next/link';
import { ChartLineUp, X } from '@phosphor-icons/react';
import type { AnalyticsConsent } from '@/lib/productAnalytics';
import styles from './AnalyticsConsentBanner.module.css';

interface AnalyticsConsentBannerProps {
  currentConsent: AnalyticsConsent | null;
  onAccept: () => void;
  onDecline: () => void;
  onClose?: () => void;
}

export default function AnalyticsConsentBanner({
  currentConsent,
  onAccept,
  onDecline,
  onClose,
}: AnalyticsConsentBannerProps) {
  return (
    <aside className={styles.banner} aria-label="Analytics preferences" aria-live="polite">
      <div className={styles.marker} aria-hidden="true">ZE / DATA</div>
      <div className={styles.icon} aria-hidden="true">
        <ChartLineUp size={24} weight="duotone" />
      </div>
      <div className={styles.copy}>
        <strong>{currentConsent ? 'Analytics preferences' : 'Help improve ZimEstimate'}</strong>
        <p>
          Allow product analytics so we can understand which tools are useful. Signed-in activity is linked to your account ID. These events exclude your name, email, project contents and exact budget.
          {' '}<Link href="/privacy">Privacy policy</Link>
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.decline} onClick={onDecline}>Decline</button>
        <button type="button" className={styles.accept} onClick={onAccept}>Allow analytics</button>
      </div>
      {onClose && (
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close analytics preferences">
          <X size={18} weight="bold" />
        </button>
      )}
    </aside>
  );
}
