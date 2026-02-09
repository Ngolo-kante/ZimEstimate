import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { MaterialMatcher, MatchResult } from '@/lib/services/material-matcher';
import Firecrawl from '@mendable/firecrawl-js';
import * as cheerio from 'cheerio';

// Initialize Supabase Client with Service Role Key for backend access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface CategoryScrapePayload {
    configId?: string;
    url: string;
    containerSelector?: string;      // Optional: parent container for product cards
    itemCardSelector: string;        // Selector for each product card
    nameSelector: string;            // Selector for product name within card
    priceSelector: string;           // Selector for price within card
    limit?: number;                  // Max items to scrape (default: 50)
}

interface ScrapedItem {
    name: string;
    price: number;
    rawPrice: string;
    matchResult: MatchResult;
}

interface CategoryScrapeResponse {
    success: boolean;
    url: string;
    itemsFound: number;
    itemsMatched: number;
    itemsPending: number;
    items: ScrapedItem[];
    error?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<CategoryScrapeResponse>> {
    try {
        const payload = await req.json() as CategoryScrapePayload;
        const {
            configId,
            url,
            containerSelector,
            itemCardSelector,
            nameSelector,
            priceSelector,
            limit = 50
        } = payload;

        // Validate required fields
        if (!url || !itemCardSelector || !nameSelector || !priceSelector) {
            return NextResponse.json({
                success: false,
                url: url || '',
                itemsFound: 0,
                itemsMatched: 0,
                itemsPending: 0,
                items: [],
                error: 'Missing required fields: url, itemCardSelector, nameSelector, priceSelector'
            }, { status: 400 });
        }

        if (!supabaseServiceKey) {
            return NextResponse.json({
                success: false,
                url,
                itemsFound: 0,
                itemsMatched: 0,
                itemsPending: 0,
                items: [],
                error: 'Server configuration error: Missing Service Role Key'
            }, { status: 500 });
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
        const matcher = new MaterialMatcher(supabase);

        // Initialize Firecrawl
        const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

        console.log(`[Category Scrape] Starting Firecrawl for ${url}`);

        // Scrape using Firecrawl v4.x API - returns Document directly, throws on error
        const scrapeResult = await firecrawl.scrape(url, {
            formats: ['html'],
            // Extended timeout implicitly handled by Firecrawl, can add overrides if needed
        });

        const html = scrapeResult.html;
        if (!html) {
            throw new Error('Firecrawl returned no HTML content');
        }

        // Parse HTML with Cheerio
        const $ = cheerio.load(html);
        const containerSel = containerSelector || 'body';

        // Extract product cards
        const rawItems: { name: string; price: string }[] = [];

        // Find cards within container
        const $container = $(containerSel);

        if ($container.length === 0) {
            console.warn(`Container selector "${containerSel}" not found.`);
        } else {
            $container.find(itemCardSelector).each((_, element) => {
                const name = $(element).find(nameSelector).text().trim();
                const price = $(element).find(priceSelector).text().trim();

                if (name && price) {
                    rawItems.push({ name, price });
                }
            });
        }

        console.log(`[Category Scrape] Extracted ${rawItems.length} raw items.`);

        // Apply limit
        const limitedItems = rawItems.slice(0, limit);

        // Parse prices and match
        const scrapedItems: ScrapedItem[] = [];
        let matchedCount = 0;
        let pendingCount = 0;

        for (const item of limitedItems) {
            if (!item.name || !item.price) continue;

            // Parse price
            const cleanPriceString = item.price.replace(/[^0-9.]/g, '');
            const price = parseFloat(cleanPriceString);

            if (isNaN(price)) continue;

            // Match to material
            const matchResult = await matcher.match(item.name);

            scrapedItems.push({
                name: item.name,
                price,
                rawPrice: item.price,
                matchResult
            });

            if (matchResult.materialCode && !matchResult.needsReview) {
                matchedCount++;
            } else if (matchResult.needsReview) {
                pendingCount++;
            }

            // Save to price_observations if matched
            if (matchResult.materialCode) {
                const material = await import('@/lib/materials').then(m =>
                    m.materials.find(mat => mat.id === matchResult.materialCode)
                );

                await supabase.from('price_observations').insert({
                    material_key: matchResult.materialCode,
                    material_name: material?.name || item.name,
                    price_usd: price,
                    confidence: Math.round(matchResult.confidence * 100) as 1 | 2 | 3 | 4 | 5,
                    source_url: url,
                    scraped_at: new Date().toISOString(),
                    review_status: matchResult.needsReview ? 'pending' : 'auto'
                } as never);
            }

            // Add to pending review if needed
            if (matchResult.needsReview) {
                await matcher.addToPendingReview(
                    item.name,
                    price,
                    url,
                    configId || null,
                    matchResult
                );
            }
        }

        // Update config last run time
        if (configId) {
            await supabase.from('scraper_configs').update({
                last_successful_run_at: new Date().toISOString()
            } as never).eq('id', configId);

            // Log success
            await supabase.from('scraper_logs').insert({
                scraper_config_id: configId,
                status: 'success',
                message: `Category scrape (Firecrawl): ${scrapedItems.length} items found, ${matchedCount} matched, ${pendingCount} pending review`,
                scraped_data: { itemCount: scrapedItems.length, matchedCount, pendingCount }
            } as never);
        }

        return NextResponse.json({
            success: true,
            url,
            itemsFound: scrapedItems.length,
            itemsMatched: matchedCount,
            itemsPending: pendingCount,
            items: scrapedItems
        });

    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('Category Scraper Error:', err);

        let errorMessage = err.message;

        return NextResponse.json({
            success: false,
            url: '',
            itemsFound: 0,
            itemsMatched: 0,
            itemsPending: 0,
            items: [],
            error: errorMessage
        }, { status: 500 });
    }
}
