import Link from 'next/link';
import { CaretLeft } from '@phosphor-icons/react/dist/ssr';
import styles from './ProjectBreadcrumb.module.css';

export default function ProjectBreadcrumb({ name, overviewHref }: { name: string; overviewHref?: string }) {
    const backLabel = overviewHref ? 'Back to project overview' : 'Back to My projects';
    return (
        <nav aria-label="Breadcrumb" className={styles.trail}>
            {overviewHref && (
                <>
                    <Link href="/projects" className={`${styles.link} ${styles.ancestor}`}>My projects</Link>
                    <span aria-hidden="true" className={styles.separator}>/</span>
                </>
            )}
            <Link href={overviewHref ?? '/projects'} className={`${styles.link} ${styles.back}`} aria-label={backLabel}>
                <CaretLeft size={20} weight="bold" aria-hidden="true" />
                <span className={styles.backLabel}>{backLabel}</span>
            </Link>
            <span aria-hidden="true" className={styles.separator}>/</span>
            <span aria-current="page" className={styles.current}>{name}</span>
        </nav>
    );
}
