import { createServerClient } from '@supabase/supabase-js';
import { Database } from '../database.types';

/**
 * Service to handle product matching between scraped items and the internal material database.
 * 
 * Strategy (The "Best Method"):
 * 1. Normalization: Clean input string (lowercase, remove special chars).
 * 2. Exact Alias Match: Check `material_aliases` table for O(1) lookup.
 * 3. Fuzzy/Levenshtein Match: If no exact alias, compare against canonical material names using String Similarity.
 * 4. Auto-Alias: If high confidence match found (e.g. > 90%), automatically create a new alias to speed up future matches.
 */

// Simple Levenshtein distance implementation for environments where we can't import external libs
function similarity(s1: string, s2: string): number {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    const longerLength = longer.length;
    if (longerLength === 0) {
        return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength.toString());
}

function editDistance(s1: string, s2: string) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    const costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i == 0)
                costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0)
            costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

export class MaterialMatcher {
    private supabase;

    constructor(supabaseClient: any) {
        this.supabase = supabaseClient;
    }

    private normalize(text: string): string {
        return text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    }

    async match(scrapedName: string): Promise<{ materialId: string | null; confidence: number; method: string }> {
        const normalizedName = this.normalize(scrapedName);

        // 1. Check Aliases (Exact Match)
        const { data: aliasMatch } = await this.supabase
            .from('material_aliases')
            .select('material_id, confidence_score')
            .eq('alias_name', normalizedName)
            .maybeSingle();

        if (aliasMatch) {
            return {
                materialId: aliasMatch.material_id,
                confidence: aliasMatch.confidence_score,
                method: 'alias_exact'
            };
        }

        // 2. Fuzzy Match against Canonical Materials
        // Performance Note: Fetching all materials is okay for < 1000 items. 
        // For scale, use Postgres pg_trgm extension or vector embeddings.
        const { data: materials } = await this.supabase
            .from('materials')
            .select('id, name');

        if (!materials) return { materialId: null, confidence: 0, method: 'none' };

        let bestMatch = { id: '', score: 0 };

        for (const material of materials) {
            const score = similarity(normalizedName, this.normalize(material.name));
            if (score > bestMatch.score) {
                bestMatch = { id: material.id, score };
            }
        }

        // 3. Auto-Create Alias if high confidence
        if (bestMatch.score > 0.85) {
            console.log(`High confidence match (${bestMatch.score}) for "${scrapedName}" -> "${bestMatch.id}". Creating alias.`);
            await this.supabase.from('material_aliases').insert({
                material_id: bestMatch.id,
                alias_name: normalizedName,
                confidence_score: bestMatch.score
            });
            return { materialId: bestMatch.id, confidence: bestMatch.score, method: 'fuzzy_auto_alias' };
        }

        return { materialId: bestMatch.score > 0.4 ? bestMatch.id : null, confidence: bestMatch.score, method: 'fuzzy' };
    }
}
