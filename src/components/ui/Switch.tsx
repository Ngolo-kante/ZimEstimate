'use client';

import { Switch as RadixSwitch } from 'radix-ui';
import styles from './Switch.module.css';

export function SwitchIndicator({ checked }: { checked: boolean }) {
  return (
    <span className={styles.track} data-state={checked ? 'checked' : 'unchecked'} aria-hidden="true">
      <span className={styles.thumb} />
    </span>
  );
}

export default function Switch({ checked, onCheckedChange, label, id }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <RadixSwitch.Root id={id} aria-label={label} checked={checked} onCheckedChange={onCheckedChange} className={styles.control}>
      <SwitchIndicator checked={checked} />
    </RadixSwitch.Root>
  );
}
