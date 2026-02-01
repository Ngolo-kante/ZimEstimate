// PDF Export utilities for generating Bill of Quantities documents
// Uses browser's built-in print functionality with custom styling

export interface BOQExportData {
  projectName: string;
  clientName?: string;
  location?: string;
  exportDate: string;
  milestones: {
    name: string;
    items: {
      material: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      total: number;
    }[];
    subtotal: number;
  }[];
  grandTotal: number;
  currency: 'USD' | 'ZWG';
  notes?: string;
}

export function generateBOQPrintStyles(): string {
  return `
    @media print {
      @page {
        size: A4;
        margin: 1.5cm;
      }

      body {
        font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
        font-size: 10pt;
        line-height: 1.4;
        color: #1a1a1a;
      }

      .print-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #14213D;
        padding-bottom: 16px;
        margin-bottom: 24px;
      }

      .print-logo {
        font-size: 18pt;
        font-weight: 700;
        color: #14213D;
      }

      .print-logo span {
        color: #4E9AF7;
      }

      .print-title {
        font-size: 14pt;
        font-weight: 600;
        color: #14213D;
        margin: 0 0 8px 0;
      }

      .print-subtitle {
        font-size: 9pt;
        color: #666;
        margin: 0;
      }

      .print-info-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 24px;
      }

      .print-info-item {
        background: #f5f5f5;
        padding: 12px;
        border-radius: 4px;
      }

      .print-info-label {
        font-size: 8pt;
        text-transform: uppercase;
        color: #888;
        margin-bottom: 4px;
      }

      .print-info-value {
        font-size: 11pt;
        font-weight: 600;
        color: #1a1a1a;
      }

      .print-milestone {
        margin-bottom: 24px;
        page-break-inside: avoid;
      }

      .print-milestone-header {
        background: #14213D;
        color: white;
        padding: 8px 12px;
        font-weight: 600;
        font-size: 11pt;
        margin-bottom: 0;
      }

      .print-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 8px;
      }

      .print-table th {
        background: #f0f0f0;
        padding: 8px;
        text-align: left;
        font-size: 8pt;
        text-transform: uppercase;
        color: #666;
        border: 1px solid #ddd;
      }

      .print-table td {
        padding: 8px;
        border: 1px solid #ddd;
        font-size: 9pt;
      }

      .print-table .text-right {
        text-align: right;
      }

      .print-table .text-center {
        text-align: center;
      }

      .print-table tfoot td {
        background: #f5f5f5;
        font-weight: 600;
      }

      .print-milestone-subtotal {
        text-align: right;
        padding: 8px 12px;
        background: #f5f5f5;
        font-weight: 600;
        border: 1px solid #ddd;
        border-top: none;
      }

      .print-summary {
        margin-top: 32px;
        border-top: 2px solid #14213D;
        padding-top: 16px;
      }

      .print-summary-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #eee;
      }

      .print-summary-row.total {
        font-size: 14pt;
        font-weight: 700;
        color: #14213D;
        border-bottom: 2px solid #14213D;
      }

      .print-notes {
        margin-top: 24px;
        padding: 12px;
        background: #fffbeb;
        border-left: 4px solid #4E9AF7;
        font-size: 9pt;
        page-break-inside: avoid;
      }

      .print-notes h4 {
        margin: 0 0 8px 0;
        font-size: 10pt;
        color: #14213D;
      }

      .print-footer {
        margin-top: 40px;
        padding-top: 16px;
        border-top: 1px solid #ddd;
        font-size: 8pt;
        color: #888;
        text-align: center;
      }

      /* Hide non-print elements */
      .no-print {
        display: none !important;
      }
    }
  `;
}

export function generateBOQHTML(data: BOQExportData): string {
  const formatCurrency = (value: number) => {
    if (data.currency === 'USD') {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `ZiG ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const milestonesHTML = data.milestones.map((milestone) => `
    <div class="print-milestone">
      <h3 class="print-milestone-header">${milestone.name}</h3>
      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 40%">Material</th>
            <th style="width: 15%" class="text-center">Quantity</th>
            <th style="width: 10%" class="text-center">Unit</th>
            <th style="width: 17%" class="text-right">Unit Price</th>
            <th style="width: 18%" class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${milestone.items.map((item) => `
            <tr>
              <td>${item.material}</td>
              <td class="text-center">${item.quantity.toLocaleString()}</td>
              <td class="text-center">${item.unit}</td>
              <td class="text-right">${formatCurrency(item.unitPrice)}</td>
              <td class="text-right">${formatCurrency(item.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="print-milestone-subtotal">
        Subtotal: ${formatCurrency(milestone.subtotal)}
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>BOQ - ${data.projectName}</title>
      <style>${generateBOQPrintStyles()}</style>
    </head>
    <body>
      <div class="print-header">
        <div>
          <div class="print-logo">Zim<span>Estimate</span></div>
          <p class="print-subtitle">Construction Cost Estimation</p>
        </div>
        <div style="text-align: right;">
          <h1 class="print-title">Bill of Quantities</h1>
          <p class="print-subtitle">Generated: ${data.exportDate}</p>
        </div>
      </div>

      <div class="print-info-grid">
        <div class="print-info-item">
          <div class="print-info-label">Project Name</div>
          <div class="print-info-value">${data.projectName}</div>
        </div>
        ${data.clientName ? `
          <div class="print-info-item">
            <div class="print-info-label">Client</div>
            <div class="print-info-value">${data.clientName}</div>
          </div>
        ` : ''}
        ${data.location ? `
          <div class="print-info-item">
            <div class="print-info-label">Location</div>
            <div class="print-info-value">${data.location}</div>
          </div>
        ` : ''}
      </div>

      ${milestonesHTML}

      <div class="print-summary">
        <div class="print-summary-row total">
          <span>Grand Total</span>
          <span>${formatCurrency(data.grandTotal)}</span>
        </div>
      </div>

      ${data.notes ? `
        <div class="print-notes">
          <h4>Notes</h4>
          <p>${data.notes}</p>
        </div>
      ` : ''}

      <div class="print-footer">
        <p>Generated by ZimEstimate • ${data.exportDate}</p>
        <p>This document is an estimate and actual costs may vary based on market conditions.</p>
      </div>
    </body>
    </html>
  `;
}

export function exportBOQToPDF(data: BOQExportData): void {
  const html = generateBOQHTML(data);

  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load, then trigger print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }
}

// Quick export function for current estimate
export function exportCurrentEstimate(): void {
  // Get data from localStorage or context
  const savedEstimate = localStorage.getItem('currentEstimate');

  if (!savedEstimate) {
    alert('No estimate data found to export.');
    return;
  }

  try {
    const estimateData = JSON.parse(savedEstimate);
    const currency = localStorage.getItem('currency') as 'USD' | 'ZWG' || 'USD';

    const exportData: BOQExportData = {
      projectName: estimateData.projectName || 'Untitled Project',
      clientName: estimateData.clientName,
      location: estimateData.location,
      exportDate: new Date().toLocaleDateString('en-ZW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      milestones: estimateData.milestones || [],
      grandTotal: estimateData.grandTotal || 0,
      currency,
      notes: estimateData.notes,
    };

    exportBOQToPDF(exportData);
  } catch (error) {
    console.error('Error exporting estimate:', error);
    alert('Failed to export estimate. Please try again.');
  }
}
