import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
    try {
        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error: Missing Service Role Key' }, { status: 500 });
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
        const body = await req.json();

        // Validate required fields
        if (!body.site_name || !body.base_url) {
            return NextResponse.json({ error: 'Missing required fields: site_name and base_url are required' }, { status: 400 });
        }

        // Construct payload to ensure we only insert allowed fields and handle nulls
        const payload = {
            site_name: body.site_name,
            base_url: body.base_url,
            // Required fields
            price_selector: body.price_selector || '',
            item_name_selector: body.item_name_selector || '',
            cron_schedule: body.cron_schedule || 'weekly',
            category: body.category === 'all' ? 'general' : (body.category || 'general'),

            // Optional/Conditional fields
            scrape_mode: body.scrape_mode || 'single',
            container_selector: body.scrape_mode === 'category' ? body.container_selector : null,
            item_card_selector: body.scrape_mode === 'category' ? body.item_card_selector : null,

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
