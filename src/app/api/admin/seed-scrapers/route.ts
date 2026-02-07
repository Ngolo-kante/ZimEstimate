import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

type ScraperConfigInsert = Database['public']['Tables']['scraper_configs']['Insert'];

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
        return NextResponse.json({ success: false, error: 'Missing Service Role Key' }, { status: 500 });
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    const configs: ScraperConfigInsert[] = [
        { site_name: 'Halsted Builders Express', base_url: 'https://halsteds.co.zw/msasa/categories/building-materials', price_selector: '.price', item_name_selector: '.product-name', cron_schedule: 'daily', category: 'general' },
        { site_name: 'Electrosales (Powders)', base_url: 'https://www.electrosales.co.zw/shop/catalog/building_powders', price_selector: '.price-amount', item_name_selector: '.product-title', cron_schedule: 'weekly', category: 'cement' },
        { site_name: 'Electrosales (Timber)', base_url: 'https://www.electrosales.co.zw/shop/catalog/building_timber', price_selector: '.price-amount', item_name_selector: '.product-title', cron_schedule: 'weekly', category: 'timber' },
        { site_name: 'Union Hardware (General)', base_url: 'https://unionhardware.co.zw/shop/product-category/building-materials/', price_selector: '.woocommerce-Price-amount', item_name_selector: '.woocommerce-loop-product__title', cron_schedule: 'weekly', category: 'general' },
        { site_name: 'PG Industries', base_url: 'https://www.pgiz.co.zw/category', price_selector: '.price', item_name_selector: '.product-title', cron_schedule: 'weekly', category: 'roofing' },
        { site_name: 'Vakisa Builders Express', base_url: 'https://www.vakisa.co.zw/', price_selector: '.product-price', item_name_selector: '.product-name', cron_schedule: 'weekly', category: 'general' },
        { site_name: 'Bhola Hardware', base_url: 'https://www.bholahardware.com/diy', price_selector: '.price', item_name_selector: '.title', cron_schedule: 'weekly', category: 'hardware' },
        { site_name: 'ZBMS', base_url: 'https://www.zbms.co.zw/product-category/building-materials/', price_selector: '.price', item_name_selector: '.product-title', cron_schedule: 'daily', category: 'general' },
        { site_name: 'Lafarge Cement (Union)', base_url: 'https://unionhardware.co.zw/msasa/product-category/building-materials/cement/lafarge/', price_selector: '.woocommerce-Price-amount', item_name_selector: '.woocommerce-loop-product__title', cron_schedule: 'daily', category: 'cement' },
        { site_name: 'PPC Cement (Union)', base_url: 'https://unionhardware.co.zw/pomona/product-category/building-materials/ppc/', price_selector: '.woocommerce-Price-amount', item_name_selector: '.woocommerce-loop-product__title', cron_schedule: 'daily', category: 'cement' },
        { site_name: 'Sino-Zimbabwe Cement (ZBMS)', base_url: 'https://www.zbms.co.zw/shop/building-materials/cement/premiummidlands/', price_selector: '.price', item_name_selector: '.product-title', cron_schedule: 'daily', category: 'cement' }
    ];

    const results = [];

    for (const config of configs) {
        // Check if exists using base_url as unique key for this simplified check
        const { data: existing } = await supabase.from('scraper_configs').select('id').eq('base_url', config.base_url).maybeSingle();

        if (!existing) {
            const { error } = await supabase.from('scraper_configs').insert(config as never);
            if (error) {
                results.push({ name: config.site_name, status: 'failed', error: error.message });
            } else {
                results.push({ name: config.site_name, status: 'created' });
            }
        } else {
            results.push({ name: config.site_name, status: 'skipped (exists)' });
        }
    }

    return NextResponse.json({ success: true, results });
}
