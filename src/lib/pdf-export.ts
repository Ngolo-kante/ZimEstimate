import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, BOQItem } from './database.types';

interface ExportOptions {
    currency: 'USD' | 'ZWG';
    exchangeRate: number;
    includeNotes: boolean;
    includeSupplierInfo: boolean;
}

const defaultOptions: ExportOptions = {
    currency: 'USD',
    exchangeRate: 30,
    includeNotes: true,
    includeSupplierInfo: false,
};

// Group items by category
function groupItemsByCategory(items: BOQItem[]): Record<string, BOQItem[]> {
    return items.reduce((acc, item) => {
        const category = item.category || 'Other';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {} as Record<string, BOQItem[]>);
}

// Category display names
const categoryLabels: Record<string, string> = {
    substructure: 'Substructure',
    superstructure: 'Superstructure',
    roofing: 'Roofing',
    finishing: 'Finishing',
    exterior: 'Exterior & Security',
    labor: 'Labor & Services',
};

// Format currency
function formatCurrency(amount: number, currency: 'USD' | 'ZWG'): string {
    if (currency === 'ZWG') {
        return `ZiG ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

    // ===== BOQ ITEMS BY CATEGORY =====
    const groupedItems = groupItemsByCategory(items);
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
        const tableData = categoryItems.map((item) => {
            const unitPrice = opts.currency === 'USD' ? Number(item.unit_price_usd) : Number(item.unit_price_zwg);
            const total = opts.currency === 'USD' ? Number(item.total_usd) : Number(item.total_zwg);

            return [
                item.material_name,
                `${Number(item.quantity).toLocaleString()} ${item.unit}`,
                formatCurrency(unitPrice, opts.currency),
                formatCurrency(total, opts.currency),
            ];
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
            'Generated by ZimEstimate - zimestimate.co.zw',
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
        category: string;
        quantity: number;
        unit: string;
        unit_price_usd: number;
        unit_price_zwg: number;
    }>;
    totals: { usd: number; zwg: number };
    config: {
        scope: string;
        brickType: string;
        cementType: string;
        includeLabor: boolean;
    };
}

export function exportBOQToPDF(data: VisionBOQData, currency: 'USD' | 'ZWG' = 'USD'): void {
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

    doc.text(`Scope: ${data.config.scope.replace('_', ' ')}`, margin, yPos);
    yPos += 5;

    doc.text(`Wall Material: ${data.config.brickType.replace('_', ' ')}`, margin, yPos);
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

    // Group items by category
    const grouped: Record<string, typeof data.items> = {};
    data.items.forEach((item) => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    });

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

        const tableData = categoryItems.map((item) => {
            const unitPrice = currency === 'USD' ? item.unit_price_usd : item.unit_price_zwg;
            const total = item.quantity * unitPrice;

            return [
                item.material_name,
                `${item.quantity.toLocaleString()} ${item.unit}`,
                formatCurrency(unitPrice, currency),
                formatCurrency(total, currency),
            ];
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
        doc.text('Generated by ZimEstimate Vision Takeoff', pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
    }

    // Download
    const filename = `${data.projectName.replace(/[^a-z0-9]/gi, '_')}_BOQ_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}
