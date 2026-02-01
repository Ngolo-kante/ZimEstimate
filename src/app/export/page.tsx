'use client';

import { useState, Suspense } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
    FilePdf,
    FileXls,
    Copy,
    Check,
    Printer,
    EnvelopeSimple,
    WhatsappLogo,
} from '@phosphor-icons/react';
import { exportBOQToPDF, type BOQExportData } from '@/lib/pdf-export';

function ExportContent() {
    const [currency, _setCurrency] = useState<'USD' | 'ZWG'>('USD');
    const [projectName, setProjectName] = useState('Borrowdale 4-Bedroom House');
    const [clientName, setClientName] = useState('');
    const [location, setLocation] = useState('Borrowdale, Harare');
    const [notes, setNotes] = useState('');
    const [exporting, setExporting] = useState(false);
    const [copied, setCopied] = useState(false);

    // Sample data for demo (in production, this would come from context/state)
    const sampleBOQData: BOQExportData = {
        projectName,
        clientName: clientName || undefined,
        location: location || undefined,
        exportDate: new Date().toLocaleDateString('en-ZW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }),
        milestones: [
            {
                name: 'Substructure',
                items: [
                    { material: 'Common Cement Brick', quantity: 5000, unit: 'bricks', unitPrice: 0.075, total: 375 },
                    { material: 'Standard Cement 32.5N', quantity: 40, unit: 'bags', unitPrice: 10, total: 400 },
                    { material: 'River Sand (Concrete)', quantity: 8, unit: 'cubes', unitPrice: 45, total: 360 },
                    { material: 'Crushed Stone 19mm', quantity: 6, unit: 'cubes', unitPrice: 55, total: 330 },
                    { material: 'Rebar Y12 (6m)', quantity: 30, unit: 'lengths', unitPrice: 8, total: 240 },
                ],
                subtotal: 1705,
            },
            {
                name: 'Superstructure',
                items: [
                    { material: 'Common Cement Brick', quantity: 12000, unit: 'bricks', unitPrice: 0.075, total: 900 },
                    { material: 'Standard Cement 32.5N', quantity: 80, unit: 'bags', unitPrice: 10, total: 800 },
                    { material: 'River Sand (Concrete)', quantity: 12, unit: 'cubes', unitPrice: 45, total: 540 },
                    { material: 'Rebar Y10 (6m)', quantity: 45, unit: 'lengths', unitPrice: 6.5, total: 292.5 },
                ],
                subtotal: 2532.5,
            },
            {
                name: 'Roofing',
                items: [
                    { material: 'IBR Sheet 0.5mm (3m)', quantity: 45, unit: 'sheets', unitPrice: 22, total: 990 },
                    { material: 'Timber 50x76mm (Rafters)', quantity: 40, unit: 'lengths', unitPrice: 15, total: 600 },
                    { material: 'Timber 38x38mm (Brandering)', quantity: 60, unit: 'lengths', unitPrice: 8, total: 480 },
                    { material: 'PVC Fascia Board', quantity: 20, unit: 'lengths', unitPrice: 12, total: 240 },
                    { material: 'Roof Screws', quantity: 10, unit: 'packs', unitPrice: 8, total: 80 },
                ],
                subtotal: 2390,
            },
        ],
        grandTotal: 6627.5,
        currency: currency as 'USD' | 'ZWG',
        notes: notes || undefined,
    };

    const handleExportPDF = async () => {
        setExporting(true);
        try {
            exportBOQToPDF(sampleBOQData);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setExporting(false);
        }
    };

    const handleCopyLink = () => {
        const shareUrl = `${window.location.origin}/share/boq/demo-123`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = (platform: 'email' | 'whatsapp') => {
        const subject = encodeURIComponent(`BOQ: ${projectName}`);
        const body = encodeURIComponent(
            `Here's the Bill of Quantities for ${projectName}.\n\nTotal: $${sampleBOQData.grandTotal.toLocaleString()}\n\nView online: ${window.location.origin}/share/boq/demo-123`
        );

        if (platform === 'email') {
            window.open(`mailto:?subject=${subject}&body=${body}`);
        } else if (platform === 'whatsapp') {
            window.open(`https://wa.me/?text=${body}`);
        }
    };

    return (
        <MainLayout title="Export BOQ">
            <div className="export-page">
                <div className="export-grid">
                    {/* Export Settings */}
                    <Card className="settings-card">
                        <CardContent>
                            <h2>Export Settings</h2>
                            <p className="settings-desc">Customize your exported document</p>

                            <div className="form-group">
                                <label>Project Name</label>
                                <Input
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="Enter project name"
                                />
                            </div>

                            <div className="form-group">
                                <label>Client Name (optional)</label>
                                <Input
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    placeholder="Enter client name"
                                />
                            </div>

                            <div className="form-group">
                                <label>Location (optional)</label>
                                <Input
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="Enter project location"
                                />
                            </div>

                            <div className="form-group">
                                <label>Notes (optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add any notes or terms..."
                                    rows={3}
                                    className="notes-textarea"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Export Options */}
                    <div className="export-options">
                        <Card className="option-card">
                            <CardContent>
                                <div className="option-icon pdf">
                                    <FilePdf size={32} weight="light" />
                                </div>
                                <h3>Export as PDF</h3>
                                <p>Professional document ready for printing or sharing</p>
                                <Button onClick={handleExportPDF} disabled={exporting}>
                                    {exporting ? 'Generating...' : 'Generate PDF'}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="option-card">
                            <CardContent>
                                <div className="option-icon excel">
                                    <FileXls size={32} weight="light" />
                                </div>
                                <h3>Export as Excel</h3>
                                <p>Spreadsheet format for further analysis</p>
                                <Button variant="secondary" disabled>
                                    Coming Soon
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="option-card">
                            <CardContent>
                                <div className="option-icon print">
                                    <Printer size={32} weight="light" />
                                </div>
                                <h3>Print Directly</h3>
                                <p>Send directly to your printer</p>
                                <Button variant="secondary" onClick={() => window.print()}>
                                    Print
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Share Options */}
                    <Card className="share-card">
                        <CardContent>
                            <h2>Share BOQ</h2>
                            <p className="share-desc">Generate a shareable link or send directly</p>

                            <div className="share-link">
                                <Input
                                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/boq/demo-123`}
                                    readOnly
                                />
                                <Button
                                    variant="secondary"
                                    onClick={handleCopyLink}
                                    icon={copied ? <Check size={18} /> : <Copy size={18} />}
                                >
                                    {copied ? 'Copied!' : 'Copy'}
                                </Button>
                            </div>

                            <div className="share-buttons">
                                <Button
                                    variant="secondary"
                                    onClick={() => handleShare('email')}
                                    icon={<EnvelopeSimple size={18} />}
                                >
                                    Email
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => handleShare('whatsapp')}
                                    icon={<WhatsappLogo size={18} />}
                                    className="whatsapp-btn"
                                >
                                    WhatsApp
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <style jsx>{`
        .export-page {
          max-width: 900px;
          margin: 0 auto;
        }

        .export-grid {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .settings-card h2,
        .share-card h2 {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .settings-desc,
        .share-desc {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-lg) 0;
        }

        .form-group {
          margin-bottom: var(--spacing-md);
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          margin-bottom: var(--spacing-xs);
        }

        .notes-textarea {
          width: 100%;
          padding: var(--spacing-sm);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 0.875rem;
          resize: vertical;
          background: var(--color-background);
          color: var(--color-text);
        }

        .notes-textarea:focus {
          outline: none;
          border-color: var(--color-accent);
        }

        .export-options {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-md);
        }

        .option-card {
          text-align: center;
        }

        .option-icon {
          width: 64px;
          height: 64px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--spacing-md);
        }

        .option-icon.pdf {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .option-icon.excel {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
        }

        .option-icon.print {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .option-card h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .option-card p {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-md) 0;
        }

        .share-link {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-lg);
        }

        .share-link :global(.input-wrapper) {
          flex: 1;
        }

        .share-buttons {
          display: flex;
          gap: var(--spacing-sm);
        }

        .whatsapp-btn {
          background: #25d366 !important;
          border-color: #25d366 !important;
          color: white !important;
        }

        @media (max-width: 768px) {
          .export-options {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </MainLayout>
    );
}

export default function ExportPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ExportContent />
        </Suspense>
    );
}
