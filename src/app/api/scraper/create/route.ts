import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { enforceCsrf, enforceRateLimit, sanitizeText, sanitizeUrl } from '@/lib/server/security';
import { requireAdmin } from '@/lib/server/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
    try {
        const rateLimit = enforceRateLimit(req, {
            keyPrefix: 'scraper:create',
            limit: 15,
            windowMs: 60_000,
        });
        if (rateLimit) return rateLimit;

        const csrf = enforceCsrf(req);
        if (csrf) return csrf;

        const auth = await requireAdmin(req);
        if (auth instanceof NextResponse) return auth;

        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error: Missing Service Role Key' }, { status: 500 });
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
        const body = await req.json();

        const siteName = sanitizeText(body.site_name, { maxLength: 120 });
        const baseUrl = sanitizeUrl(body.base_url);
        const priceSelector = sanitizeText(body.price_selector, { maxLength: 200 });
        const itemNameSelector = sanitizeText(body.item_name_selector, { maxLength: 200 });
        const cronSchedule = sanitizeText(body.cron_schedule, { maxLength: 50, fallback: 'weekly' });
        const category = sanitizeText(body.category, { maxLength: 50, fallback: 'general' });
        const scrapeMode = sanitizeText(body.scrape_mode, { maxLength: 20, fallback: 'single' });
        const containerSelector = sanitizeText(body.container_selector, { maxLength: 200 });
        const itemCardSelector = sanitizeText(body.item_card_selector, { maxLength: 200 });

        // Validate required fields
        if (!siteName || !baseUrl) {
            return NextResponse.json({ error: 'Missing required fields: site_name and base_url are required' }, { status: 400 });
        }

        // Construct payload to ensure we only insert allowed fields and handle nulls
        const payload = {
            site_name: siteName,
            base_url: baseUrl,
            // Required fields
            price_selector: priceSelector || '',
            item_name_selector: itemNameSelector || '',
            cron_schedule: cronSchedule || 'weekly',
            category: category === 'all' ? 'general' : (category || 'general'),

            // Optional/Conditional fields
            scrape_mode: scrapeMode || 'single',
            container_selector: scrapeMode === 'category' ? containerSelector : null,
            item_card_selector: scrapeMode === 'category' ? itemCardSelector : null,

            // Defaults
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('scraper_configs')
            .insert([payload] as never)
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error:', error);
            throw new Error(error.message);
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('Create scraper error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
