import { NextRequest, NextResponse } from 'next/server';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { requireAdmin } from '@/lib/server/auth';
import { ScraperRunnerError, runCategoryScrape, type CategoryScrapePayload, type CategoryScrapeResult } from '@/lib/server/scraperRunner';

export async function POST(
    req: NextRequest
): Promise<NextResponse<CategoryScrapeResult | { success: false; url: string; itemsFound: number; itemsMatched: number; itemsPending: number; items: []; error: string }>> {
    try {
        const rateLimit = await enforceRateLimit(req, {
            keyPrefix: 'scraper:category',
            limit: 10,
            windowMs: 60_000,
        });
        if (rateLimit) return rateLimit as NextResponse<never>;

        const csrf = enforceCsrf(req);
        if (csrf) return csrf as NextResponse<never>;

        const auth = await requireAdmin(req);
        if (auth instanceof NextResponse) return auth as NextResponse<never>;

        const payload = await req.json() as CategoryScrapePayload;
        const result = await runCategoryScrape(payload);

        return NextResponse.json(result);

    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        const status = error instanceof ScraperRunnerError ? error.status : 500;
        console.error('Category Scraper Error:', err);

        const errorMessage = err.message;

        return NextResponse.json({
            success: false,
            url: '',
            itemsFound: 0,
            itemsMatched: 0,
            itemsPending: 0,
            items: [],
            error: errorMessage
        }, { status });
    }
}
