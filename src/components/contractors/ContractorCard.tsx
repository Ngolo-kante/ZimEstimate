'use client';

import Link from 'next/link';
import { ArrowRight, Briefcase, MapPin, Phone } from '@phosphor-icons/react';
import type { PublicContractorRow } from '@/lib/services/contractors';
import styles from './ContractorCard.module.css';

type ContractorCardProps = {
  contractor: PublicContractorRow;
};

const visibleTags = (values: string[] | null | undefined, fallback: string) => {
  const items = values?.filter(Boolean) || [];
  return items.length ? items : [fallback];
};

export default function ContractorCard({ contractor }: ContractorCardProps) {
  const trades = visibleTags(contractor.trades, 'Trade not specified');
  const areas = visibleTags(contractor.service_areas, 'Service area not specified');
  const initials = contractor.company_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <article className={styles.card}>
      <div className={styles.identity}>
        <div className={styles.avatar} aria-hidden="true">{initials || 'C'}</div>
        <div>
          <h2>{contractor.company_name}</h2>
          <p>
            <Briefcase size={15} weight="duotone" aria-hidden="true" />
            {contractor.years_experience ? `${contractor.years_experience}+ years experience` : 'Experience not provided'}
          </p>
        </div>
      </div>

      {contractor.about && (
        <p className={styles.about}>{contractor.about}</p>
      )}

      <div className={styles.details}>
        <div className={styles.detailGroup}>
          <p>Trades</p>
          <div className={styles.tags}>
            {trades.slice(0, 4).map((trade) => (
              <span key={trade}>{trade}</span>
            ))}
            {trades.length > 4 && <span>+{trades.length - 4}</span>}
          </div>
        </div>

        <div className={styles.detailGroup}>
          <p>
            <MapPin size={13} aria-hidden="true" />
            Service areas
          </p>
          <div className={styles.areas}>
            {areas.slice(0, 3).join(' · ')}
            {areas.length > 3 && ` +${areas.length - 3}`}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href={`/contractors/${contractor.id}`}>
          View profile
          <ArrowRight size={15} weight="bold" aria-hidden="true" />
        </Link>
        {contractor.contact_phone && (
          <a href={`tel:${contractor.contact_phone}`} aria-label={`Call ${contractor.company_name}`}>
            <Phone size={17} weight="bold" aria-hidden="true" />
            Call
          </a>
        )}
      </div>
    </article>
  );
}
