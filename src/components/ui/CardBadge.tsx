import type { ReactNode } from 'react';
import { CheckCircle, StarFour, Warning, XCircle } from '@phosphor-icons/react/dist/ssr';
import { Badge } from '@/components/shadcn/badge';
import styles from './CardBadge.module.css';

type BadgeVariant = 'default' | 'accent' | 'info' | 'success' | 'warning' | 'error' | 'featured';

const markers = {
  default: null,
  accent: null,
  info: null,
  success: CheckCircle,
  warning: Warning,
  error: XCircle,
  featured: StarFour,
};

export function CardBadge({ children, variant = 'default', className = '' }: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  const Marker = markers[variant];
  return (
    <Badge variant="outline" data-tone={variant} className={`${styles.chip} ${className}`}>
      {Marker && <Marker size={12} weight="fill" aria-hidden="true" />}
      {children}
    </Badge>
  );
}
