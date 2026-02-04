// Material types and data for ZimEstimate
// Zimbabwe-specific construction materials with local pricing

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

    // CEMENT
    { id: 'cement-325', name: 'Standard Cement 32.5N', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'PPC/Lafarge 32.5N', milestones: ['substructure', 'superstructure', 'finishing', 'exterior'] },
    { id: 'cement-425', name: 'Rapid Cement 42.5R', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'PPC/Lafarge 42.5R rapid setting', milestones: ['substructure', 'superstructure'] },
    { id: 'cement-white', name: 'White Cement', category: 'cement', subcategory: 'Specialty', unit: 'per 25kg bag', specifications: 'For white plastering and tiles', milestones: ['finishing'] },

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

    // NEW ADDITIONS (USER REQUESTED)
    { id: 'hardcore', name: 'Hardcore (Filling)', category: 'aggregates', subcategory: 'Filling', unit: 'per cube', specifications: 'Rubble/stones for compacting foundation', milestones: ['substructure'] },
    { id: 'brickforce', name: 'Brickforce', category: 'steel', subcategory: 'Reinforcement', unit: 'per roll', specifications: '150mm x 20m brick reinforcement', milestones: ['substructure', 'superstructure'] },
    { id: 'dpc', name: 'DPC (Damp Proof Course)', category: 'finishes', subcategory: 'Waterproofing', unit: 'per roll', specifications: '110mm / 150mm PVC DPC', milestones: ['substructure'] },
    { id: 'dpm', name: 'DPM (Damp Proof Membrane)', category: 'finishes', subcategory: 'Waterproofing', unit: 'per roll', specifications: '250 micron under-slab membrane (30m)', milestones: ['substructure'] },
    { id: 'termite-poison', name: 'Termite Poison', category: 'finishes', subcategory: 'Chemicals', unit: 'per litre', specifications: 'Soil poisoning treatment', milestones: ['substructure'] },

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
    { materialId: 'brick-common', supplierId: 'sup-2', priceUsd: 0.075, priceZwg: 2.25, lastUpdated: '2026-01-30', inStock: true },
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
    // NEW PRICES
    { materialId: 'hardcore', supplierId: 'sup-2', priceUsd: 25, priceZwg: 750, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'brickforce', supplierId: 'sup-4', priceUsd: 3.50, priceZwg: 105, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'dpc', supplierId: 'sup-1', priceUsd: 5, priceZwg: 150, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'dpm', supplierId: 'sup-1', priceUsd: 15, priceZwg: 450, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'termite-poison', supplierId: 'sup-6', priceUsd: 12, priceZwg: 360, lastUpdated: '2026-01-31', inStock: true },
    // LABOR PRICES (Estimated averages)
    { materialId: 'labor-builder', supplierId: 'sup-6', priceUsd: 25, priceZwg: 750, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'labor-assistant', supplierId: 'sup-6', priceUsd: 10, priceZwg: 300, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'labor-foreman', supplierId: 'sup-6', priceUsd: 40, priceZwg: 1200, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'service-food', supplierId: 'sup-6', priceUsd: 5, priceZwg: 150, lastUpdated: '2026-01-31', inStock: true },
    { materialId: 'service-transport', supplierId: 'sup-6', priceUsd: 50, priceZwg: 1500, lastUpdated: '2026-01-31', inStock: true },
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
