// Which BOQ table columns show, in the simple and detailed presets.

export const SIMPLE_COLUMNS = {
    item: true,
    avgPrice: true,
    actualPrice: true,
    priceVar: false,
    qty: true,
    actualQty: true,
    qtyVar: false,
    actualTotal: true,
    estTotal: false,
    totalVar: false,
    usage: false,
    status: true,
} as const;

export const DETAILED_COLUMNS = {
    item: true,
    avgPrice: true,
    actualPrice: true,
    priceVar: true,
    qty: true,
    actualQty: true,
    qtyVar: true,
    actualTotal: true,
    estTotal: true,
    totalVar: true,
    usage: true,
    status: true,
} as const;

export type ColumnKey = keyof typeof SIMPLE_COLUMNS;

export const COLUMN_LABELS: Record<ColumnKey, string> = {
    item: 'Item Description',
    avgPrice: 'Avg. Price',
    actualPrice: 'Actual Price',
    priceVar: 'Price Var %',
    qty: 'Qty (Est)',
    actualQty: 'Actual Qty',
    qtyVar: 'Qty Var %',
    actualTotal: 'Actual Total',
    estTotal: 'Est Total',
    totalVar: 'Total Var',
    usage: 'Usage',
    status: 'Status',
};
