import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface RunAllPayload {
    category?: string;
    configIds?: string[];
}

interface RunResult {
    configId: string;
    siteName: string;
    success: boolean;
    itemsFound?: number;
    itemsMatched?: number;
    error?: string;
}

interface RunAllResponse {
    success: boolean;
    total: number;
    succeeded: number;
    failed: number;
    results: RunResult[];
}

// Define the config type since generated types may not include new columns
interface ScraperConfigRow {
    id: string;
    site_name: string;
    base_url: string;
    price_selector: string;
    item_name_selector: string;
    cron_schedule: string;
    is_active: boolean;
    category?: string;
    scrape_mode?: string;
    container_selector?: string;
    item_card_selector?: string;
    last_successful_run_at?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<RunAllResponse>> {
    try {
        const payload = await req.json() as RunAllPayload;
        const { category, configIds } = payload;

        if (!supabaseServiceKey) {
            return NextResponse.json({
                success: false,
                total: 0,
                succeeded: 0,
                failed: 0,
                results: []
            }, { status: 500 });
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

        // Get active scraper configs
        let query = supabase
            .from('scraper_configs')
            .select('*')
            .eq('is_active', true);

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        if (configIds && configIds.length > 0) {
            query = query.in('id', configIds);
        }

        const { data, error } = await query;
        const configs = data as unknown as ScraperConfigRow[] | null;

        if (error || !configs) {
            return NextResponse.json({
                success: false,
                total: 0,
                succeeded: 0,
                failed: 0,
                results: []
            }, { status: 500 });
        }

        const results: RunResult[] = [];
        let succeeded = 0;
        let failed = 0;

        // Get the base URL for internal API calls
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        for (const config of configs) {
            try {
                const scrapeMode = config.scrape_mode || 'single';

                let response: Response;

                if (scrapeMode === 'category') {
                    // Use category scraper
                    response = await fetch(`${baseUrl}/api/scraper/category`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            configId: config.id,
                            url: config.base_url,
                            containerSelector: config.container_selector,
                            itemCardSelector: config.item_card_selector,
                            nameSelector: config.item_name_selector,
                            priceSelector: config.price_selector
                        })
                    });
                } else {
                    // Use single product scraper
                    response = await fetch(`${baseUrl}/api/scraper/test`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            configId: config.id,
                            url: config.base_url,
                            priceSelector: config.price_selector,
                            nameSelector: config.item_name_selector
                        })
                    });
                }

                const result = await response.json();

                if (result.success) {
                    succeeded++;
                    results.push({
                        configId: config.id,
                        siteName: config.site_name,
                        success: true,
                        itemsFound: result.itemsFound || 1,
                        itemsMatched: result.itemsMatched || (result.match?.materialCode ? 1 : 0)
                    });
                } else {
                    failed++;
                    results.push({
                        configId: config.id,
                        siteName: config.site_name,
                        success: false,
                        error: result.error || 'Unknown error'
                    });
                }
            } catch (err) {
                failed++;
                results.push({
                    configId: config.id,
                    siteName: config.site_name,
                    success: false,
                    error: err instanceof Error ? err.message : 'Unknown error'
                });
            }
        }

        return NextResponse.json({
            success: failed === 0,
            total: configs.length,
            succeeded,
            failed,
            results
        });

    } catch (error) {
        console.error('Run All Error:', error);
        return NextResponse.json({
            success: false,
            total: 0,
            succeeded: 0,
            failed: 0,
            results: []
        }, { status: 500 });
    }
}
