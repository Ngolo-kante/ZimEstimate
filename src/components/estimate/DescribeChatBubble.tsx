'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { ChatCircleText } from '@phosphor-icons/react';
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from '@/components/shadcn/drawer';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/shadcn/dialog';
import DescribeProject from './DescribeProject';
import styles from './DescribeChatBubble.module.css';

const query = '(min-width: 768px)';
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function ChatPanel() {
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const focusInput = (event: Event) => {
    event.preventDefault();
    content.current?.querySelector('textarea')?.focus();
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

  return <Drawer open={open} onOpenChange={setOpen}>
    <DrawerTrigger asChild>{trigger}</DrawerTrigger>
    <DrawerContent ref={content} onOpenAutoFocus={focusInput} className={`${styles.panel} z-[150] motion-reduce:animate-none motion-reduce:transition-none`}>
      <DrawerHeader><DrawerTitle>Describe your project</DrawerTitle><DrawerDescription>{description}</DrawerDescription></DrawerHeader>
      {conversation}
      <DrawerClose className={`${styles.close} border border-sc-border`}>Close</DrawerClose>
    </DrawerContent>
  </Drawer>;
}

export default function DescribeChatBubble() {
  const pathname = usePathname();
  return ['/', '/home', '/estimate'].includes(pathname) ? <ChatPanel key={pathname} /> : null;
}
