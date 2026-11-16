'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import suggestions from '@/lib/pricing/zbmsCandidates.json';
import { formatUsd } from '@/lib/format';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/shadcn/badge';
import { Input } from '@/components/shadcn/input';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/shadcn/collapsible';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';

// Scope the schema because older hand-maintained tables omit Relationships.
type MatchesDatabase = { public: { Tables: Pick<Database['public']['Tables'], 'price_source_matches'>; Views: Record<never, never>; Functions: Record<never, never> } };
const matchesDb = supabase as unknown as SupabaseClient<MatchesDatabase>;

type Match = Database['public']['Tables']['price_source_matches']['Row'];
type Suggestion = typeof suggestions[number];
const updateMessage = 'Price matches need a database update. Ask your developer to apply migration 068.';
const missingTable = (error: { code?: string }) => ['42P01', 'PGRST205'].includes(error.code || '');
const statusOf = (match?: Match) => match?.status === 'confirmed' ? 'Confirmed' : match?.status === 'no_match' ? 'No good match' : 'To check';

function MatchRow({ item, match, busy, onSave, onReset }: {
  item: Suggestion; match?: Match; busy: boolean;
  onSave: (choice: string, factor: number, note: string) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [choice, setChoice] = useState(match?.status === 'no_match' ? 'none' : match?.product_ids[0]?.toString() || '');
  const [factor, setFactor] = useState(String(match?.factor ?? item.candidates[0]?.factor ?? 1));
  const [note, setNote] = useState(match?.note || '');
  const validFactor = Number.isFinite(Number(factor)) && Number(factor) > 0;
  return <Collapsible className="rounded-xl border border-sc-border bg-sc-background">
    <CollapsibleTrigger className="flex min-h-11 w-full flex-wrap items-center justify-between gap-3 p-4 text-left focus-visible:outline-sc-ring">
      <span><span className="block font-semibold">{item.materialName}</span><span className="text-sm text-sc-muted-foreground">{item.ourUnit}</span></span>
      <Badge variant={match?.status === 'confirmed' ? 'default' : 'outline'}>{statusOf(match)}</Badge>
      {match && <span className="w-full break-words text-sm text-sc-muted-foreground">
        {match.status === 'confirmed' && <>{match.product_ids.map(id => item.candidates.find(c => c.productId === id)?.name || `Product ${id}`).join(', ')} · Factor {match.factor} · </>}
        Confirmed by {match.confirmed_by || 'deleted admin'} · {new Date(match.confirmed_at).toLocaleString()}
      </span>}
      <span className="text-sm text-sc-primary">Review choices</span>
    </CollapsibleTrigger>
    <CollapsibleContent className="border-t border-sc-border p-4">
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (choice && (choice === 'none' || validFactor)) void onSave(choice, choice === 'none' ? 1 : Number(factor), note); }}>
        <fieldset disabled={busy} className="space-y-3">
          <legend className="mb-3 font-medium">Choose a ZBMS product</legend>
          {item.candidates.map(candidate => <div key={candidate.productId} className="rounded-lg border border-sc-border p-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="radio" name={item.materialId} value={candidate.productId} checked={choice === String(candidate.productId)} onChange={() => { setChoice(String(candidate.productId)); setFactor(String(candidate.factor)); }} className="size-5 accent-sc-primary" />
              <span className="font-medium">{candidate.name}</span>
            </label>
            <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-sc-primary underline">View {candidate.name} on ZBMS ↗</a>
            <p className="text-sm">Listed: {formatUsd(candidate.priceUsd)} · {candidate.statedUnit}</p>
            <p className="mt-2 text-sm text-sc-muted-foreground">{candidate.reason}</p>
            <p className="mt-2 font-medium">{formatUsd(candidate.priceUsd * (choice === String(candidate.productId) && validFactor ? Number(factor) : candidate.factor))} {item.ourUnit}</p>
          </div>)}
          <label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="radio" name={item.materialId} checked={choice === 'none'} onChange={() => setChoice('none')} className="size-5 accent-sc-primary" />No good match</label>
          {item.note && <p className="text-sm text-sc-muted-foreground">{item.note}</p>}
          <label className="block text-sm" htmlFor={`factor-${item.materialId}`}>Conversion factor</label>
          <Input id={`factor-${item.materialId}`} type="number" inputMode="decimal" step="any" min="0" required={choice !== 'none'} disabled={choice === 'none'} value={factor} onChange={e => setFactor(e.target.value)} className="min-h-11 max-w-xs" />
          {choice && choice !== 'none' && !validFactor && <p className="text-sm text-sc-destructive">Enter a factor greater than zero.</p>}
          <label className="block text-sm" htmlFor={`note-${item.materialId}`}>Note (optional)</label>
          <Input id={`note-${item.materialId}`} value={note} onChange={e => setNote(e.target.value)} className="min-h-11" />
        </fieldset>
        <div className="flex gap-3"><Button type="submit" disabled={busy || !choice || (choice !== 'none' && !validFactor)} className="min-h-11">{busy ? 'Saving…' : 'Confirm'}</Button>
          {match && <Button type="button" variant="secondary" disabled={busy} onClick={() => void onReset()} className="min-h-11">Reset</Button>}</div>
      </form>
    </CollapsibleContent>
  </Collapsible>;
}

export default function PriceMatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await matchesDb.from('price_source_matches').select('*').eq('source', 'zbms');
        if (!active) return;
        if (error) { if (missingTable(error)) setMissing(true); else setError(error.message); }
        else setMatches(data || []);
      } catch (error) { if (active) setError(error instanceof Error ? error.message : 'Could not load price matches.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);
  async function write(item: Suggestion, choice?: string, factor = 1, note = '') {
    if (!user || busy) return;
    setBusy(item.materialId); setError('');
    try {
      if (choice) {
        const row = { source: 'zbms' as const, material_id: item.materialId, status: choice === 'none' ? 'no_match' as const : 'confirmed' as const,
          product_ids: choice === 'none' ? [] : [Number(choice)], factor, unit: item.ourUnit, note: note.trim() || null, confirmed_by: user.id, confirmed_at: new Date().toISOString() };
        const { data, error } = await matchesDb.from('price_source_matches').upsert(row, { onConflict: 'source,material_id' }).select().single();
        if (error) throw error;
        setMatches(old => [...old.filter(m => m.material_id !== item.materialId), data]);
      } else {
        const { error } = await matchesDb.from('price_source_matches').delete().eq('source', 'zbms').eq('material_id', item.materialId);
        if (error) throw error;
        setMatches(old => old.filter(m => m.material_id !== item.materialId));
      }
    } catch (error) {
      if (typeof error === 'object' && error && missingTable(error)) setMissing(true);
      else setError(error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Could not save price match.');
    } finally { setBusy(null); }
  }
  if (missing) return <p className="text-sc-muted-foreground">{updateMessage}</p>;
  if (loading) return <p role="status" className="text-sc-muted-foreground">Loading price matches…</p>;
  const confirmed = suggestions.filter(item => matches.find(m => m.material_id === item.materialId)?.status === 'confirmed').length;
  const noMatch = suggestions.filter(item => matches.find(m => m.material_id === item.materialId)?.status === 'no_match').length;
  return <div className="mx-auto max-w-4xl space-y-5 text-sc-foreground">
    <header><h1 className="text-3xl font-bold">Price matches</h1><p className="mt-2 text-sc-muted-foreground">{confirmed} of {suggestions.length} confirmed · {noMatch} no good match · {suggestions.length - confirmed - noMatch} to check</p></header>
    {error && <p role="alert" className="rounded-lg border border-sc-destructive bg-sc-destructive/10 p-4 text-sm text-sc-destructive">{error}</p>}
    <label className="block text-sm font-medium" htmlFor="match-filter">Show matches</label>
    <NativeSelect id="match-filter" value={filter} onChange={e => setFilter(e.target.value)} className="[&_select]:min-h-11">{['All', 'To check', 'Confirmed', 'No good match'].map(value => <NativeSelectOption key={value}>{value}</NativeSelectOption>)}</NativeSelect>
    <div className="space-y-3">{suggestions.map(item => {
      const match = matches.find(m => m.material_id === item.materialId);
      if (filter !== 'All' && filter !== statusOf(match)) return null;
      return <MatchRow key={`${item.materialId}-${match?.confirmed_at || 'unchecked'}`} item={item} match={match} busy={busy !== null || !user} onSave={(choice, factor, note) => write(item, choice, factor, note)} onReset={() => write(item)} />;
    })}</div>
  </div>;
}
