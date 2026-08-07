'use client';

// A public enquiry form for a contractor or a supplier listing.
//
// Both public profiles previously offered only tel: and mailto: links. Those
// work, but they leave no record on the platform: nobody can see how much
// demand a listing attracts, the recipient gets nothing if they miss the mail,
// and there is no status to follow up against. This writes a contact_requests
// row and queues a notification, while the call and WhatsApp buttons stay
// where they are — a phone call is still the fastest way to get an answer and
// this is not trying to replace it.

import { useState } from 'react';
import { PaperPlaneTilt, CheckCircle } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';

interface EnquiryFormProps {
  /** Exactly one of these is passed, mirroring the table's own constraint. */
  contractorId?: string;
  supplierId?: string;
  recipientName: string;
}

export default function EnquiryForm({ contractorId, supplierId, recipientName }: EnquiryFormProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSending(true);

    // Attaches the enquiry to the sender's account when there is one, so it
    // appears in their own history. Signed out is a perfectly good state here.
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ contractorId, supplierId, name, email, phone, message }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || 'Could not send your enquiry. Please try again.');
        return;
      }

      setSent(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="enquiry-done">
        <CheckCircle size={22} weight="fill" />
        <div>
          <strong>Enquiry sent to {recipientName}</strong>
          <span>They have been notified and can reply to you directly.</span>
        </div>
        <style jsx>{`
          .enquiry-done {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 18px;
            border-radius: 14px;
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            color: #047857;
          }
          .enquiry-done div { display: flex; flex-direction: column; gap: 2px; }
          .enquiry-done strong { font-size: 0.9rem; }
          .enquiry-done span { font-size: 0.8rem; color: #059669; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="enquiry-box">
      {!open ? (
        <button type="button" className="open-btn" onClick={() => setOpen(true)}>
          <PaperPlaneTilt size={16} weight="fill" />
          Send an enquiry
        </button>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-head">
            <strong>Enquire with {recipientName}</strong>
            <span>They get your message and your contact details. No account needed.</span>
          </div>

          <div className="row">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
            />
          </div>

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
          />

          <textarea
            placeholder="What do you need? Include quantities or a rough scope if you have them."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={3000}
          />

          {error && <p className="error">{error}</p>}

          <div className="actions">
            <button type="button" className="cancel" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </button>
            <button type="submit" className="submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send enquiry'}
            </button>
          </div>
        </form>
      )}

      <style jsx>{`
        .enquiry-box { width: 100%; }
        .open-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 10px;
          border: none;
          background: #1d4ed8;
          color: #fff;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .open-btn:hover { background: #1e40af; }
        form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 18px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: #fff;
        }
        .form-head { display: flex; flex-direction: column; gap: 3px; margin-bottom: 2px; }
        .form-head strong { font-size: 0.95rem; color: #0f172a; }
        .form-head span { font-size: 0.78rem; color: #64748b; }
        .row { display: flex; gap: 10px; }
        .row input { flex: 1; min-width: 0; }
        input, textarea {
          width: 100%;
          padding: 10px 12px;
          border-radius: 9px;
          border: 1px solid #cbd5e1;
          font-size: 0.875rem;
          font-family: inherit;
          color: #0f172a;
          background: #fff;
        }
        input:focus, textarea:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        textarea { resize: vertical; }
        .error { margin: 0; font-size: 0.8rem; color: #b91c1c; }
        .actions { display: flex; justify-content: flex-end; gap: 8px; }
        .cancel, .submit {
          padding: 9px 16px;
          border-radius: 9px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }
        .cancel { background: #fff; border: 1px solid #cbd5e1; color: #475569; }
        .cancel:hover:not(:disabled) { background: #f8fafc; }
        .submit { background: #1d4ed8; border: none; color: #fff; }
        .submit:hover:not(:disabled) { background: #1e40af; }
        .cancel:disabled, .submit:disabled { opacity: 0.6; cursor: default; }
        @media (max-width: 520px) {
          .row { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
