import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { MaterialMatcher } from '@/lib/services/material-matcher';

// Initialize Supabase Client with Service Role Key for backend access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
    let browser;
    try {
        const { configId, url, priceSelector, nameSelector } = await req.json();

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
        let matchedMaterialId = null;

        if (matchResult.materialId) {
            matchedMaterialId = matchResult.materialId;
            // Fetch the canonical name for better data quality
            const { data: material } = await supabase.from('materials').select('name').eq('id', matchedMaterialId).single();
            if (material) {
                finalItemName = material.name;
            }
        }

        // --- Save Results ---

        // 1. Update Weekly Prices (The public price list)
        await supabase.from('weekly_prices').upsert({
            item_name: finalItemName,
            average_price: price,
            currency: 'USD', // Defaulting to USD for now, parser should ideally detect
            source_url: url,
            last_updated: new Date().toISOString()
        } as any, { onConflict: 'item_name' } as any); // Type assertion for simple schema matching

        // 2. Update Configuration Status (if configId provided)
        if (configId) {
            await supabase.from('scraper_configs').update({
                last_successful_run_at: new Date().toISOString()
            } as any).eq('id', configId);
        }

        // 3. Log the success (Optional but good for debugging)
        if (configId) {
            await supabase.from('scraper_logs').insert({
                scraper_config_id: configId,
                status: 'success',
                message: `Scraped: ${finalItemName} @ $${price}`,
                scraped_data: { raw_name: nameText, raw_price: priceText, match_method: matchResult.method }
            } as any);
        }

        return NextResponse.json({
            success: true,
            name: finalItemName,
            price: price,
            rawPrice: priceText,
            originalName: nameText,
            match: matchResult
        });

    } catch (error: any) {
        console.error('Scraper Error:', error);

        // Attempt to log failure if possible
        try {
            if (supabaseServiceKey) {
                const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
                const { configId } = await req.json().catch(() => ({ configId: null }));
                if (configId) {
                    await supabase.from('scraper_logs').insert({
                        scraper_config_id: configId,
                        status: 'failure',
                        message: error.message || 'Unknown error',
                    });
                }
            }
        } catch (e) { /* ignore logging error */ }

        let errorMessage = error.message;
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
