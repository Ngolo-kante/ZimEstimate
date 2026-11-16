'use client';

import Link from 'next/link';
import { House, ChatText, SolarPanel, Drop, Rows, GridFour, Plus } from '@phosphor-icons/react';
import { usePathname } from 'next/navigation';
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose, DrawerScrollArea } from '@/components/shadcn/drawer';

const choices = [
  { label: 'House', href: '/projects/new', icon: House },
  { label: 'Describe it instead', href: '/estimate', icon: ChatText },
  { label: 'Solar', href: '/quick-projects/solar', icon: SolarPanel },
  { label: 'Borehole', href: '/quick-projects/borehole', icon: Drop },
  { label: 'Fencing', href: '/quick-projects/fencing', icon: Rows },
  { label: 'Paving', href: '/quick-projects/paving', icon: GridFour },
];

export default function StartOptions({ onHouse }: { onHouse?: () => void }) {
  return <div className="grid grid-cols-2 gap-3">{choices.map(({ label, href, icon: Icon }) => {
    const content = <><Icon size={24} aria-hidden="true" /><span>{label}</span></>;
    const className = 'flex min-h-24 flex-col items-start justify-center gap-2 rounded-xl border border-sc-border bg-sc-background p-4 text-left text-sc-muted-foreground hover:bg-sc-muted focus-visible:outline-2';
    return onHouse && label === 'House'
      ? <button type="button" key={label} className={className} onClick={onHouse}>{content}</button>
      : <Link key={label} href={href} className={className}>{content}</Link>;
  })}</div>;
}

export function MobileStartButton() {
  const pathname = usePathname();
  if (!['/', '/home', '/projects', '/projects/quick', '/estimate'].includes(pathname)) return null;
  return <Drawer><DrawerTrigger asChild><button type="button" aria-label="Start something new" className="fixed right-4 z-[110] flex h-14 w-14 items-center justify-center rounded-full bg-sc-primary text-sc-primary-foreground shadow-lg md:hidden" style={{ bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}><Plus size={28} aria-hidden="true" /></button></DrawerTrigger><DrawerContent className="motion-reduce:[animation:none!important] motion-reduce:[transition:none!important] z-[150] max-h-[85dvh] pb-[env(safe-area-inset-bottom)]"><DrawerHeader><DrawerTitle>Start something new</DrawerTitle><DrawerDescription>Choose what you want to estimate.</DrawerDescription></DrawerHeader><DrawerScrollArea className="px-4"><StartOptions /></DrawerScrollArea><DrawerClose className="m-4 min-h-11 rounded-lg border border-sc-border">Close</DrawerClose></DrawerContent></Drawer>;
}
