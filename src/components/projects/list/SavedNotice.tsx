'use client';

import Link from 'next/link';
import { CaretRight, Check, X } from '@phosphor-icons/react';

/** Confirmation that a save landed, with a way straight into it. */
export default function SavedNotice({
    justSaved,
    onDismiss,
}: {
    justSaved: { name: string; href: string };
    onDismiss: () => void;
}) {
    return (
        <div className="saved-banner" role="status">
            <span className="saved-icon"><Check size={16} weight="bold" /></span>
            <span className="saved-text">
                <strong>{justSaved.name}</strong> saved.
            </span>
            <Link href={justSaved.href} className="saved-open">
                Open <CaretRight size={14} weight="bold" />
            </Link>
            <button
                type="button"
                className="saved-dismiss"
                aria-label="Dismiss"
                onClick={onDismiss}
            >
                <X size={14} weight="bold" />
            </button>
        </div>
    );
}
