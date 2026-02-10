'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { DownloadSimple, X } from '@phosphor-icons/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const handleInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setVisible(false);
    setDeferredPrompt(null);
  };

  if (!visible) return null;

  return (
    <div className="install-banner">
      <div className="install-copy">
        <div className="install-title">Install ZimEstimate</div>
        <div className="install-subtitle">Get faster access, offline support, and notifications.</div>
      </div>
      <div className="install-actions">
        <Button icon={<DownloadSimple size={16} />} onClick={handleInstall}>
          Install
        </Button>
        <button className="dismiss" onClick={() => setVisible(false)} aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>

      <style jsx>{`
        .install-banner {
          position: sticky;
          bottom: 0;
          margin: 0 auto 24px;
          max-width: 960px;
          background: #0f172a;
          color: white;
          border-radius: 16px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.3);
        }

        .install-title {
          font-size: 1rem;
          font-weight: 700;
        }

        .install-subtitle {
          font-size: 0.85rem;
          opacity: 0.8;
        }

        .install-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .dismiss {
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .install-banner {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
