'use client';

import { useState } from 'react';

/**
 * Which workspace dialog is open. Share = send a copy (PDF/summary). Invite =
 * give a builder access to update progress. Two different things, two buttons.
 */
export function useWorkspaceDialogs() {
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    return {
        showShareSheet, setShowShareSheet,
        showInviteModal, setShowInviteModal,
    };
}
