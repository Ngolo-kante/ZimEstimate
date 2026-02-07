import { NextRequest, NextResponse } from 'next/server';
import { chromium, type Browser } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { MaterialMatcher, MatchResult } from '@/lib/services/material-matcher';

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
    let browser: Browser | null = null;

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

        // Launch browser
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Navigate with extended timeout
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for product container to load
        const containerSel = containerSelector || 'body';
        await page.waitForSelector(containerSel, { timeout: 15000 });

        // Extract all product cards
        const rawItems = await page.$$eval(
            `${containerSel} ${itemCardSelector}`,
            (cards, selectors) => {
                const results: { name: string; price: string }[] = [];
                const { nameSelector, priceSelector } = selectors as { nameSelector: string; priceSelector: string };

                for (const card of cards) {
                    const nameEl = card.querySelector(nameSelector);
                    const priceEl = card.querySelector(priceSelector);

                    if (nameEl && priceEl) {
                        results.push({
                            name: nameEl.textContent?.trim() || '',
                            price: priceEl.textContent?.trim() || ''
                        });
                    }
                }
                return results;
            },
            { nameSelector, priceSelector }
        );

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
                message: `Category scrape: ${scrapedItems.length} items found, ${matchedCount} matched, ${pendingCount} pending review`,
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
        if (errorMessage.includes("Executable doesn't exist")) {
            errorMessage = 'Playwright browsers not found. Run "npx playwright install" on the server.';
        }

        return NextResponse.json({
            success: false,
            url: '',
            itemsFound: 0,
            itemsMatched: 0,
            itemsPending: 0,
            items: [],
            error: errorMessage
        }, { status: 500 });

    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
