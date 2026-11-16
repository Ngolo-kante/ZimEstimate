'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { ChatCircleText } from '@phosphor-icons/react';
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose, DrawerScrollArea } from '@/components/shadcn/drawer';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/shadcn/dialog';
import DescribeProject from './DescribeProject';
import styles from './DescribeChatBubble.module.css';

const query = '(min-width: 768px)';
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

/**
 * The part of the screen the on-screen keyboard leaves visible. iOS Safari
 * lays the keyboard over the page without resizing it, so a bottom sheet
 * pinned to bottom: 0 ends up behind the keyboard. Tracking the visual
 * viewport lets the sheet sit on top of the keyboard and shrink to fit.
 * (Android Chrome resizes the page itself here, via interactive-widget, and
 * this then measures no keyboard inset.)
 */
function useKeyboardFrame(active: boolean) {
  const [frame, setFrame] = useState<{ inset: number; height: number } | null>(null);
  useEffect(() => {
    const vv = typeof window === 'undefined' ? null : window.visualViewport;
    if (!active || !vv) return;
    const update = () => setFrame({
      inset: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)),
      height: Math.round(vv.height),
    });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setFrame(null);
    };
  }, [active]);
  return frame;
}

function ChatPanel() {
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const frame = useKeyboardFrame(open && !desktop);
  const focusInput = (event: Event) => {
    event.preventDefault();
    content.current?.querySelector('textarea')?.focus();
  };
  // On a phone, opening the chat must not throw the keyboard up over the
  // suggestions: focus the panel itself and let the person tap the box.
  const focusPanel = (event: Event) => {
    event.preventDefault();
    content.current?.focus();
  };
  const trigger = <button type="button" aria-label="Describe your project" className={`${styles.bubble} bg-sc-background border border-sc-border text-sc-primary`}><ChatCircleText size={28} aria-hidden="true" /></button>;
  const conversation = <div className={styles.conversation}><DescribeProject conversation /></div>;
  const description = "Tell us what you want to build and we'll take you to the right estimate.";

  if (desktop) return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent ref={content} showCloseButton={false} onOpenAutoFocus={focusInput} className={`${styles.panel} z-[150] sm:max-w-xl motion-reduce:animate-none motion-reduce:transition-none`}>
      <DialogHeader><DialogTitle>Describe your project</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {conversation}
      <DialogClose className={`${styles.close} border border-sc-border`}>Close</DialogClose>
    </DialogContent>
  </Dialog>;

  // Vaul's own keyboard handling is off: it fought this sizing and the panel's
  // max height, leaving the text box under the keyboard.
  return <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
    <DrawerTrigger asChild>{trigger}</DrawerTrigger>
    <DrawerContent
      ref={content}
      tabIndex={-1}
      onOpenAutoFocus={focusPanel}
      style={frame && frame.inset > 0 ? { bottom: frame.inset, maxHeight: Math.max(240, frame.height - 12) } : undefined}
      className={`${styles.panel} z-[150] outline-none motion-reduce:animate-none motion-reduce:transition-none`}
    >
      <DrawerHeader><DrawerTitle>Describe your project</DrawerTitle><DrawerDescription>{description}</DrawerDescription></DrawerHeader>
      <DrawerScrollArea>{conversation}</DrawerScrollArea>
      <DrawerClose className={`${styles.close} border border-sc-border`}>Close</DrawerClose>
    </DrawerContent>
  </Drawer>;
}

export default function DescribeChatBubble() {
  const pathname = usePathname();
  return ['/', '/home', '/estimate'].includes(pathname) ? <ChatPanel key={pathname} /> : null;
}
