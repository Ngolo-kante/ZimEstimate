'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/shadcn/dialog';
import { useOverlayFocus } from './useOverlayFocus';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Phone, X } from '@phosphor-icons/react';

interface PhoneNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (phoneNumber: string) => Promise<void>;
  initialValue?: string;
}

export default function PhoneNumberModal({
  isOpen,
  onClose,
  onSave,
  initialValue = '',
}: PhoneNumberModalProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialValue);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPhoneNumber(initialValue);
    setError('');
    setIsSaving(false);
  }, [isOpen, initialValue]);

  const focus = useOverlayFocus();

  const handleSave = async () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      setError('Phone number is required to enable mobile reminders.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
                <DialogContent {...focus} showCloseButton={false} aria-describedby={undefined} className="!block !w-[calc(100%-2rem)] !max-w-[420px] !p-0">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <DialogTitle asChild><h2>Add Phone Number</h2></DialogTitle>
          <button className="close-btn" aria-label="Close" onClick={onClose}>
            <X size={18} weight="bold" />
          </button>
        </div>

        <p className="modal-description">
          Add a phone number to receive SMS and WhatsApp reminders. Include your country code if possible.
        </p>

        <Input
          label="Phone Number"
          placeholder="+263 7xx xxx xxx"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          icon={<Phone size={18} weight="light" />}
          error={error}
        />

        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            Save Number
          </Button>
        </div>
      </div></DialogContent></Dialog>

      <style jsx>{`

        .modal-content {
          width: 100%;
          max-width: 420px;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2);
          padding: 20px 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #0f172a;
        }

        .close-btn {
          border: none;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          min-width: 44px; min-height: 44px;
          border-radius: 6px;
        }

        @media (hover: hover) and (pointer: fine) { .close-btn:hover { background: #f1f5f9; } }

        .modal-description {
          margin: 0;
          font-size: 0.875rem;
          color: #64748b;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        @media (max-width: 640px) {
          .modal-content { background: var(--color-primary); }
          .modal-header h2, .modal-content :global(.input-label) { color: var(--color-text-inverse); }
          .modal-description { color: var(--color-muted-on-navy); }
          .modal-content :global(.input-error) { color: #fecaca; }
          .close-btn, .modal-actions :global(.btn-ghost) {
            background: var(--color-surface);
            color: var(--color-primary);
          }
          .close-btn:focus-visible, .modal-content :global(.btn:focus-visible) {
            outline: 2px solid var(--color-gold-on-navy);
            outline-offset: 2px;
          }
        }
      `}</style>
    </>
  );
}
