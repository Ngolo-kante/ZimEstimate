import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } // Awaiting params for Next.js 15+ compatibility
) {
    try {
        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const params = await context.params;
        const id = params.id;

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
    } catch (err: any) {
        console.error('Delete scraper error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const params = await context.params;
        const id = params.id;

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        const body = await req.json();
        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('scraper_configs')
            .update(body as never)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('Update scraper error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
