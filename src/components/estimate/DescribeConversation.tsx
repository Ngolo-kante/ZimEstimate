'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PaperPlaneRight } from '@phosphor-icons/react';
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

// Tap one to send it as is: shows what a description looks like (owner, 16 Nov).
const examples = [
  '3 bedroom house in Harare, $40,000',
  'Solar for a 4 bedroom home',
  'Borehole in Chitungwiza',
  '50 m of durawall fencing',
];

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

  const read = async (event: FormEvent | null, text = description) => {
    event?.preventDefault();
    if (busy) return;
    // Send always looks ready; an empty box gets a nudge instead of a dead button.
    if (text.trim().length < 3) { setError('Tell me what you want to build first, or tap an example.'); return; }
    setDescription(text);
    setBusy(true); setError(''); setSent(text.trim());
    try {
      // The existing parsing call is made once. Follow-ups never call AI.
      const response = await fetch('/api/describe-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.trim() }) });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      const found = result.data.route as ProjectRoute | null;
      if (!found) throw new Error('Try naming a house, solar system or borehole, or choose an estimate below.');
      const params = new URL(found.href, 'https://zimestimate.local').searchParams;
      const bedroom = text.match(/(\d+)\s*(?:bedroom|bed\b)/i)?.[1];
      const size = params.get('area');
      const budget = params.get('budget');
      const location = params.get('loc') || params.get('location') || text.match(/\b(?:in|near)\s+([a-z][a-z -]*?)(?=,|\.|\s+(?:budget|about|with)\b|$)/i)?.[1];
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
    {!route && <form onSubmit={read} className={styles.composer}>
      <label htmlFor="project-description" className="sr-only">Your project</label>
      {/* Chat-style box: the send arrow sits inside it, bottom right. Enter sends; Shift+Enter adds a line. */}
      <div className={styles.inputWrap}>
        <textarea id="project-description" value={description} onChange={e => { setDescription(e.target.value); if (error) setError(''); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); read(null); } }} maxLength={500} placeholder="Describe your project, e.g. a 3 bedroom house in Ruwa, budget $25,000" rows={3} />
        <button type="submit" className={styles.send} aria-label="Send" disabled={busy} aria-busy={busy}>{busy ? <span className={styles.spinner} aria-hidden="true" /> : <PaperPlaneRight size={20} weight="fill" aria-hidden="true" />}</button>
      </div>
    </form>}
    {!route && !sent && <div className={styles.examples}><p className={styles.examplesLabel}>Suggested</p><div className={styles.choices}>{examples.map(example => <button key={example} type="button" className={styles.example} onClick={() => read(null, example)} disabled={busy}>{example}</button>)}</div></div>}
    {route && <>
      <div className={styles.assistant} role="status"><strong>Here&apos;s what I understood</strong><ul>{route.understood.map(item => <li key={item}>{item}</li>)}</ul></div>
      {replies.map(item => <div key={item.field}><p className={styles.assistant}>{questions[item.field].prompt}</p><p className={styles.person}>{item.answer}</p></div>)}
      {missing ? <div><p className={styles.assistant}>{questions[missing].prompt}</p><div className={styles.choices}>{questions[missing].choices.map(choice => <Button key={choice} variant="secondary" onClick={() => answer(choice)}>{choice}</Button>)}<Button variant="ghost" onClick={() => answer('Decide later')}>Decide later</Button></div><form className={styles.composer} onSubmit={e => { e.preventDefault(); if (!reply.trim()) { setError('Type an answer or tap one of the choices.'); return; } answer(reply); }}><label htmlFor="project-reply" className="sr-only">Your answer</label><div className={styles.inputWrap}><input id="project-reply" value={reply} onChange={e => { setReply(e.target.value); if (error) setError(''); }} inputMode={missing === 'location' ? 'text' : 'decimal'} maxLength={80} placeholder="Or type your answer" /><button type="submit" className={styles.send} aria-label="Send answer"><PaperPlaneRight size={20} weight="fill" aria-hidden="true" /></button></div></form></div> : <Button onClick={() => router.push(route.href)}>Build my estimate</Button>}
      <Button variant="ghost" onClick={() => { setRoute(null); setIntent(null); setSent(''); setReplies([]); setAnswers({}); }}>Start again</Button>
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
