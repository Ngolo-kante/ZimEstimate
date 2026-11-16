'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Keeps content mounted for an interruptible exit; closed controls leave the tab order. */
export default function HeightCollapse({ open, children, animate = true }: { open: boolean; children: ReactNode; animate?: boolean }) {
    const reduced = useReducedMotion();
    return (
        <motion.div
            initial={false}
            animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
            transition={{ duration: animate ? 0.2 : 0, ease: [0.23, 1, 0.32, 1], height: { duration: reduced || !animate ? 0 : 0.2 } }}
            inert={!open}
            style={{ overflow: 'hidden' }}
        >{children}</motion.div>
    );
}
