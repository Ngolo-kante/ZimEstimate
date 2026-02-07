import { NextRequest, NextResponse } from 'next/server';
import { chromium, type Browser } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { MaterialMatcher } from '@/lib/services/material-matcher';

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
    let browser: Browser | null = null;
    let configId: string | null = null;
    try {
        const payload = (await req.json()) as ScraperTestPayload;
        const url = typeof payload.url === 'string' ? payload.url : '';
        const priceSelector = typeof payload.priceSelector === 'string' ? payload.priceSelector : '';
        const nameSelector = typeof payload.nameSelector === 'string' ? payload.nameSelector : '';
        configId = typeof payload.configId === 'string' ? payload.configId : null;

        if (!url || !priceSelector || !nameSelector) {
            return NextResponse.json({ success: false, error: 'Missing required configuration fields' }, { status: 400 });
        }

        if (!supabaseServiceKey) {
            return NextResponse.json({ success: false, error: 'Server configuration error: Missing Service Role Key' }, { status: 500 });
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

        // Launch Playwright
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Navigate to URL with extended timeout
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Wait for selectors
        await page.waitForSelector(priceSelector, { timeout: 15000 });
        if (nameSelector) {
            await page.waitForSelector(nameSelector, { timeout: 15000 });
        }

        // Extract data
        const priceText = await page.$eval(priceSelector, (el) => el.textContent?.trim() || '');
        const nameText = await page.$eval(nameSelector, (el) => el.textContent?.trim() || '');

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
            const observation = {
                material_key: matchedMaterialCode,
                material_name: finalItemName,
                price_usd: price,
                confidence: matchResult.confidence,
                source_url: url,
                scraped_at: new Date().toISOString(),
            };

            await supabase.from('price_observations').insert(observation as never);
        }

        // 2. Update Configuration Status (if configId provided)
        if (configId) {
            const configUpdate: ScraperConfigUpdate = {
                last_successful_run_at: new Date().toISOString()
            };
            await supabase.from('scraper_configs').update(configUpdate as never).eq('id', configId);
        }

        // 3. Log the success
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

        let errorMessage = err.message;
        if (errorMessage.includes('Executable doesn\'t exist')) {
            errorMessage = 'Playwright browsers not found. Please run "npx playwright install" on the server.';
        }

        return NextResponse.json({
            success: false,
            error: errorMessage
        }, { status: 500 });

    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
