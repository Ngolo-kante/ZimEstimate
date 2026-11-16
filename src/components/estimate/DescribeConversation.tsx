'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { captureProductEvent } from '@/lib/productAnalytics';
import { routeProject, type ProjectIntent, type ProjectKind, type ProjectRoute } from '@/lib/describe/routeProject';
import styles from './DescribeConversation.module.css';

type Field = 'bedrooms' | 'size' | 'location' | 'budget';
const questions: Record<Field, { prompt: string; choices: string[] }> = {
  bedrooms: { prompt: 'How many bedrooms are you planning?', choices: ['2', '3', '4'] },
  size: { prompt: 'What floor area are you planning, in square metres?', choices: ['80', '120', '180'] },
  location: { prompt: 'Where will you build? Choose a site setting or type a location.', choices: ['Urban', 'Peri-urban', 'Rural'] },
  budget: { prompt: 'What is your budget in US dollars?', choices: ['10000', '25000', '50000'] },
};

export default function DescribeConversation() {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [sent, setSent] = useState('');
  const [route, setRoute] = useState<ProjectRoute | null>(null);
  const [intent, setIntent] = useState<ProjectIntent | null>(null);
  const [answers, setAnswers] = useState<Partial<Record<Field, string>>>({});
  const [replies, setReplies] = useState<{ field: Field; answer: string }[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const read = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || description.trim().length < 3) return;
    setBusy(true); setError(''); setSent(description.trim());
    try {
      // The existing parsing call is made once. Follow-ups never call AI.
      const response = await fetch('/api/describe-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: description.trim() }) });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      const found = result.data.route as ProjectRoute | null;
      if (!found) throw new Error('Try naming a house, solar system or borehole, or choose an estimate below.');
      const params = new URL(found.href, 'https://zimestimate.local').searchParams;
      const bedroom = description.match(/(\d+)\s*(?:bedroom|bed\b)/i)?.[1];
      const size = params.get('area');
      const budget = params.get('budget');
      const location = params.get('loc') || params.get('location') || description.match(/\b(?:in|near)\s+([a-z][a-z -]*?)(?=,|\.|\s+(?:budget|about|with)\b|$)/i)?.[1];
      setAnswers({ ...(bedroom ? { bedrooms: bedroom } : {}), ...(size ? { size } : {}), ...(budget ? { budget } : {}), ...(location ? { location } : {}) });
      setIntent({ kind: result.data.kind as ProjectKind, budgetUsd: budget ? Number(budget) : null, floorAreaM2: size ? Number(size) : null, place: location || null, setting: (params.get('loc') as ProjectIntent['setting']) || null, economy: params.get('profile') === 'economy', storeys: params.get('floors') === '2' ? 2 : null, solarPriority: (params.get('priority') as ProjectIntent['solarPriority']) || (found.understood.includes('Best quality') ? 'quality' : found.understood.includes('Lowest cost') ? 'economy' : null), boreholeDepthM: params.has('depth') ? Number(params.get('depth')) : null, boreholeCommercial: params.get('purpose') === 'commercial' });
      setRoute(found);
      captureProductEvent('ai_scan_used', { tool: 'describe_project', outcome: 'routed', kind: result.data.kind });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read that right now. Please try again.'); }
    finally { setBusy(false); }
  };
  const house = intent?.kind === 'house' || intent?.kind === 'house_stages';
  const fields: Field[] = house ? ['bedrooms', 'size', 'location', 'budget'] : intent && ['solar', 'borehole', 'fencing', 'paving'].includes(intent.kind) ? ['location', 'budget'] : [];
  const missing = fields.find(field => !answers[field]);
  const answer = (value: string) => {
    if (!missing || !intent || !value.trim()) return;
    const clean = value.trim();
    const number = Number(clean.replace(/[$,\s]|m²|m2|sqm/gi, ''));
    const max = missing === 'budget' ? 5000000 : missing === 'size' ? 5000 : 20;
    if (missing !== 'location' && clean !== 'Decide later' && (!Number.isFinite(number) || number <= 0 || number > max)) { setError(`Enter a number between 1 and ${max.toLocaleString()}.`); return; }
    const next = { ...intent };
    if (clean !== 'Decide later') {
      if (missing === 'size') next.floorAreaM2 = number;
      if (missing === 'budget') next.budgetUsd = number;
      if (missing === 'location') {
        next.place = clean;
        const setting = clean.toLowerCase();
        if (setting === 'urban' || setting === 'peri-urban' || setting === 'rural') next.setting = setting;
      }
    }
    setIntent(next); setRoute(routeProject(next));
    setAnswers(previous => ({ ...previous, [missing]: clean }));
    setReplies(previous => [...previous, { field: missing, answer: clean }]);
    setReply(''); setError('');
  };
  return <section className={styles.chat} aria-label="Describe your project conversation">
    <p className={styles.assistant}>What would you like to build? Tell me about your project and any size, location or budget you have in mind.</p>
    {sent && <p className={styles.person}>{sent}</p>}
    {!route && <form onSubmit={read} className={styles.composer}><label htmlFor="project-description">Your project</label><textarea id="project-description" value={description} onChange={e => setDescription(e.target.value)} maxLength={500} placeholder="A 3 bedroom house in Ruwa, budget $25,000" rows={3} /><Button type="submit" loading={busy} disabled={description.trim().length < 3}>Send description</Button></form>}
    {route && <>
      <div className={styles.assistant} role="status"><strong>Here&apos;s what I understood</strong><ul>{route.understood.map(item => <li key={item}>{item}</li>)}</ul></div>
      {replies.map(item => <div key={item.field}><p className={styles.assistant}>{questions[item.field].prompt}</p><p className={styles.person}>{item.answer}</p></div>)}
      {missing ? <div><p className={styles.assistant}>{questions[missing].prompt}</p><div className={styles.choices}>{questions[missing].choices.map(choice => <Button key={choice} variant="secondary" onClick={() => answer(choice)}>{choice}</Button>)}<Button variant="ghost" onClick={() => answer('Decide later')}>Decide later</Button></div><form className={styles.composer} onSubmit={e => { e.preventDefault(); answer(reply); }}><label htmlFor="project-reply">Your answer</label><input id="project-reply" value={reply} onChange={e => setReply(e.target.value)} inputMode={missing === 'location' ? 'text' : 'decimal'} maxLength={80} /><Button variant="secondary" type="submit" disabled={!reply.trim()}>Send answer</Button></form></div> : <Button onClick={() => router.push(route.href)}>Build my estimate</Button>}
      <Button variant="ghost" onClick={() => { setRoute(null); setIntent(null); setSent(''); setReplies([]); setAnswers({}); }}>Start again</Button>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
