import Link from 'next/link';
import { ChartBar, Folders } from '@phosphor-icons/react';
import styles from './ProjectsSubNav.module.css';

export default function ProjectsSubNav({ active }: { active: 'dashboard' | 'all' }) {
  return (
    <nav className={styles.nav} aria-label="Project workspace views">
      <Link href="/projects" aria-current={active === 'all' ? 'page' : undefined}>
        <Folders size={17} /> My Work
      </Link>
      <Link href="/projects/dashboard" aria-current={active === 'dashboard' ? 'page' : undefined}>
        <ChartBar size={17} /> Insights
      </Link>
    </nav>
  );
}
