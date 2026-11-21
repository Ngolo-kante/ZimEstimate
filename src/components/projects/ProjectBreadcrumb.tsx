import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import styles from './ProjectBreadcrumb.module.css';

export default function ProjectBreadcrumb({ name, overviewHref }: { name: string; overviewHref?: string }) {
    const linkStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, color: 'var(--project-breadcrumb-link, #1d4ed8)', fontWeight: 600 } as const;
    return (
        <nav aria-label="Breadcrumb" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 16 }}>
            <Link href="/projects" style={linkStyle} className={styles.link}>
                {!overviewHref && <ArrowLeft size={16} aria-hidden="true" />}
                {overviewHref ? 'My projects' : 'Back to My projects'}
            </Link>
            <span aria-hidden="true">/</span>
            {overviewHref && (
                <>
                    <Link href={overviewHref} style={linkStyle} className={styles.link}>
                        <ArrowLeft size={16} aria-hidden="true" />
                        Back to project overview
                    </Link>
                    <span aria-hidden="true">/</span>
                </>
            )}
            <span aria-current="page" className={styles.current}>{name}</span>
        </nav>
    );
}
