/**
 * Seed script to import researched price data from various sources
 * Run with: npx tsx --env-file=.env.local scripts/seed-research-prices.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local manually
function loadEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                if (key && !process.env[key]) {
                    process.env[key] = value;
                }
            }
        }
    }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables:');
    if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Research data from Zimbabwe building materials market
// Material codes match IDs from src/lib/materials.ts
const researchData = {
    cement: [
        {
            product_name: "PPC Cement Surecem 32.5",
            material_code: "cement-ppc-surecem-325r",
            price_usd: 10.85,
            source_url: "https://halsteds.co.zw/msasa_store/ppc-cement-surecem-32-5-50kg-harare.html",
            supplier: "Halsted Builders Express",
            location: "Harare"
        },
        {
            product_name: "PPC Cement Surecem 32.5 (Kwekwe)",
            material_code: "cement-ppc-surecem-325r",
            price_usd: 10.70,
            source_url: "https://halsteds.co.zw/kwekwe/ppc-cement-surecem-32-5-50kg-kwekwe.html",
            supplier: "Halsted Builders Express",
            location: "Kwekwe"
        },
        {
            product_name: "Khayah Cement PC15 32.5",
            material_code: "cement-khayah-portland",
            price_usd: 11.03,
            source_url: "https://halsteds.co.zw/msasa_store/khayah-cement-pc15-32-5-50kg-harare.html",
            supplier: "Halsted Builders Express",
            location: "Harare"
        },
        {
            product_name: "Khayah Cement 42.5 Superset",
            material_code: "cement-khayah-supaset-425r",
            price_usd: 12.16,
            source_url: "https://halsteds.co.zw/msasa_store/khayah-cement-42-5-superset-50kg-harare.html",
            supplier: "Halsted Builders Express",
            location: "Harare"
        },
        {
            product_name: "PPC 32.5 Grade",
            material_code: "cement-325",
            price_usd: 10.24,
            source_url: "https://www.bholahardware.com/",
            supplier: "Bhola Hardware",
            location: "Harare"
        },
        {
            product_name: "PPC 42.5 Grade",
            material_code: "cement-425",
            price_usd: 11.78,
            source_url: "https://www.bholahardware.com/",
            supplier: "Bhola Hardware",
            location: "Harare"
        },
        {
            product_name: "PPC Surebuild 42.5R",
            material_code: "cement-ppc-surebuild-425r",
            price_usd: 14.00,
            source_url: "https://www.facebook.com/groups/letsbuildourhomeszw/",
            supplier: "ZBMS",
            location: "Harare"
        },
        {
            product_name: "Dangote Portland 32.5R",
            material_code: "cement-dangote-portland-325r",
            price_usd: 12.50,
            source_url: "https://www.facebook.com/groups/letsbuildourhomeszw/",
            supplier: "ZBMS",
            location: "Harare"
        },
        {
            product_name: "Sinoma High-Strength 42.5R",
            material_code: "cement-sino-sinoma-high-strength-425r",
            price_usd: 16.00,
            source_url: "https://www.facebook.com/groups/letsbuildourhomeszw/",
            supplier: "ZBMS",
            location: "Harare"
        },
        {
            product_name: "Khayah SupaSet 42.5R",
            material_code: "cement-khayah-supaset-425r",
            price_usd: 12.00,
            source_url: "https://www.instagram.com/reel/DUYkrEbDQcD/",
            supplier: "Build It",
            location: "Harare"
        }
    ],
    bricks: [
        {
            product_name: "Semi-common Bricks",
            material_code: "farm-brick",
            price_usd: 65.00,
            source_url: "https://www.towtruck24zim.co.zw/blog/post/2199355/bricks-prices-in-harare",
            supplier: "Bonita Logistics",
            location: "Harare"
        },
        {
            product_name: "Rustic Face Bricks",
            material_code: "brick-face-red",
            price_usd: 395.00,
            source_url: "https://www.towtruck24zim.co.zw/blog/post/2199355/bricks-prices-in-harare",
            supplier: "Bonita Logistics",
            location: "Harare"
        },
        {
            product_name: "Red Common Bricks",
            material_code: "brick-face-red",
            price_usd: 140.00,
            source_url: "https://www.facebook.com/groups/419512348407386/",
            supplier: "Marketplace",
            location: "Harare"
        },
        {
            product_name: "Common Bricks",
            material_code: "brick-common",
            price_usd: 108.00,
            source_url: "https://www.classifieds.co.zw/zimbabwe-cement-bricks",
            supplier: "Macdonald Bricks",
            location: "Harare"
        },
        {
            product_name: "Cement Common Bricks",
            material_code: "brick-common",
            price_usd: 90.00,
            source_url: "https://www.facebook.com/groups/419512348407386/",
            supplier: "Marketplace",
            location: "Harare"
        },
        {
            product_name: "Botswana Face Bricks",
            material_code: "brick-face-brown",
            price_usd: 450.00,
            source_url: "https://www.facebook.com/groups/1218411402314810/",
            supplier: "Marketplace",
            location: "Harare"
        }
    ]
};

// Material aliases to improve matching (using IDs from materials.ts)
const newAliases = [
    // PPC Cement variants
    { material_code: "cement-ppc-surecem-325r", alias_name: "ppc cement surecem 325" },
    { material_code: "cement-ppc-surecem-325r", alias_name: "ppc surecem 325" },
    { material_code: "cement-ppc-surecem-325r", alias_name: "ppc surecem" },
    { material_code: "cement-325", alias_name: "ppc 325 grade" },
    { material_code: "cement-325", alias_name: "ppc cement 325" },
    { material_code: "cement-425", alias_name: "ppc 425 grade" },
    { material_code: "cement-425", alias_name: "ppc cement 425" },
    { material_code: "cement-ppc-surebuild-425r", alias_name: "ppc surebuild" },
    { material_code: "cement-ppc-surebuild-425r", alias_name: "ppc surebuild 425" },

    // Khayah Cement
    { material_code: "cement-khayah-portland", alias_name: "khayah cement 325" },
    { material_code: "cement-khayah-portland", alias_name: "khayah pc15 325" },
    { material_code: "cement-khayah-portland", alias_name: "khayah portland" },
    { material_code: "cement-khayah-supaset-425r", alias_name: "khayah cement 425" },
    { material_code: "cement-khayah-supaset-425r", alias_name: "khayah superset" },
    { material_code: "cement-khayah-supaset-425r", alias_name: "khayah supaset" },
    { material_code: "cement-khayah-supaset-425r", alias_name: "khayah 425 superset" },

    // Dangote Cement
    { material_code: "cement-dangote-portland-325r", alias_name: "dangote cement" },
    { material_code: "cement-dangote-portland-325r", alias_name: "dangote 325" },
    { material_code: "cement-dangote-portland-425n", alias_name: "dangote 425" },

    // Sino-Zimbabwe Cement
    { material_code: "cement-sino-sinoma-high-strength-425r", alias_name: "sinoma cement" },
    { material_code: "cement-sino-sinoma-high-strength-425r", alias_name: "sino cement" },
    { material_code: "cement-sino-sinoma-high-strength-425r", alias_name: "sinoma 425" },
    { material_code: "cement-sino-portland-composite-325r", alias_name: "sino 325" },

    // Brick variants
    { material_code: "brick-common", alias_name: "common bricks" },
    { material_code: "brick-common", alias_name: "standard bricks" },
    { material_code: "brick-common", alias_name: "cement common bricks" },
    { material_code: "farm-brick", alias_name: "semi common bricks" },
    { material_code: "farm-brick", alias_name: "semicommon bricks" },
    { material_code: "farm-brick", alias_name: "farm bricks" },
    { material_code: "brick-face-red", alias_name: "red common bricks" },
    { material_code: "brick-face-red", alias_name: "red bricks" },
    { material_code: "brick-face-red", alias_name: "rustic face bricks" },
    { material_code: "brick-face-red", alias_name: "face bricks rustic" },
    { material_code: "brick-face-brown", alias_name: "botswana face bricks" },
    { material_code: "brick-face-brown", alias_name: "brown face bricks" },
    { material_code: "brick-common", alias_name: "solid common bricks" },
    { material_code: "brick-common", alias_name: "blue heart bricks" },
    { material_code: "brick-common", alias_name: "solid common blue heart bricks" },
    { material_code: "brick-common", alias_name: "palletized common bricks" },
    { material_code: "brick-common", alias_name: "common bricks per thousand" }
];

async function seedPriceObservations() {
    console.log('Seeding price observations from research data...\n');

    const observations = [];
    const timestamp = new Date().toISOString();

    // Process cement data
    for (const item of researchData.cement) {
        observations.push({
            material_key: item.material_code,
            material_name: item.product_name,
            price_usd: item.price_usd,
            confidence: 5, // High confidence (1-5 scale) since it's researched data
            url: item.source_url,
            supplier_name: item.supplier,
            location: item.location,
            scraped_at: timestamp,
            review_status: 'confirmed'
        });
    }

    // Process brick data
    for (const item of researchData.bricks) {
        observations.push({
            material_key: item.material_code,
            material_name: item.product_name,
            price_usd: item.price_usd,
            confidence: 5, // High confidence (1-5 scale)
            url: item.source_url,
            supplier_name: item.supplier,
            location: item.location,
            scraped_at: timestamp,
            review_status: 'confirmed'
        });
    }

    console.log(`Inserting ${observations.length} price observations...`);

    const { error } = await supabase
        .from('price_observations')
        .insert(observations as never);

    if (error) {
        console.error('Error inserting observations:', error);
    } else {
        console.log('✓ Price observations inserted successfully');
    }
}

async function seedMaterialAliases() {
    console.log('\nSeeding material aliases...\n');

    const aliasesToInsert = newAliases.map(a => ({
        material_code: a.material_code,
        alias_name: a.alias_name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim(),
        confidence_score: 1.0
    }));

    console.log(`Inserting ${aliasesToInsert.length} aliases...`);

    // Check for existing aliases to avoid duplicates
    const { data: existingAliases } = await supabase
        .from('material_aliases')
        .select('alias_name');

    const existingNames = new Set((existingAliases || []).map(a => a.alias_name));
    const newOnlyAliases = aliasesToInsert.filter(a => !existingNames.has(a.alias_name));

    if (newOnlyAliases.length === 0) {
        console.log('✓ All aliases already exist, skipping');
        return;
    }

    console.log(`Inserting ${newOnlyAliases.length} new aliases (${aliasesToInsert.length - newOnlyAliases.length} already exist)...`);

    const { error } = await supabase
        .from('material_aliases')
        .insert(newOnlyAliases as never);

    if (error) {
        console.error('Error inserting aliases:', error);
    } else {
        console.log('✓ Material aliases inserted successfully');
    }
}

async function main() {
    console.log('=== Seeding Research Price Data ===\n');

    await seedPriceObservations();
    await seedMaterialAliases();

    console.log('\n=== Seeding Complete ===');
}

main().catch(console.error);
