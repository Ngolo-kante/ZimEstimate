'use client';

import { useRef } from 'react';

/** Controlled overlays can open from a menu item rather than a Radix Trigger. */
export function useOverlayFocus() {
  const trigger = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement;
      const menu = active?.closest('[role="menu"]');
      const menuTrigger = menu?.getAttribute('aria-labelledby');
      trigger.current = menuTrigger ? document.getElementById(menuTrigger) : active instanceof HTMLElement ? active : null;
      if (event.target instanceof HTMLElement) {
        event.target.dataset.keyboard = String(active?.matches(':focus-visible') ?? false);
      }
    },
    onCloseAutoFocus: (event: Event) => {
      if (trigger.current?.isConnected) {
        event.preventDefault();
        trigger.current.focus();
      }
    },
  };
}
