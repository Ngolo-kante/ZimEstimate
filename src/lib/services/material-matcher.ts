import { type SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../database.types';
import { materials } from '@/lib/materials';

/**
 * Enhanced Material Matcher Service
 * 
 * Matches scraped product names to internal material database using:
 * 1. Exact alias lookup (O(1) from material_aliases table)
 * 2. Brand + Grade extraction for cement products
 * 3. Fuzzy string matching with Levenshtein distance
 * 4. Auto-aliasing for high-confidence matches
 * 5. Pending review queue for low-confidence matches
 */

// Known cement brands in Zimbabwe
const CEMENT_BRANDS = ['ppc', 'khayah', 'lafarge', 'dangote', 'sino', 'sinoma'];

// Cement grade patterns (e.g., "32.5N", "42.5R", "22.5")
const GRADE_PATTERN = /(\d{2}\.?\d?)\s*(n|r)?/i;

export interface MatchResult {
    materialCode: string | null;
    confidence: number;
    method: string;
    needsReview: boolean;
    extractedBrand?: string;
    extractedGrade?: string;
}

// Levenshtein distance for fuzzy matching
function similarity(s1: string, s2: string): number {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - editDistance(longer, shorter)) / longerLength;
}

function editDistance(s1: string, s2: string): number {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

export class MaterialMatcher {
    private supabase: SupabaseClient<Database>;

    constructor(supabaseClient: SupabaseClient<Database>) {
        this.supabase = supabaseClient;
    }

    private normalize(text: string): string {
        return text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Extract brand and grade from a cement product name
     */
    private extractCementInfo(name: string): { brand?: string; grade?: string } {
        const normalized = name.toLowerCase();

        // Find brand
        const brand = CEMENT_BRANDS.find(b => normalized.includes(b));

        // Find grade
        const gradeMatch = normalized.match(GRADE_PATTERN);
        let grade: string | undefined;
        if (gradeMatch) {
            const gradeNum = gradeMatch[1].replace('.', '');
            const gradeType = gradeMatch[2]?.toUpperCase() || '';
            grade = `${gradeNum}${gradeType}`;
        }

        return { brand, grade };
    }

    /**
     * Calculate a boosted score for cement products based on brand/grade match
     */
    private calculateCementScore(
        scrapedName: string,
        material: { id: string; name: string; category: string }
    ): number {
        if (material.category !== 'cement') {
            return similarity(this.normalize(scrapedName), this.normalize(material.name));
        }

        const scrapedInfo = this.extractCementInfo(scrapedName);
        const materialInfo = this.extractCementInfo(material.name);

        const baseScore = similarity(this.normalize(scrapedName), this.normalize(material.name));
        let boost = 0;

        // Brand match boost
        if (scrapedInfo.brand && materialInfo.brand && scrapedInfo.brand === materialInfo.brand) {
            boost += 0.15;
        }

        // Grade match boost
        if (scrapedInfo.grade && materialInfo.grade) {
            const scrapedGradeNorm = scrapedInfo.grade.replace(/\D/g, '');
            const materialGradeNorm = materialInfo.grade.replace(/\D/g, '');
            if (scrapedGradeNorm === materialGradeNorm) {
                boost += 0.20;
            }
        }

        return Math.min(baseScore + boost, 1.0);
    }

    /**
     * Match a single scraped product name to a material
     */
    async match(scrapedName: string): Promise<MatchResult> {
        const normalizedName = this.normalize(scrapedName);
        const extractedInfo = this.extractCementInfo(scrapedName);

        // 1. Check Aliases (Exact Match)
        const { data: aliasData } = await this.supabase
            .from('material_aliases')
            .select('material_code, confidence_score')
            .eq('alias_name', normalizedName)
            .maybeSingle();

        const aliasMatch = aliasData as { material_code?: string; confidence_score?: number } | null;

        if (aliasMatch?.material_code) {
            return {
                materialCode: aliasMatch.material_code,
                confidence: aliasMatch.confidence_score ?? 1.0,
                method: 'alias_exact',
                needsReview: false,
                ...extractedInfo
            };
        }

        // 2. Fuzzy Match with brand/grade boosting
        if (!materials || materials.length === 0) {
            return { materialCode: null, confidence: 0, method: 'none', needsReview: true };
        }

        let bestMatch = { id: '', score: 0 };

        for (const material of materials) {
            const score = this.calculateCementScore(scrapedName, material);
            if (score > bestMatch.score) {
                bestMatch = { id: material.id, score };
            }
        }

        // 3. Determine action based on confidence threshold
        if (bestMatch.score > 0.90) {
            // High confidence: Auto-create alias
            console.log(`High confidence match (${bestMatch.score.toFixed(2)}) for "${scrapedName}" -> "${bestMatch.id}". Creating alias.`);
            await this.supabase.from('material_aliases').insert({
                material_code: bestMatch.id,
                alias_name: normalizedName,
                confidence_score: bestMatch.score
            } as never);

            return {
                materialCode: bestMatch.id,
                confidence: bestMatch.score,
                method: 'fuzzy_auto_alias',
                needsReview: false,
                ...extractedInfo
            };
        }

        if (bestMatch.score > 0.70) {
            // Medium confidence: Suggest match but flag for review
            return {
                materialCode: bestMatch.id,
                confidence: bestMatch.score,
                method: 'fuzzy_suggested',
                needsReview: true,
                ...extractedInfo
            };
        }

        if (bestMatch.score > 0.40) {
            // Low confidence: Return match but definitely needs review
            return {
                materialCode: bestMatch.id,
                confidence: bestMatch.score,
                method: 'fuzzy_low',
                needsReview: true,
                ...extractedInfo
            };
        }

        // No match
        return {
            materialCode: null,
            confidence: bestMatch.score,
            method: 'no_match',
            needsReview: true,
            ...extractedInfo
        };
    }

    /**
     * Match multiple scraped items in batch (more efficient for category scraping)
     */
    async matchBatch(items: { name: string; price?: number; url?: string }[]): Promise<(MatchResult & { originalName: string; price?: number })[]> {
        const results: (MatchResult & { originalName: string; price?: number })[] = [];

        for (const item of items) {
            const matchResult = await this.match(item.name);
            results.push({
                ...matchResult,
                originalName: item.name,
                price: item.price
            });
        }

        return results;
    }

    /**
     * Add a pending match to the review queue
     */
    async addToPendingReview(
        scrapedName: string,
        scrapedPrice: number | null,
        sourceUrl: string | null,
        scraperConfigId: string | null,
        matchResult: MatchResult
    ): Promise<void> {
        if (!matchResult.needsReview) return;

        await this.supabase.from('pending_matches').insert({
            scraped_name: scrapedName,
            scraped_price: scrapedPrice,
            source_url: sourceUrl,
            scraper_config_id: scraperConfigId,
            suggested_material_code: matchResult.materialCode,
            confidence: matchResult.confidence,
            match_method: matchResult.method
        } as never);
    }
}
