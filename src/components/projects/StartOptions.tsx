'use client';

import Link from 'next/link';
import { CardBadge } from '@/components/ui/CardBadge';
import type { ComponentType } from 'react';
import { House, ChatTeardropText, SolarPanel, Drop, GridFour, Plus } from '@phosphor-icons/react';
import { usePathname } from 'next/navigation';
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose, DrawerScrollArea } from '@/components/shadcn/drawer';
import styles from './StartOptions.module.css';

type IconProps = { size?: number; weight?: 'duotone'; 'aria-hidden'?: boolean | 'true' };

/** Phosphor has no fence; drawn on its 256 grid so it matches the duotone set. */
function FenceIcon({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M48 216V72l24-32 24 32v144M112 216V72l24-32 24 32v144M176 216V72l24-32 24 32v144" fill="currentColor" opacity="0.2" stroke="none" />
      <path d="M48 216V72l24-32 24 32v144Zm64 0V72l24-32 24 32v144Zm64 0V72l24-32 24 32v144ZM96 104h16m-16 64h16m48-64h16m-16 64h16" />
    </svg>
  );
}

const choices: { label: string; detail: string; href: string; icon: ComponentType<IconProps>; popular?: boolean }[] = [
  { label: 'House', detail: 'A full build, stage by stage', href: '/projects/new', icon: House, popular: true },
  { label: 'Describe it instead', detail: 'Tell us in your own words', href: '/estimate', icon: ChatTeardropText },
  { label: 'Solar', detail: 'Panels, inverter and batteries', href: '/quick-projects/solar', icon: SolarPanel },
  { label: 'Borehole', detail: 'Drilling, casing and pump', href: '/quick-projects/borehole', icon: Drop },
  { label: 'Fencing', detail: 'Durawall, brick, palisade or mesh', href: '/quick-projects/fencing', icon: FenceIcon },
  { label: 'Paving', detail: 'Pavers, slabs or cobbles', href: '/quick-projects/paving', icon: GridFour },
];

/**
 * The six ways to start, as in the owner's starred Stitch design (16 Nov):
 * a pale tile with a duotone icon (navy outline, soft gold fill), the name and
 * one line of detail. House, the most common start, carries a gold edge and a
 * "Popular" badge.
 */
export default function StartOptions({ onHouse }: { onHouse?: () => void }) {
  return <div className={styles.grid}>{choices.map(({ label, detail, href, icon: Icon, popular }) => {
    const content = <>
      <span className={styles.tile}><Icon size={28} weight="duotone" aria-hidden="true" /></span>
      <span className={styles.name}>{label}</span>
      <span className={styles.detail}>{detail}</span>
      {popular && <CardBadge variant="featured" className={styles.badge}>Popular</CardBadge>}
    </>;
    const className = `${styles.card} ${popular ? styles.popular : ''}`;
    return onHouse && label === 'House'
      ? <button type="button" key={label} className={className} onClick={onHouse}>{content}</button>
      : <Link key={label} href={href} className={className}>{content}</Link>;
  })}</div>;
}

export function MobileStartButton() {
  const pathname = usePathname();
  if (!['/', '/home', '/projects', '/projects/quick'].includes(pathname)) return null;
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button type="button" aria-label="Start something new" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sc-primary text-sc-primary-foreground md:hidden">
          <Plus size={20} weight="bold" aria-hidden="true" />
        </button>
      </DrawerTrigger>
      <DrawerContent className={`${styles.startSheet} motion-reduce:[animation:none!important] motion-reduce:[transition:none!important] z-[150] max-h-[85dvh] pb-[env(safe-area-inset-bottom)]`}>
        <DrawerHeader className={`${styles.header} text-left!`}>
          <DrawerTitle className={styles.title}>Start something new</DrawerTitle>
          <DrawerDescription>Choose what you want to estimate.</DrawerDescription>
        </DrawerHeader>
        <DrawerScrollArea className="px-4"><StartOptions /></DrawerScrollArea>
        <DrawerClose className={`${styles.close} m-4 min-h-11 rounded-xl border border-sc-border font-medium`}>Close</DrawerClose>
      </DrawerContent>
    </Drawer>
  );
}
