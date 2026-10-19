import { isLaborCategory } from '@/lib/calculations/laborSubstages';
import { groupBoqByStage } from '@/lib/boqPresentation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, BOQItem } from './database.types';

interface ExportOptions {
    currency: 'USD' | 'ZWG';
    exchangeRate: number;
    includeNotes: boolean;
    includeSupplierInfo: boolean;
}

/**
 * The material column: the name, and under it what the line is for. Without
 * the second line, a stage with cement for concrete and cement for mortar
 * printed as two identical-looking "Cement" rows.
 */
function materialCell(name: string, note?: string | null): string {
    const purpose = (note ?? '').replace(/\[Enablement Cost\]\s*/g, '').trim();
    return purpose && purpose.toLowerCase() !== name.toLowerCase() ? `${name}\n${purpose}` : name;
}

export interface AnalyticsReportData {
    projectName: string;
    generatedAt: Date;
    currency: 'USD' | 'ZWG';
    summary: {
        totalSpend: number;
        budget: number;
        variance: number;
        completionPct: number;
        areaSqm: number;
        costPerSqm: number;
    };
    supplierBreakdown: Array<{
        name: string;
        spend: number;
        sharePct: number;
    }>;
    watchedMaterials: Array<{
        name: string;
        price: number;
        changePct: number;
        trend: 'up' | 'down' | 'stable';
    }>;
    projectComparison: Array<{
        name: string;
        status: string;
        spend: number;
        budget: number;
        completionPct: number;
    }>;
}

const defaultOptions: ExportOptions = {
    currency: 'USD',
    exchangeRate: 30,
    includeNotes: true,
    includeSupplierInfo: false,
};

// Category display names
const categoryLabels: Record<string, string> = {
    substructure: 'Site Preparation & Foundation',
    superstructure: 'Structural Walls & Frame',
    roofing: 'Roofing',
    finishing: 'Interior & Finishing',
    services: 'Plumbing & Electrical',
    exterior: 'External Work',
    labor: 'Other labour',
    project_fees: 'Professional & Council Fees',
};

// ===== COST SPLIT (pie) =====
type PdfSlice = { label: string; value: number; color: [number, number, number] };

function costSplitSlices(rows: { category?: string | null; materialId?: string | null; total: number }[]): PdfSlice[] {
    const split = { materials: 0, labor: 0, fees: 0 };
    for (const row of rows) {
        if (isLaborCategory(row.category) || (row.materialId?.startsWith('extra-') && row.materialId.endsWith('--labour'))) split.labor += row.total;
        else if (row.category === 'project_fees') split.fees += row.total;
        else split.materials += row.total;
    }
    return [
        { label: 'Materials & works', value: split.materials, color: [11, 31, 59] },
        { label: 'Labour', value: split.labor, color: [46, 108, 246] },
        { label: 'Professional & council fees', value: split.fees, color: [217, 119, 6] },
    ];
}

/** Draws "Where the budget goes" as a ring chart with a legend; returns the next y. */
function drawCostSplit(doc: jsPDF, yPos: number, margin: number, slices: PdfSlice[], currency: 'USD' | 'ZWG'): number {
    const shown = slices.filter((slice) => slice.value > 0);
    const total = shown.reduce((sum, slice) => sum + slice.value, 0);
    // A single kind of cost makes a plain circle that says nothing.
    if (total <= 0 || shown.length < 2) return yPos;

    doc.setTextColor(6, 20, 47);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Where the budget goes', margin, yPos);
    yPos += 4;

    const radius = 16;
    const cx = margin + radius;
    const cy = yPos + radius;
    let angle = 0;
    for (const slice of shown) {
        const sweep = (slice.value / total) * Math.PI * 2;
        const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 36)));
        const points: [number, number][] = [[cx, cy]];
        for (let i = 0; i <= steps; i += 1) {
            const a = angle + (sweep * i) / steps;
            points.push([cx + radius * Math.sin(a), cy - radius * Math.cos(a)]);
        }
        const segments = points.slice(1).map((point, i) => [point[0] - points[i][0], point[1] - points[i][1]]);
        doc.setFillColor(...slice.color);
        doc.lines(segments, cx, cy, [1, 1], 'F', true);
        angle += sweep;
    }
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, radius * 0.56, 'F');

    let rowY = yPos + 6;
    const legendX = margin + radius * 2 + 10;
    doc.setFontSize(9);
    for (const slice of shown) {
        doc.setFillColor(...slice.color);
        doc.rect(legendX, rowY - 3, 4, 4, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFont('helvetica', 'normal');
        doc.text(slice.label, legendX + 7, rowY);
        doc.setFont('helvetica', 'bold');
        doc.text(`${formatCurrency(slice.value, currency)}  (${((slice.value / total) * 100).toFixed(1)}%)`, legendX + 70, rowY);
        rowY += 8;
    }
    return yPos + radius * 2 + 8;
}

// Format currency
function formatCurrency(amount: number, currency: 'USD' | 'ZWG'): string {
    if (currency === 'ZWG') {
        return `ZiG ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function generateAnalyticsPDF(data: AnalyticsReportData): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = margin;

    const primaryColor: [number, number, number] = [6, 20, 47];
    const accentColor: [number, number, number] = [78, 154, 247];

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('ZimEstimate', margin, 25);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Analytics Report', margin, 33);
    doc.setFontSize(9);
    doc.text(`Generated: ${data.generatedAt.toLocaleDateString()}`, pageWidth - margin, 25, { align: 'right' });

    yPos = 55;

    // Project title
    doc.setTextColor(...primaryColor);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.projectName, margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Reporting currency: ${data.currency}`, margin, yPos);
    yPos += 10;

    // Summary table
    autoTable(doc, {
        startY: yPos,
        head: [['Summary Metric', 'Value']],
        body: [
            ['Total Spend', formatCurrency(data.summary.totalSpend, data.currency)],
            ['Budget', formatCurrency(data.summary.budget, data.currency)],
            ['Variance', formatCurrency(data.summary.variance, data.currency)],
            ['Completion', `${data.summary.completionPct.toFixed(1)}%`],
            ['Cost per sqm', `${formatCurrency(data.summary.costPerSqm, data.currency)} / m²`],
        ],
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 'auto' } },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

    // Supplier breakdown
    if (data.supplierBreakdown.length > 0) {
        autoTable(doc, {
            startY: yPos,
            head: [['Supplier', 'Spend', 'Share']],
            body: data.supplierBreakdown.map((row) => [
                row.name,
                formatCurrency(row.spend, data.currency),
                `${row.sharePct.toFixed(1)}%`,
            ]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [240, 240, 240], textColor: [60, 60, 60], fontStyle: 'bold' },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });

        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    }

    // Watched materials
    if (data.watchedMaterials.length > 0) {
        autoTable(doc, {
            startY: yPos,
            head: [['Watched Material', 'Price', 'Change']],
            body: data.watchedMaterials.map((row) => [
                row.name,
                formatCurrency(row.price, data.currency),
                `${row.changePct > 0 ? '+' : ''}${row.changePct.toFixed(1)}% (${row.trend})`,
            ]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [240, 240, 240], textColor: [60, 60, 60], fontStyle: 'bold' },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });

        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    }

    // Project comparison
    if (data.projectComparison.length > 0) {
        autoTable(doc, {
            startY: yPos,
            head: [['Project', 'Status', 'Spend', 'Budget', 'Completion']],
            body: data.projectComparison.map((row) => [
                row.name,
                row.status,
                formatCurrency(row.spend, data.currency),
                formatCurrency(row.budget, data.currency),
                `${row.completionPct.toFixed(1)}%`,
            ]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [240, 240, 240], textColor: [60, 60, 60], fontStyle: 'bold' },
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        });
    }

    return doc;
}

export function downloadAnalyticsPDF(data: AnalyticsReportData): void {
    const doc = generateAnalyticsPDF(data);
    const filename = `${data.projectName.replace(/[^a-z0-9]/gi, '_')}_Analytics_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}

export function generateBOQPDF(
    project: Project,
    items: BOQItem[],
    options: Partial<ExportOptions> = {}
): jsPDF {
    const opts = { ...defaultOptions, ...options };
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = margin;

    // Colors
    const primaryColor: [number, number, number] = [6, 20, 47]; // Deep Navy
    const accentColor: [number, number, number] = [78, 154, 247]; // Vibrant Blue

    // ===== HEADER =====
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Logo text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('ZimEstimate', margin, 25);

    // Tagline
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Bill of Quantities', margin, 33);

    // Date
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, 25, { align: 'right' });

    yPos = 55;

    // ===== PROJECT INFO =====
    doc.setTextColor(...primaryColor);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(project.name, margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);

    if (project.location) {
        doc.text(`Location: ${project.location}`, margin, yPos);
        yPos += 5;
    }

    doc.text(`Scope: ${project.scope.replace('_', ' ')}`, margin, yPos);
    yPos += 5;

    doc.text(`Labor: ${project.labor_preference === 'with_labor' ? 'Included' : 'Materials Only'}`, margin, yPos);
    yPos += 5;

    doc.text(`Status: ${project.status.charAt(0).toUpperCase() + project.status.slice(1)}`, margin, yPos);
    yPos += 15;

    // ===== SUMMARY BOX =====
    const totalUsd = Number(project.total_usd);
    const totalZwg = Number(project.total_zwg);
    const displayTotal = opts.currency === 'USD' ? totalUsd : totalZwg;

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 25, 3, 3, 'F');

    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL BUDGET', margin + 10, yPos + 10);

    doc.setFontSize(16);
    doc.setTextColor(...accentColor);
    doc.text(formatCurrency(displayTotal, opts.currency), margin + 10, yPos + 20);

    // Item count
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(`${items.length} line items`, pageWidth - margin - 10, yPos + 15, { align: 'right' });

    yPos += 35;

    yPos = drawCostSplit(doc, yPos, margin, costSplitSlices(items.map((item) => ({
        category: item.category,
        materialId: item.material_id,
        total: Number(opts.currency === 'USD' ? item.total_usd : item.total_zwg) || 0,
    }))), opts.currency);

    // ===== BOQ ITEMS BY CATEGORY =====
    const groupedItems = groupBoqByStage(items);
    const categories = Object.keys(groupedItems);

    for (const category of categories) {
        const categoryItems = groupedItems[category];
        const categoryTotal = categoryItems.reduce(
            (sum, item) => sum + Number(opts.currency === 'USD' ? item.total_usd : item.total_zwg),
            0
        );

        // Check if we need a new page
        if (yPos > 250) {
            doc.addPage();
            yPos = margin;
        }

        // Category header
        doc.setFillColor(...accentColor);
        doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(categoryLabels[category] || category, margin + 5, yPos + 5.5);
        doc.text(formatCurrency(categoryTotal, opts.currency), pageWidth - margin - 5, yPos + 5.5, { align: 'right' });

        yPos += 10;

        // Category items table
        const tableData = categoryItems.flatMap((item, index) => {
            const unitPrice = opts.currency === 'USD' ? Number(item.unit_price_usd) : Number(item.unit_price_zwg);
            const total = opts.currency === 'USD' ? Number(item.total_usd) : Number(item.total_zwg);

            const row = [
                materialCell(item.material_name, item.notes),
                `${Number(item.quantity).toLocaleString()} ${item.unit}`,
                formatCurrency(unitPrice, opts.currency),
                formatCurrency(total, opts.currency),
            ];
            return isLaborCategory(item.category) && (index === 0 || !isLaborCategory(categoryItems[index - 1].category))
                ? [[{ content: 'Labour', colSpan: 4, styles: { fontStyle: 'bold' as const, textColor: [100, 100, 100] as [number, number, number] } }], row] : [row];
        });

        autoTable(doc, {
            startY: yPos,
            head: [['Material', 'Quantity', 'Unit Price', 'Total']],
            body: tableData,
            margin: { left: margin, right: margin },
            styles: {
                fontSize: 9,
                cellPadding: 3,
            },
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [60, 60, 60],
                fontStyle: 'bold',
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250],
            },
        });

        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }

    // ===== GRAND TOTAL =====
    if (yPos > 260) {
        doc.addPage();
        yPos = margin;
    }

    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPos, pageWidth - margin * 2, 15, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL', margin + 10, yPos + 10);
    doc.text(formatCurrency(displayTotal, opts.currency), pageWidth - margin - 10, yPos + 10, { align: 'right' });

    // ===== FOOTER =====
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Page ${i} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
        doc.text(
            'Generated by ZimEstimate - zimestimate.com',
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 5,
            { align: 'center' }
        );
    }

    return doc;
}

export function downloadBOQPDF(project: Project, items: BOQItem[], options?: Partial<ExportOptions>): void {
    const doc = generateBOQPDF(project, items, options);
    const filename = `${project.name.replace(/[^a-z0-9]/gi, '_')}_BOQ_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}

export function getBOQPDFBlob(project: Project, items: BOQItem[], options?: Partial<ExportOptions>): Blob {
    const doc = generateBOQPDF(project, items, options);
    return doc.output('blob');
}

export function printBOQPDF(project: Project, items: BOQItem[], options?: Partial<ExportOptions>): void {
    const doc = generateBOQPDF(project, items, options);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
}

// Vision Takeoff BOQ Export
interface VisionBOQData {
    projectName: string;
    location?: string;
    totalArea: number;
    items: Array<{
        material_name: string;
        /** Lets the cost split tell an extra's labour line from its materials. */
        material_id?: string;
        category: string;
        quantity: number;
        unit: string;
        unit_price_usd: number;
        unit_price_zwg: number;
        /** What the line is for, printed under the name. */
        note?: string | null;
    }>;
    totals: { usd: number; zwg: number };
    config: {
        scope: string | string[];
        brickType: string | string[];
        cementType: string | string[];
        includeLabor: boolean;
    };
}

/**
 * A saved quick estimate, in the shape exportBOQToPDF expects.
 *
 * Pulled out so the same PDF a user gets by opening the estimate is also what
 * they get from the three-dot menu on its card — before this, only the detail
 * page could produce one, so "Download BOQ PDF" existed on a full-project card
 * and had no equivalent on a quick estimate's.
 */
export interface QuickEstimatePdfSource {
    name: string;
    typeLabel: string;
    location: string | null;
    boqItems: Array<{
        description: string;
        category: string;
        quantity: number;
        unit: string;
        unitCostUsd: number;
        included?: boolean;
        owned?: boolean;
    }>;
    labor?: { enabled?: boolean };
}

export function downloadQuickEstimatePDF(boq: QuickEstimatePdfSource): { error: string | null } {
    const data = quickEstimateDocumentData(boq);
    if (!data) return { error: 'This estimate has no items to download.' };
    exportBOQToPDF(data, 'USD');
    return { error: null };
}

/** The quick estimate PDF as a file, for sharing; null when it has no items. */
export function getQuickEstimatePDFBlob(boq: QuickEstimatePdfSource): Blob | null {
    const data = quickEstimateDocumentData(boq);
    return data ? getBOQDocumentBlob(data, 'USD') : null;
}

function quickEstimateDocumentData(boq: QuickEstimatePdfSource): VisionBOQData | null {
    const included = boq.boqItems.filter((i) => i.included !== false && !i.owned);
    if (included.length === 0) return null;

    const totalUsd = included.reduce((sum, i) => sum + i.quantity * i.unitCostUsd, 0);

    return (
        {
            projectName: boq.name,
            location: boq.location || '',
            totalArea: 0,
            items: included.map((i) => ({
                material_name: i.description,
                category: i.category,
                quantity: i.quantity,
                unit: i.unit,
                unit_price_usd: i.unitCostUsd,
                unit_price_zwg: i.unitCostUsd * 27,
            })),
            totals: { usd: totalUsd, zwg: totalUsd * 27 },
            config: {
                scope: boq.typeLabel,
                brickType: '',
                cementType: '',
                includeLabor: boq.labor?.enabled ?? false,
            },
        }
    );
}

export function exportBOQToPDF(data: VisionBOQData, currency: 'USD' | 'ZWG' = 'USD'): void {
    buildBOQDocument(data, currency).save(boqFileName(data.projectName));
}

/** The same document as exportBOQToPDF, as a file to attach instead of save. */
export function getBOQDocumentBlob(data: VisionBOQData, currency: 'USD' | 'ZWG' = 'USD'): Blob {
    return buildBOQDocument(data, currency).output('blob');
}

function buildBOQDocument(data: VisionBOQData, currency: 'USD' | 'ZWG'): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = margin;

    const primaryColor: [number, number, number] = [6, 20, 47];
    const accentColor: [number, number, number] = [78, 154, 247];

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('ZimEstimate', margin, 25);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('AI Vision Takeoff - Bill of Quantities', margin, 33);

    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, 25, { align: 'right' });

    yPos = 55;

    // Project Info
    doc.setTextColor(...primaryColor);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.projectName, margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);

    if (data.location) {
        doc.text(`Location: ${data.location}`, margin, yPos);
        yPos += 5;
    }

    doc.text(`Floor Area: ${data.totalArea.toFixed(0)} m²`, margin, yPos);
    yPos += 5;

    // Helper to format array values
    const formatConfigValue = (value: string | string[]): string => {
        if (Array.isArray(value)) {
            return value.map(v => v.replace('_', ' ')).join(', ');
        }
        return value.replace('_', ' ');
    };

    doc.text(`Scope: ${formatConfigValue(data.config.scope)}`, margin, yPos);
    yPos += 5;

    doc.text(`Wall Material: ${formatConfigValue(data.config.brickType)}`, margin, yPos);
    yPos += 5;

    doc.text(`Labor: ${data.config.includeLabor ? 'Included' : 'Materials Only'}`, margin, yPos);
    yPos += 15;

    // Summary Box
    const displayTotal = currency === 'USD' ? data.totals.usd : data.totals.zwg;

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 25, 3, 3, 'F');

    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL ESTIMATE', margin + 10, yPos + 10);

    doc.setFontSize(16);
    doc.setTextColor(...accentColor);
    doc.text(formatCurrency(displayTotal, currency), margin + 10, yPos + 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.items.length} line items`, pageWidth - margin - 10, yPos + 15, { align: 'right' });

    yPos += 35;

    yPos = drawCostSplit(doc, yPos, margin, costSplitSlices(data.items.map((item) => ({
        category: item.category,
        materialId: item.material_id,
        total: item.quantity * (currency === 'USD' ? item.unit_price_usd : item.unit_price_zwg),
    }))), currency);

    const grouped = groupBoqByStage(data.items);

    // Items by category
    for (const category of Object.keys(grouped)) {
        const categoryItems = grouped[category];
        const categoryTotal = categoryItems.reduce(
            (sum, item) => sum + item.quantity * (currency === 'USD' ? item.unit_price_usd : item.unit_price_zwg),
            0
        );

        if (yPos > 250) {
            doc.addPage();
            yPos = margin;
        }

        // Category header
        doc.setFillColor(...accentColor);
        doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(categoryLabels[category] || category, margin + 5, yPos + 5.5);
        doc.text(formatCurrency(categoryTotal, currency), pageWidth - margin - 5, yPos + 5.5, { align: 'right' });

        yPos += 10;

        const tableData = categoryItems.flatMap((item, index) => {
            const unitPrice = currency === 'USD' ? item.unit_price_usd : item.unit_price_zwg;
            const total = item.quantity * unitPrice;

            const row = [
                materialCell(item.material_name, item.note),
                `${item.quantity.toLocaleString()} ${item.unit}`,
                formatCurrency(unitPrice, currency),
                formatCurrency(total, currency),
            ];
            return isLaborCategory(item.category) && (index === 0 || !isLaborCategory(categoryItems[index - 1].category))
                ? [[{ content: 'Labour', colSpan: 4, styles: { fontStyle: 'bold' as const, textColor: [100, 100, 100] as [number, number, number] } }], row] : [row];
        });

        autoTable(doc, {
            startY: yPos,
            head: [['Material', 'Quantity', 'Unit Price', 'Total']],
            body: tableData,
            margin: { left: margin, right: margin },
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [60, 60, 60],
                fontStyle: 'bold',
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
            },
            alternateRowStyles: { fillColor: [250, 250, 250] },
        });

        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }

    // Grand Total
    if (yPos > 260) {
        doc.addPage();
        yPos = margin;
    }

    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPos, pageWidth - margin * 2, 15, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL', margin + 10, yPos + 10);
    doc.text(formatCurrency(displayTotal, currency), pageWidth - margin - 10, yPos + 10, { align: 'right' });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
        // Was "Generated by ZimEstimate Vision Takeoff" on every PDF this
        // builds, including budget estimates and quick estimates.
        doc.text('Generated by ZimEstimate · zimestimate.com', pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
    }

    return doc;
}

function boqFileName(projectName: string): string {
    return `${projectName.replace(/[^a-z0-9]/gi, '_')}_BOQ_${new Date().toISOString().split('T')[0]}.pdf`;
}
