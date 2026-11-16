import Link from 'next/link';

export default function ProjectBreadcrumb({ name }: { name: string }) {
    return <nav aria-label="Breadcrumb" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 16 }}>
        <Link href="/projects" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: 'var(--color-accent)' }}>My projects</Link>
        <span aria-hidden="true">/</span><span aria-current="page" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{name}</span>
    </nav>;
}
