// Material types and data for ZimEstimate
// Zimbabwe-specific construction materials with local pricing

import { getCsvDerivedPrice } from '@/lib/boq/csvPricing';

export interface Material {
    id: string;
    name: string;
    category: MaterialCategory;
    subcategory: string;
    unit: string;
    specifications?: string;
    milestones: string[]; // Which milestones use this material
}

export interface MaterialPrice {
    materialId: string;
    supplierId: string;
    priceUsd: number;
    priceZwg: number;
    lastUpdated: string;
    inStock: boolean;
}

export interface Supplier {
    id: string;
    name: string;
    location: string;
    phone: string;
    email?: string;
    website?: string;
    isTrusted: boolean;
    rating: number; // 1-5
    deliveryAreas: string[];
    specialties: MaterialCategory[];
}

export type MaterialCategory =
    | 'bricks'
    | 'cement'
    | 'sand'
    | 'aggregates'
    | 'steel'
    | 'roofing'
    | 'timber'
    | 'electrical'
    | 'plumbing'
    | 'finishes'
    | 'hardware'
    | 'labor';

// Category metadata
export const categoryInfo: Record<MaterialCategory, { label: string; icon: string }> = {
    bricks: { label: 'Bricks & Blocks', icon: 'Cube' },
    cement: { label: 'Cement', icon: 'Package' },
    sand: { label: 'Sand', icon: 'Drop' },
    aggregates: { label: 'Aggregates', icon: 'Stack' },
    steel: { label: 'Steel & Rebar', icon: 'Barbell' },
    roofing: { label: 'Roofing', icon: 'HouseSimple' },
    timber: { label: 'Timber', icon: 'Tree' },
    electrical: { label: 'Electrical', icon: 'Lightning' },
    plumbing: { label: 'Plumbing', icon: 'Drop' },
    finishes: { label: 'Finishes', icon: 'PaintBrush' },
    hardware: { label: 'Hardware', icon: 'Wrench' },
    labor: { label: 'Labor & Services', icon: 'UserCircle' },
};

// Master material database
export const materials: Material[] = [
    // BRICKS & BLOCKS
    { id: 'brick-common', name: 'Common Cement Brick', category: 'bricks', subcategory: 'Cement Bricks', unit: 'each', milestones: ['substructure', 'superstructure'] },
    { id: 'brick-face-red', name: 'Face Brick (Red)', category: 'bricks', subcategory: 'Face Bricks', unit: 'per 1000', specifications: 'Standard red face brick', milestones: ['superstructure'] },
    { id: 'brick-face-brown', name: 'Face Brick (Brown)', category: 'bricks', subcategory: 'Face Bricks', unit: 'per 1000', specifications: 'Brown mottled face brick', milestones: ['superstructure'] },
    { id: 'block-6inch', name: 'Hollow Block 6"', category: 'bricks', subcategory: 'Blocks', unit: 'each', specifications: '150mm hollow concrete block', milestones: ['substructure', 'superstructure', 'exterior'] },
    { id: 'block-8inch', name: 'Hollow Block 8"', category: 'bricks', subcategory: 'Blocks', unit: 'each', specifications: '200mm hollow concrete block', milestones: ['substructure', 'superstructure', 'exterior'] },
    { id: 'durawall-panel', name: 'Durawall Panel', category: 'bricks', subcategory: 'Precast', unit: 'each', specifications: '2.4m precast concrete panel', milestones: ['exterior'] },
    { id: 'farm-brick', name: 'Farm Brick (Common)', category: 'bricks', subcategory: 'Farm Bricks', unit: 'each', specifications: 'Standard farm bricks', milestones: ['substructure', 'superstructure'] },
    { id: 'window-sill-brick', name: 'Window Sill (Brick)', category: 'finishes', subcategory: 'Windows', unit: 'per meter', specifications: 'Brick on edge sill', milestones: ['finishing'] },

    // CEMENT
    { id: 'cement-325', name: 'Standard Cement 32.5N', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'PPC/Lafarge 32.5N', milestones: ['substructure', 'superstructure', 'finishing', 'exterior'] },
    { id: 'cement-425', name: 'Rapid Cement 42.5R', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'PPC/Lafarge 42.5R rapid setting', milestones: ['substructure', 'superstructure'] },
    { id: 'cement-white', name: 'White Cement', category: 'cement', subcategory: 'Specialty', unit: 'per 25kg bag', specifications: 'For white plastering and tiles', milestones: ['finishing'] },
    { id: 'cement-ppc-unicem-325r', name: 'PPC Unicem 32.5R', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'PPC Zimbabwe 32.5R', milestones: ['substructure', 'superstructure', 'finishing', 'exterior'] },
    { id: 'cement-ppc-surecem-325r', name: 'PPC Surecem 32.5R', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'PPC Zimbabwe 32.5R', milestones: ['substructure', 'superstructure', 'finishing', 'exterior'] },
    { id: 'cement-ppc-surebuild-425r', name: 'PPC Surebuild 42.5R', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'PPC Zimbabwe 42.5R', milestones: ['substructure', 'superstructure'] },
    { id: 'cement-ppc-supercast-high-strength', name: 'PPC Supercast High-Strength', category: 'cement', subcategory: 'High Strength', unit: 'per 50kg bag', specifications: 'PPC Zimbabwe high-strength cement', milestones: ['substructure', 'superstructure'] },
    { id: 'cement-khayah-portland', name: 'Khayah Portland Cement', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'Khayah Cement (formerly Lafarge)', milestones: ['substructure', 'superstructure', 'finishing', 'exterior'] },
    { id: 'cement-khayah-mc-225', name: 'Khayah MC 22.5 (Masonry)', category: 'cement', subcategory: 'Masonry', unit: 'per 50kg bag', specifications: 'Khayah Cement masonry grade', milestones: ['finishing', 'exterior'] },
    { id: 'cement-khayah-supaset-425r', name: 'Khayah SupaSet 42.5R', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'Khayah Cement 42.5R', milestones: ['substructure', 'superstructure'] },
    { id: 'cement-khayah-watershield', name: 'Khayah WaterShield (Waterproof)', category: 'cement', subcategory: 'Specialty', unit: 'per 50kg bag', specifications: 'Khayah Cement waterproof cement', milestones: ['substructure', 'finishing', 'exterior'] },
    { id: 'cement-sino-portland-composite-325r', name: 'Sino-Zimbabwe Portland Composite 32.5R', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'Sino-Zimbabwe 32.5R', milestones: ['substructure', 'superstructure', 'finishing', 'exterior'] },
    { id: 'cement-sino-mc-225', name: 'Sino-Zimbabwe MC 22.5 (Masonry)', category: 'cement', subcategory: 'Masonry', unit: 'per 50kg bag', specifications: 'Sino-Zimbabwe masonry grade', milestones: ['finishing', 'exterior'] },
    { id: 'cement-sino-sinoma-high-strength-425r', name: 'Sino-Zimbabwe Sinoma High-Strength 42.5R', category: 'cement', subcategory: 'High Strength', unit: 'per 50kg bag', specifications: 'Sino-Zimbabwe 42.5R', milestones: ['substructure', 'superstructure'] },
    { id: 'cement-dangote-portland-325r', name: 'Dangote Portland 32.5R', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'Dangote 32.5R', milestones: ['substructure', 'superstructure', 'finishing', 'exterior'] },
    { id: 'cement-dangote-portland-425n', name: 'Dangote Portland 42.5N', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'Dangote 42.5N', milestones: ['substructure', 'superstructure'] },

    // SAND
    { id: 'sand-river', name: 'River Sand (Concrete)', category: 'sand', subcategory: 'Concrete Sand', unit: 'per cube', specifications: 'Sharp river sand for concrete', milestones: ['substructure', 'superstructure', 'exterior'] },
    { id: 'sand-pit', name: 'Pit Sand (Plastering)', category: 'sand', subcategory: 'Plaster Sand', unit: 'per cube', specifications: 'Fine pit sand for plastering', milestones: ['finishing'] },
    { id: 'sand-bricks', name: 'Brick Sand', category: 'sand', subcategory: 'Mortar Sand', unit: 'per cube', specifications: 'Medium sand for brick laying', milestones: ['substructure', 'superstructure'] },

    // AGGREGATES
    { id: 'stone-19mm', name: 'Crushed Stone 19mm', category: 'aggregates', subcategory: 'Crushed Stone', unit: 'per cube', specifications: '19mm aggregate for concrete', milestones: ['substructure'] },
    { id: 'stone-13mm', name: 'Crushed Stone 13mm', category: 'aggregates', subcategory: 'Crushed Stone', unit: 'per cube', specifications: '13mm aggregate for slabs', milestones: ['substructure', 'finishing'] },

    // STEEL & REBAR
    { id: 'rebar-10', name: 'Rebar Y10 (6m)', category: 'steel', subcategory: 'Reinforcement', unit: 'per length', specifications: '10mm deformed bar, 6m length', milestones: ['substructure', 'superstructure'] },
    { id: 'rebar-12', name: 'Rebar Y12 (6m)', category: 'steel', subcategory: 'Reinforcement', unit: 'per length', specifications: '12mm deformed bar, 6m length', milestones: ['substructure', 'superstructure'] },
    { id: 'rebar-16', name: 'Rebar Y16 (6m)', category: 'steel', subcategory: 'Reinforcement', unit: 'per length', specifications: '16mm deformed bar, 6m length', milestones: ['substructure'] },
    { id: 'mesh-ref193', name: 'Mesh Ref 193', category: 'steel', subcategory: 'Mesh', unit: 'per sheet', specifications: '2.4m x 6m welded mesh', milestones: ['substructure'] },
    { id: 'bindwire', name: 'Binding Wire', category: 'steel', subcategory: 'Accessories', unit: 'per kg', specifications: '1.6mm annealed wire', milestones: ['substructure', 'superstructure'] },

    // ROOFING
    { id: 'ibr-04-3m', name: 'IBR Sheet 0.4mm (3m)', category: 'roofing', subcategory: 'IBR Sheets', unit: 'per sheet', specifications: '0.4mm galvanized IBR, 3m length', milestones: ['roofing'] },
    { id: 'ibr-05-3m', name: 'IBR Sheet 0.5mm (3m)', category: 'roofing', subcategory: 'IBR Sheets', unit: 'per sheet', specifications: '0.5mm galvanized IBR, 3m length', milestones: ['roofing'] },
    { id: 'tiles-harvey', name: 'Harvey Tiles', category: 'roofing', subcategory: 'Tiles', unit: 'per tile', specifications: 'Concrete roof tiles', milestones: ['roofing'] },
    { id: 'truss-steel', name: 'Steel Roof Truss', category: 'roofing', subcategory: 'Trusses', unit: 'per running meter', specifications: 'Prefabricated steel truss', milestones: ['roofing'] },
    { id: 'fascia-pvc', name: 'PVC Fascia Board', category: 'roofing', subcategory: 'Accessories', unit: 'per 6m length', specifications: '150mm PVC fascia', milestones: ['roofing'] },
    { id: 'gutter-pvc', name: 'PVC Gutter', category: 'roofing', subcategory: 'Accessories', unit: 'per 6m length', specifications: '110mm PVC half-round gutter', milestones: ['roofing'] },

    // TIMBER
    { id: 'timber-50x76', name: 'Timber 50x76mm (Rafters)', category: 'timber', subcategory: 'Structural', unit: 'per 6m length', specifications: 'Treated pine 50x76mm', milestones: ['roofing'] },
    { id: 'timber-38x38', name: 'Timber 38x38mm (Brandering)', category: 'timber', subcategory: 'Structural', unit: 'per 6m length', specifications: 'Treated pine 38x38mm', milestones: ['roofing'] },
    { id: 'timber-50x228', name: 'Timber 50x228mm (Beams)', category: 'timber', subcategory: 'Structural', unit: 'per 6m length', specifications: 'Treated pine 50x228mm', milestones: ['roofing'] },

    // ELECTRICAL
    { id: 'cable-25', name: 'Cable 2.5mm T&E', category: 'electrical', subcategory: 'Wiring', unit: 'per 100m roll', specifications: '2.5mm² twin & earth', milestones: ['finishing'] },
    { id: 'cable-4', name: 'Cable 4mm T&E', category: 'electrical', subcategory: 'Wiring', unit: 'per 100m roll', specifications: '4mm² twin & earth', milestones: ['finishing'] },
    { id: 'cable-6', name: 'Cable 6mm T&E', category: 'electrical', subcategory: 'Wiring', unit: 'per 100m roll', specifications: '6mm² twin & earth', milestones: ['finishing'] },
    { id: 'db-8way', name: 'Distribution Board 8-Way', category: 'electrical', subcategory: 'Distribution', unit: 'each', specifications: '8-way consumer unit', milestones: ['finishing'] },
    { id: 'conduit-20', name: 'PVC Conduit 20mm', category: 'electrical', subcategory: 'Conduit', unit: 'per 4m length', specifications: '20mm rigid PVC conduit', milestones: ['finishing'] },

    // PLUMBING
    { id: 'pipe-40-pvc', name: 'PVC Pipe 40mm', category: 'plumbing', subcategory: 'Drainage', unit: 'per 6m length', specifications: '40mm PVC waste pipe', milestones: ['finishing'] },
    { id: 'pipe-110-pvc', name: 'PVC Pipe 110mm', category: 'plumbing', subcategory: 'Drainage', unit: 'per 6m length', specifications: '110mm PVC soil pipe', milestones: ['substructure', 'finishing'] },
    { id: 'pipe-15-copper', name: 'Copper Pipe 15mm', category: 'plumbing', subcategory: 'Water Supply', unit: 'per 5.5m length', specifications: '15mm copper pipe', milestones: ['finishing'] },
    { id: 'geyser-150', name: 'Geyser 150L', category: 'plumbing', subcategory: 'Hot Water', unit: 'each', specifications: '150 litre electric geyser', milestones: ['finishing'] },

    // FINISHES
    { id: 'paint-pva', name: 'PVA Paint (White)', category: 'finishes', subcategory: 'Paint', unit: 'per 20L', specifications: 'Interior PVA emulsion', milestones: ['finishing'] },
    { id: 'paint-acrylic', name: 'Acrylic Paint (White)', category: 'finishes', subcategory: 'Paint', unit: 'per 20L', specifications: 'Exterior acrylic paint', milestones: ['finishing'] },
    { id: 'tiles-floor-ceramic', name: 'Floor Tiles (Ceramic)', category: 'finishes', subcategory: 'Tiles', unit: 'per m²', specifications: '400x400mm ceramic floor tiles', milestones: ['finishing'] },
    { id: 'tiles-wall-ceramic', name: 'Wall Tiles (Ceramic)', category: 'finishes', subcategory: 'Tiles', unit: 'per m²', specifications: '250x400mm ceramic wall tiles', milestones: ['finishing'] },
    { id: 'tile-adhesive', name: 'Tile Adhesive', category: 'finishes', subcategory: 'Adhesives', unit: 'per 20kg bag', specifications: 'Cementitious tile adhesive', milestones: ['finishing'] },
    { id: 'grout', name: 'Tile Grout', category: 'finishes', subcategory: 'Adhesives', unit: 'per 5kg bag', specifications: 'Cementitious tile grout', milestones: ['finishing'] },

    // HARDWARE
    { id: 'nails-75', name: 'Wire Nails 75mm', category: 'hardware', subcategory: 'Fasteners', unit: 'per kg', specifications: '75mm galvanized wire nails', milestones: ['roofing', 'finishing'] },
    { id: 'nails-100', name: 'Wire Nails 100mm', category: 'hardware', subcategory: 'Fasteners', unit: 'per kg', specifications: '100mm galvanized wire nails', milestones: ['roofing', 'finishing'] },
    { id: 'screws-roof', name: 'Roof Screws', category: 'hardware', subcategory: 'Fasteners', unit: 'per 100', specifications: 'Self-drilling roof screws', milestones: ['roofing'] },
    { id: 'hinges-door', name: 'Door Hinges (Pair)', category: 'hardware', subcategory: 'Door Hardware', unit: 'per pair', specifications: '100mm butt hinges', milestones: ['finishing'] },
    { id: 'lock-mortice', name: 'Mortice Lock', category: 'hardware', subcategory: 'Door Hardware', unit: 'each', specifications: '3-lever mortice lock', milestones: ['finishing'] },

    // EXTERIOR WORKS — boundary, gates and paving. The exterior stage was
    // selectable in the wizard but generated nothing, so a build that included it
    // silently omitted the boundary wall, gates and driveway.
    { id: 'durawall-post', name: 'Durawall Post', category: 'bricks', subcategory: 'Precast', unit: 'each', specifications: 'Precast concrete slotted post', milestones: ['exterior'] },
    { id: 'gate-vehicle', name: 'Vehicle Gate (3.5m)', category: 'hardware', subcategory: 'Gates', unit: 'each', specifications: 'Steel sliding or swing vehicle gate with frame', milestones: ['exterior'] },
    { id: 'gate-pedestrian', name: 'Pedestrian Gate', category: 'hardware', subcategory: 'Gates', unit: 'each', specifications: 'Steel pedestrian gate with frame', milestones: ['exterior'] },
    { id: 'paving-brick', name: 'Paving Brick', category: 'bricks', subcategory: 'Paving', unit: 'per m²', specifications: 'Interlocking concrete paving brick', milestones: ['exterior'] },

    // FINISHING — joinery and ceilings. Needed so the finishing stage covers the
    // 25-35% of a build it represents; without these it only produced sills.
    { id: 'door-interior', name: 'Interior Door (with frame)', category: 'finishes', subcategory: 'Joinery', unit: 'each', specifications: 'Hollow-core door leaf and frame', milestones: ['finishing'] },
    { id: 'door-exterior', name: 'Exterior Door (with frame)', category: 'finishes', subcategory: 'Joinery', unit: 'each', specifications: 'Solid timber or steel door and frame', milestones: ['finishing'] },
    { id: 'window-steel', name: 'Steel Window Frame', category: 'finishes', subcategory: 'Joinery', unit: 'per m²', specifications: 'Standard steel casement window with glazing', milestones: ['finishing'] },
    { id: 'ceiling-board', name: 'Ceiling Board', category: 'finishes', subcategory: 'Ceilings', unit: 'per m²', specifications: 'PVC or gypsum ceiling board', milestones: ['finishing'] },
    { id: 'cornice', name: 'Cornice', category: 'finishes', subcategory: 'Ceilings', unit: 'per 4m length', specifications: 'Gypsum/PVC cornice', milestones: ['finishing'] },

    // NEW ADDITIONS (USER REQUESTED)
    { id: 'hardcore', name: 'Hardcore (Filling)', category: 'aggregates', subcategory: 'Filling', unit: 'per cube', specifications: 'Rubble/stones for compacting foundation', milestones: ['substructure'] },
    { id: 'brickforce', name: 'Brickforce', category: 'steel', subcategory: 'Reinforcement', unit: 'per roll', specifications: '150mm x 20m brick reinforcement', milestones: ['substructure', 'superstructure'] },
    { id: 'dpc', name: 'DPC (Damp Proof Course)', category: 'finishes', subcategory: 'Waterproofing', unit: 'per roll', specifications: '110mm / 150mm PVC DPC', milestones: ['substructure'] },
    { id: 'dpm', name: 'DPM (Damp Proof Membrane)', category: 'finishes', subcategory: 'Waterproofing', unit: 'per roll', specifications: '250 micron under-slab membrane (30m)', milestones: ['substructure'] },
    { id: 'termite-poison', name: 'Termite Poison', category: 'finishes', subcategory: 'Chemicals', unit: 'per litre', specifications: 'Soil poisoning treatment', milestones: ['substructure'] },
    { id: 'temp-cabin-6x3', name: 'Site Cabin 6x3 (Temporary)', category: 'labor', subcategory: 'Temporary Works', unit: 'each', specifications: 'Temporary cabin for storage and site guard shelter', milestones: ['substructure'] },
    { id: 'temp-toilet', name: 'Temporary Toilet Setup', category: 'labor', subcategory: 'Temporary Works', unit: 'each', specifications: 'Portable/fixed temporary toilet setup for workers', milestones: ['substructure'] },
    { id: 'water-tank-50000l', name: 'Water Tank 50,000L (Temporary)', category: 'plumbing', subcategory: 'Temporary Works', unit: 'each', specifications: 'Temporary site water tank when no municipal connection exists', milestones: ['substructure'] },
    { id: 'site-clear-level', name: 'Site Clear and Level', category: 'labor', subcategory: 'Temporary Works', unit: 'lot', specifications: 'Clearing vegetation, rubble, and level preparation before works', milestones: ['substructure'] },

    // LABOR & SERVICES
    { id: 'labor-builder', name: 'Builder (Daily Rate)', category: 'labor', subcategory: 'Labor', unit: 'per day', specifications: 'Skilled builder daily rate', milestones: ['substructure', 'superstructure', 'finishing'] },
    { id: 'labor-assistant', name: 'General Hand (Daily Rate)', category: 'labor', subcategory: 'Labor', unit: 'per day', specifications: 'General assistant daily rate', milestones: ['substructure', 'superstructure', 'finishing'] },
    { id: 'labor-foreman', name: 'Foreman (Daily Rate)', category: 'labor', subcategory: 'Labor', unit: 'per day', specifications: 'Site foreman supervision', milestones: ['substructure', 'superstructure'] },
    { id: 'service-food', name: 'Builder\'s Food Allowance', category: 'labor', subcategory: 'Services', unit: 'per day', specifications: 'Daily food allowance per person', milestones: ['substructure', 'superstructure', 'finishing'] },
    { id: 'service-transport', name: 'Transport/Logistics', category: 'labor', subcategory: 'Services', unit: 'per trip', specifications: 'Material transport trip', milestones: ['substructure', 'superstructure'] },
];

// Supplier database
export const suppliers: Supplier[] = [
    {
        id: 'sup-csv-baseline',
        name: 'CSV Baseline Market Rates',
        location: 'Zimbabwe',
        phone: '',
        isTrusted: true,
        rating: 4.5,
        deliveryAreas: ['Nationwide'],
        specialties: ['bricks', 'cement', 'sand', 'aggregates', 'steel', 'roofing', 'timber'],
    },
    {
        id: 'sup-1',
        name: 'Halsteds Hardware',
        location: 'Harare CBD',
        phone: '+263 242 700 123',
        email: 'sales@halsteds.co.zw',
        website: 'https://halsteds.co.zw',
        isTrusted: true,
        rating: 4.8,
        deliveryAreas: ['Harare', 'Chitungwiza', 'Norton'],
        specialties: ['hardware', 'electrical', 'plumbing'],
    },
    {
        id: 'sup-2',
        name: 'Baines Building Supplies',
        location: 'Graniteside, Harare',
        phone: '+263 242 751 234',
        email: 'info@baines.co.zw',
        isTrusted: true,
        rating: 4.6,
        deliveryAreas: ['Harare', 'Chitungwiza'],
        specialties: ['bricks', 'cement', 'sand', 'aggregates'],
    },
    {
        id: 'sup-3',
        name: 'PPC Zimbabwe',
        location: 'Colleen Bawn',
        phone: '+263 242 885 100',
        website: 'https://ppc.co.zw',
        isTrusted: true,
        rating: 4.9,
        deliveryAreas: ['Nationwide'],
        specialties: ['cement'],
    },
    {
        id: 'sup-7',
        name: 'Khayah Cement',
        location: 'Zimbabwe',
        phone: '',
        isTrusted: false,
        rating: 0,
        deliveryAreas: ['Nationwide'],
        specialties: ['cement'],
    },
    {
        id: 'sup-8',
        name: 'Sino-Zimbabwe Cement',
        location: 'Zimbabwe',
        phone: '',
        isTrusted: false,
        rating: 0,
        deliveryAreas: ['Nationwide'],
        specialties: ['cement'],
    },
    {
        id: 'sup-9',
        name: 'Dangote Cement',
        location: 'Zimbabwe',
        phone: '',
        isTrusted: false,
        rating: 0,
        deliveryAreas: ['Nationwide'],
        specialties: ['cement'],
    },
    {
        id: 'sup-4',
        name: 'Radar Holdings',
        location: 'Msasa, Harare',
        phone: '+263 242 487 001',
        isTrusted: true,
        rating: 4.5,
        deliveryAreas: ['Harare', 'Bulawayo', 'Gweru'],
        specialties: ['steel', 'roofing'],
    },
    {
        id: 'sup-5',
        name: 'ZimSteel',
        location: 'Kwekwe',
        phone: '+263 55 23456',
        isTrusted: true,
        rating: 4.7,
        deliveryAreas: ['Nationwide'],
        specialties: ['steel'],
    },
    {
        id: 'sup-6',
        name: 'Mukuru Hardware',
        location: 'Borrowdale, Harare',
        phone: '+263 772 123 456',
        isTrusted: false,
        rating: 4.2,
        deliveryAreas: ['Harare North'],
        specialties: ['hardware', 'finishes'],
    },
];

// Current prices (sample data - would be fetched from DB in production)
export const materialPrices: MaterialPrice[] = [
    { materialId: 'brick-common', supplierId: 'sup-2', priceUsd: 0.085, priceZwg: 2.55, lastUpdated: '2026-07-27', inStock: true },
    { materialId: 'brick-face-red', supplierId: 'sup-2', priceUsd: 180, priceZwg: 5400, lastUpdated: '2026-01-30', inStock: true },
    { materialId: 'cement-325', supplierId: 'sup-3', priceUsd: 10, priceZwg: 300, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'cement-325', supplierId: 'sup-2', priceUsd: 10.50, priceZwg: 315, lastUpdated: '2026-01-30', inStock: true },
    { materialId: 'cement-425', supplierId: 'sup-3', priceUsd: 12, priceZwg: 360, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'sand-river', supplierId: 'sup-2', priceUsd: 45, priceZwg: 1350, lastUpdated: '2026-01-29', inStock: true },
    { materialId: 'sand-pit', supplierId: 'sup-2', priceUsd: 35, priceZwg: 1050, lastUpdated: '2026-01-29', inStock: true },
    { materialId: 'stone-19mm', supplierId: 'sup-2', priceUsd: 55, priceZwg: 1650, lastUpdated: '2026-01-28', inStock: true },
    { materialId: 'rebar-12', supplierId: 'sup-4', priceUsd: 8, priceZwg: 240, lastUpdated: '2026-01-30', inStock: true },
    { materialId: 'rebar-12', supplierId: 'sup-5', priceUsd: 7.80, priceZwg: 234, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'ibr-04-3m', supplierId: 'sup-4', priceUsd: 18, priceZwg: 540, lastUpdated: '2026-01-30', inStock: true },
    { materialId: 'ibr-05-3m', supplierId: 'sup-4', priceUsd: 22, priceZwg: 660, lastUpdated: '2026-01-30', inStock: true },
    { materialId: 'cable-25', supplierId: 'sup-1', priceUsd: 85, priceZwg: 2550, lastUpdated: '2026-01-29', inStock: true },
    { materialId: 'db-8way', supplierId: 'sup-1', priceUsd: 65, priceZwg: 1950, lastUpdated: '2026-01-29', inStock: true },
    { materialId: 'paint-pva', supplierId: 'sup-1', priceUsd: 35, priceZwg: 1050, lastUpdated: '2026-01-28', inStock: true },
    { materialId: 'tiles-floor-ceramic', supplierId: 'sup-1', priceUsd: 12, priceZwg: 360, lastUpdated: '2026-01-27', inStock: true },
    { materialId: 'farm-brick', supplierId: 'sup-3', priceUsd: 0.045, priceZwg: 1.35, lastUpdated: '2026-07-27', inStock: true },
    { materialId: 'window-sill-brick', supplierId: 'sup-1', priceUsd: 5.0, priceZwg: 150, lastUpdated: '2026-02-07', inStock: true },
    // NEW PRICES
    { materialId: 'hardcore', supplierId: 'sup-2', priceUsd: 25, priceZwg: 750, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'brickforce', supplierId: 'sup-4', priceUsd: 3.50, priceZwg: 105, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'dpc', supplierId: 'sup-1', priceUsd: 5, priceZwg: 150, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'dpm', supplierId: 'sup-1', priceUsd: 15, priceZwg: 450, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'termite-poison', supplierId: 'sup-6', priceUsd: 12, priceZwg: 360, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'temp-cabin-6x3', supplierId: 'sup-csv-baseline', priceUsd: 350, priceZwg: 10500, lastUpdated: '2026-02-18', inStock: true },
    { materialId: 'temp-toilet', supplierId: 'sup-csv-baseline', priceUsd: 180, priceZwg: 5400, lastUpdated: '2026-02-18', inStock: true },
    { materialId: 'water-tank-50000l', supplierId: 'sup-csv-baseline', priceUsd: 550, priceZwg: 16500, lastUpdated: '2026-02-18', inStock: true },
    { materialId: 'site-clear-level', supplierId: 'sup-csv-baseline', priceUsd: 250, priceZwg: 7500, lastUpdated: '2026-02-18', inStock: true },
    // LABOR PRICES (Estimated averages)
    { materialId: 'labor-builder', supplierId: 'sup-6', priceUsd: 25, priceZwg: 750, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'labor-assistant', supplierId: 'sup-6', priceUsd: 10, priceZwg: 300, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'labor-foreman', supplierId: 'sup-6', priceUsd: 40, priceZwg: 1200, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'service-food', supplierId: 'sup-6', priceUsd: 5, priceZwg: 150, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'service-transport', supplierId: 'sup-6', priceUsd: 50, priceZwg: 1500, lastUpdated: '2026-01-31', inStock: true },

    // Roof screws are generated into every roofing BOQ but had no price in
    // either this list or the CSV-derived pricing map, so they costed at $0.
    // 2026 Zimbabwe market estimate; replace with scraped supplier data.
    { materialId: 'screws-roof', supplierId: 'sup-4', priceUsd: 12, priceZwg: 360, lastUpdated: '2026-07-27', inStock: true },

    // Finishing materials. PVA/acrylic reflect Harare retail (20L PVA listed
    // around $38-42); the rest are 2026 market estimates pending scraped data.
    { materialId: 'paint-acrylic', supplierId: 'sup-1', priceUsd: 55, priceZwg: 1650, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'tiles-wall-ceramic', supplierId: 'sup-1', priceUsd: 11, priceZwg: 330, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'tile-adhesive', supplierId: 'sup-1', priceUsd: 9, priceZwg: 270, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'grout', supplierId: 'sup-1', priceUsd: 6, priceZwg: 180, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'conduit-20', supplierId: 'sup-1', priceUsd: 2.50, priceZwg: 75, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'pipe-40-pvc', supplierId: 'sup-1', priceUsd: 8, priceZwg: 240, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'pipe-110-pvc', supplierId: 'sup-1', priceUsd: 16, priceZwg: 480, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'pipe-15-copper', supplierId: 'sup-1', priceUsd: 22, priceZwg: 660, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'geyser-150', supplierId: 'sup-1', priceUsd: 280, priceZwg: 8400, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'door-interior', supplierId: 'sup-csv-baseline', priceUsd: 85, priceZwg: 2550, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'door-exterior', supplierId: 'sup-csv-baseline', priceUsd: 150, priceZwg: 4500, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'window-steel', supplierId: 'sup-csv-baseline', priceUsd: 60, priceZwg: 1800, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'ceiling-board', supplierId: 'sup-csv-baseline', priceUsd: 8, priceZwg: 240, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'cornice', supplierId: 'sup-csv-baseline', priceUsd: 4, priceZwg: 120, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'hinges-door', supplierId: 'sup-4', priceUsd: 4, priceZwg: 120, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'lock-mortice', supplierId: 'sup-4', priceUsd: 14, priceZwg: 420, lastUpdated: '2026-07-29', inStock: true },

    // Exterior works. durawall-panel was in the catalogue from the start but had
    // no price in either this list or the CSV map. 2026 Zimbabwe market
    // estimates; replace with scraped supplier data.
    { materialId: 'durawall-panel', supplierId: 'sup-2', priceUsd: 12, priceZwg: 360, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'durawall-post', supplierId: 'sup-2', priceUsd: 14, priceZwg: 420, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'gate-vehicle', supplierId: 'sup-4', priceUsd: 450, priceZwg: 13500, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'gate-pedestrian', supplierId: 'sup-4', priceUsd: 120, priceZwg: 3600, lastUpdated: '2026-07-29', inStock: true },
    { materialId: 'paving-brick', supplierId: 'sup-2', priceUsd: 14, priceZwg: 420, lastUpdated: '2026-07-29', inStock: true },
];

// Helper functions
export function getMaterialById(id: string): Material | undefined {
    return materials.find((m) => m.id === id);
}

export function getSupplierById(id: string): Supplier | undefined {
    return suppliers.find((s) => s.id === id);
}

export function getPricesForMaterial(materialId: string): (MaterialPrice & { supplier: Supplier })[] {
    return materialPrices
        .filter((p) => p.materialId === materialId)
        .map((p) => ({
            ...p,
            supplier: getSupplierById(p.supplierId)!,
        }))
        .filter((p) => p.supplier)
        .sort((a, b) => a.priceUsd - b.priceUsd);
}

export function getBestPrice(materialId: string): MaterialPrice | undefined {
    const csvPrice = getCsvDerivedPrice(materialId);
    if (csvPrice) {
        return csvPrice;
    }

    const prices = materialPrices.filter((p) => p.materialId === materialId && p.inStock);
    return prices.sort((a, b) => a.priceUsd - b.priceUsd)[0];
}

export function getMaterialsByCategory(category: MaterialCategory): Material[] {
    return materials.filter((m) => m.category === category);
}

export function getMaterialsByMilestone(milestone: string): Material[] {
    return materials.filter((m) => m.milestones.includes(milestone));
}

export function searchMaterials(query: string): Material[] {
    const lowerQuery = query.toLowerCase();
    return materials.filter(
        (m) =>
            m.name.toLowerCase().includes(lowerQuery) ||
            m.category.toLowerCase().includes(lowerQuery) ||
            m.subcategory.toLowerCase().includes(lowerQuery) ||
            m.specifications?.toLowerCase().includes(lowerQuery)
    );
}

export function getTrustedSuppliers(): Supplier[] {
    return suppliers.filter((s) => s.isTrusted);
}
