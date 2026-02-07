'use client';

import { useEffect, useState } from 'react';
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

  if (!isOpen) return null;

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Phone Number</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={18} weight="bold" />
          </button>
        </div>

        <p className="modal-description">
          Add a phone number to receive SMS, WhatsApp, or Telegram reminders. Include your country code if possible.
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
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 24px;
        }

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
          border-radius: 6px;
        }

        .close-btn:hover {
          background: #f1f5f9;
        }

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
      `}</style>
    </div>
  );
}
