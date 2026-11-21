import styles from './BrickLoader.module.css';

/** Decorative loading mark. The calling control announces the operation. */
export default function BrickLoader() {
  return <span className={styles.wall} aria-hidden="true"><i /><i /><i /><i /><i /></span>;
}
