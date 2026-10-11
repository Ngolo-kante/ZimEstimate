'use client';

// "Describe your project" — a sentence instead of a list of nineteen tiles.
// Shows what was understood and where it will go before going, so a wrong
// guess costs a glance rather than a confusing page; the tiles stay below
// for anyone who would rather pick.

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, CircleNotch, Sparkle } from '@phosphor-icons/react';
import { captureProductEvent } from '@/lib/productAnalytics';
import type { ProjectRoute } from '@/lib/describe/routeProject';
import styles from './DescribeProject.module.css';

const EXAMPLES = [
  'Solar for a 3 bedroom house in Bulawayo, about $3,000',
  'Build a house in Ruwa, budget 25k',
  'My builder quoted $9,000 for roofing — is it fair?',
];

export default function DescribeProject() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState<ProjectRoute | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (text.trim().length < 3 || busy) return;
    setBusy(true); setRoute(null); setMessage(null);
    try {
      const response = await fetch('/api/describe-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      const found = result.data.route as ProjectRoute | null;
      setRoute(found);
      if (!found) setMessage('We could not tell which estimate that is. Try naming the project — a house, solar, a borehole — or pick from the list below.');
      captureProductEvent('ai_scan_used', { tool: 'describe_project', outcome: found ? 'routed' : 'unclear', kind: result.data.kind });
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : 'Could not read that right now. Pick from the list below instead.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.box}>
      <form onSubmit={submit} className={styles.form}>
        <label htmlFor="describe-project" className={styles.label}>
          <Sparkle size={14} weight="fill" aria-hidden="true" /> Or describe it in a sentence
        </label>
        <div className={styles.row}>
          <input
            id="describe-project"
            value={text}
            onChange={(e) => { setText(e.target.value); setRoute(null); setMessage(null); }}
            placeholder={EXAMPLES[0]}
            maxLength={500}
            autoComplete="off"
            enterKeyHint="go"
          />
          <button type="submit" disabled={busy || text.trim().length < 3}>
            {busy ? <><CircleNotch size={16} weight="bold" className={styles.spin} /> Reading…</> : 'Go'}
          </button>
        </div>
      </form>

      {!route && !message && !busy && (
        <div className={styles.examples}>
          {EXAMPLES.slice(1).map((example) => (
            <button key={example} type="button" onClick={() => setText(example)}>{example}</button>
          ))}
        </div>
      )}

      {route && (
        <div className={styles.result} role="status">
          <ul className={styles.chips} aria-label="What we understood">
            {route.understood.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <Link href={route.href} className={styles.go}>
            {route.destination} <ArrowRight size={14} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      )}
      {message && <p className={styles.message} role="status">{message}</p>}
    </div>
  );
}
