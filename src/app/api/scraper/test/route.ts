import { NextRequest, NextResponse } from 'next/server';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { requireAdmin } from '@/lib/server/auth';
import { ScraperRunnerError, runSingleScrape, type ScraperTestPayload } from '@/lib/server/scraperRunner';

export async function POST(req: NextRequest) {
    try {
        const rateLimit = enforceRateLimit(req, {
            keyPrefix: 'scraper:test',
            limit: 10,
            windowMs: 60_000,
        });
        if (rateLimit) return rateLimit;

        const csrf = enforceCsrf(req);
        if (csrf) return csrf;

        const auth = await requireAdmin(req);
        if (auth instanceof NextResponse) return auth;

        const payload = (await req.json()) as ScraperTestPayload;
        const result = await runSingleScrape(payload);

        return NextResponse.json(result);

    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        const status = error instanceof ScraperRunnerError ? error.status : 500;
        console.error('Scraper Error:', err);

        return NextResponse.json({
            success: false,
            error: err.message
        }, { status });
    }
}
