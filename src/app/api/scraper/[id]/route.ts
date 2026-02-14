import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { enforceCsrf, enforceRateLimit, sanitizeText, sanitizeUrl } from '@/lib/server/security';
import { requireAdmin } from '@/lib/server/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } // Awaiting params for Next.js 15+ compatibility
) {
    try {
        const rateLimit = enforceRateLimit(req, {
            keyPrefix: 'scraper:delete',
            limit: 15,
            windowMs: 60_000,
        });
        if (rateLimit) return rateLimit;

        const csrf = enforceCsrf(req);
        if (csrf) return csrf;

        const auth = await requireAdmin(req);
        if (auth instanceof NextResponse) return auth;

        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const params = await context.params;
        const id = sanitizeText(params.id, { maxLength: 80 });

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

        const { error } = await supabase
            .from('scraper_configs')
            .delete()
            .eq('id', id);

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error('Delete scraper error:', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const rateLimit = enforceRateLimit(req, {
            keyPrefix: 'scraper:update',
            limit: 15,
            windowMs: 60_000,
        });
        if (rateLimit) return rateLimit;

        const csrf = enforceCsrf(req);
        if (csrf) return csrf;

        const auth = await requireAdmin(req);
        if (auth instanceof NextResponse) return auth;

        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const params = await context.params;
        const id = sanitizeText(params.id, { maxLength: 80 });

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        const body = await req.json();
        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

        const payload = {
            site_name: sanitizeText(body.site_name, { maxLength: 120 }) || undefined,
            base_url: sanitizeUrl(body.base_url) || undefined,
            price_selector: sanitizeText(body.price_selector, { maxLength: 200 }) || undefined,
            item_name_selector: sanitizeText(body.item_name_selector, { maxLength: 200 }) || undefined,
            cron_schedule: sanitizeText(body.cron_schedule, { maxLength: 50 }) || undefined,
            category: sanitizeText(body.category, { maxLength: 50 }) || undefined,
            scrape_mode: sanitizeText(body.scrape_mode, { maxLength: 20 }) || undefined,
            container_selector: sanitizeText(body.container_selector, { maxLength: 200 }) || undefined,
            item_card_selector: sanitizeText(body.item_card_selector, { maxLength: 200 }) || undefined,
            is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('scraper_configs')
            .update(payload as never)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true, data });
    } catch (err: unknown) {
        console.error('Update scraper error:', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
