'use client';

import Link from 'next/link';
import { ChatCircleText } from '@phosphor-icons/react';

/**
 * A way to reach support, placed where people get stuck.
 *
 * Deliberately not a floating chat bubble. A bubble promises someone is there
 * right now; support here is one inbox, so a click that leads to a form and
 * "we will email you" reads as a broken promise rather than a service. A link
 * at the point of friction sets the right expectation and — because it carries
 * the category — makes the ticket queue tell us where the product actually
 * hurts, instead of everything arriving as "general".
 */

interface ContactSupportLinkProps {
  /** Pre-selects the category on the form. Must match a value in the support page's list. */
  category?: 'general' | 'account' | 'billing' | 'supplier' | 'contractor' | 'bug' | 'privacy';
  /** Pre-fills the subject so the person does not have to describe where they were. */
  subject?: string;
  children?: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}

export default function ContactSupportLink({
  category,
  subject,
  children = 'Contact support',
  className = '',
  showIcon = true,
}: ContactSupportLinkProps) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (subject) params.set('subject', subject);
  const query = params.toString();

  return (
    <Link
      href={query ? `/support?${query}` : '/support'}
      className={`inline-flex items-center gap-1.5 font-semibold text-[var(--color-accent)] underline-offset-2 transition hover:underline ${className}`}
    >
      {showIcon && <ChatCircleText size={15} weight="duotone" aria-hidden />}
      {children}
    </Link>
  );
}
