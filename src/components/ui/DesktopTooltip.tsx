'use client';

import { useState, type ReactElement } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/shadcn/tooltip';

export default function DesktopTooltip({ label, children }: { label: string; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  return <Tooltip open={open} onOpenChange={value => setOpen(value && window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)').matches)}>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent sideOffset={6}>{label}</TooltipContent>
  </Tooltip>;
}
