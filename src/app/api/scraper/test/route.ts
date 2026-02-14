import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { MaterialMatcher } from '@/lib/services/material-matcher';
import Firecrawl from '@mendable/firecrawl-js';
import * as cheerio from 'cheerio';
import { enforceCsrf, enforceRateLimit, sanitizeText, sanitizeUrl } from '@/lib/server/security';
import { requireAdmin } from '@/lib/server/auth';

// Initialize Supabase Client with Service Role Key for backend access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ScraperTestPayload = {
    configId?: string;
    url?: string;
    priceSelector?: string;
    nameSelector?: string;
};

type ScraperLogInsert = Database['public']['Tables']['scraper_logs']['Insert'];
type ScraperConfigUpdate = Database['public']['Tables']['scraper_configs']['Update'];

export async function POST(req: NextRequest) {
    let configId: string | null = null;
    try {
        const rateLimit = enforceRateLimit(req, {
            keyPrefix: 'scraper:test',
            limit: 10,
            windowMs: 60_000,
        });
        if (rateLimit) return rateLimit;

        const csrf = enforceCsrf(req);
        if (csrf) return csrf;

        const auth = await requireAdmin(req);
        if (auth instanceof NextResponse) return auth;

        const payload = (await req.json()) as ScraperTestPayload;
        const url = sanitizeUrl(payload.url);
        const priceSelector = sanitizeText(payload.priceSelector, { maxLength: 200 });
        const nameSelector = sanitizeText(payload.nameSelector, { maxLength: 200 });
        configId = typeof payload.configId === 'string' ? payload.configId : null;

        if (!url || !priceSelector || !nameSelector) {
            return NextResponse.json({ success: false, error: 'Missing required configuration fields' }, { status: 400 });
        }

        if (!supabaseServiceKey) {
            return NextResponse.json({ success: false, error: 'Server configuration error: Missing Service Role Key' }, { status: 500 });
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

        // Initialize Firecrawl
        const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

        console.log(`Scraping URL with Firecrawl: ${url}`);

        // Scrape using Firecrawl v4.x API - returns Document directly, throws on error
        const scrapeResult = await firecrawl.scrape(url, {
            formats: ['html'],
            // Add options if needed, e.g. waitFor: 5000 if dynamic content is slow
        });

        const html = scrapeResult.html;
        if (!html) {
            throw new Error('Firecrawl returned no HTML content');
        }

        // Parse HTML with Cheerio
        const $ = cheerio.load(html);

        // Extract data
        const priceText = $(priceSelector).first().text().trim() || '';
        const nameText = $(nameSelector).first().text().trim() || '';

        console.log(`Extracted - Name: "${nameText}", Price: "${priceText}"`);

        if (!priceText) {
            throw new Error(`Price selector "${priceSelector}" returned empty text`);
        }

        // Clean data
        // Remove non-numeric chars except dot, but safeguard against multiple dots or currency symbols
        const cleanPriceString = priceText.replace(/[^0-9.]/g, '');
        const price = parseFloat(cleanPriceString);

        if (isNaN(price)) {
            throw new Error(`Failed to parse price from "${priceText}"`);
        }

        // --- Product Matching ---
        const matcher = new MaterialMatcher(supabase);
        const matchResult = await matcher.match(nameText);

        let finalItemName = nameText;
        let matchedMaterialCode: string | null = null;

        if (matchResult.materialCode) {
            matchedMaterialCode = matchResult.materialCode;
            // Use static material list name when matched
            const { materials } = await import('@/lib/materials');
            const matched = materials.find((material) => material.id === matchedMaterialCode);
            if (matched) {
                finalItemName = matched.name;
            }
        }

        // --- Save Results ---

        if (matchedMaterialCode) {
            // 1. Insert into Price Observations
            // Convert 0-1 confidence to 1-5 scale for database
            const confidenceScale = Math.max(1, Math.min(5, Math.round(matchResult.confidence * 4 + 1)));
        const observation = {
            material_key: matchedMaterialCode,
            material_name: finalItemName,
            price_usd: price,
            confidence: confidenceScale,
            url: url,
            scraped_at: new Date().toISOString(),
            review_status: matchResult.needsReview ? 'pending' : 'auto'
        };

            await supabase.from('price_observations').insert(observation as never);
        }

        // 2. Add to pending review queue if needed
        if (matchResult.needsReview) {
            await matcher.addToPendingReview(
                nameText,
                price,
                url,
                configId,
                matchResult
            );
        }

        // 3. Update Configuration Status (if configId provided)
        if (configId) {
            const configUpdate: ScraperConfigUpdate = {
                last_successful_run_at: new Date().toISOString()
            };
            await supabase.from('scraper_configs').update(configUpdate as never).eq('id', configId);
        }

        // 4. Log the success
        if (configId) {
            const logEntry: ScraperLogInsert = {
                scraper_config_id: configId,
                status: 'success',
                message: matchedMaterialCode
                    ? `Scraped & Matched: ${finalItemName} @ $${price}`
                    : `Scraped (Unmatched): ${nameText} @ $${price}`,
                scraped_data: { raw_name: nameText, raw_price: priceText, match_method: matchResult.method }
            };
            await supabase.from('scraper_logs').insert(logEntry as never);
        }

        return NextResponse.json({
            success: true,
            name: finalItemName,
            price: price,
            rawPrice: priceText,
            originalName: nameText,
            match: matchResult
        });

    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('Scraper Error:', err);

        // Attempt to log failure if possible
        try {
            if (supabaseServiceKey) {
                const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
                if (configId) {
                    const logEntry: ScraperLogInsert = {
                        scraper_config_id: configId,
                        status: 'failure',
                        message: err.message || 'Unknown error',
                    };
                    await supabase.from('scraper_logs').insert(logEntry as never);
                }
            }
        } catch { /* ignore logging error */ }

        // Simplify error message
        const errorMessage = err.message;

        return NextResponse.json({
            success: false,
            error: errorMessage
        }, { status: 500 });
    }
}
