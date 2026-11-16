import Image from 'next/image';
import Link from 'next/link';
import styles from './AuthBrand.module.css';

export default function AuthBrand() {
  return <aside className={styles.panel} aria-label="Why ZimEstimate">
    <Link href="/home" className={styles.logo} aria-label="ZimEstimate home"><Image src="/logo.png" alt="" width={48} height={43} /><strong>ZimEstimate</strong></Link>
    <h2>Build with a budget you understand.</h2>
    <ul><li>Know your material costs before you start.</li><li>Plan each stage at your own pace.</li><li>Keep estimates and project paperwork together.</li></ul>
  </aside>;
}
