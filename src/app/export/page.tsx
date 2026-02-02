'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { getProjectWithItems } from '@/lib/services/projects';
import { downloadBOQPDF, printBOQPDF } from '@/lib/pdf-export';
import { Project, BOQItem } from '@/lib/database.types';
import {
    FilePdf,
    FileXls,
    Copy,
    Check,
    Printer,
    EnvelopeSimple,
    WhatsappLogo,
    ArrowLeft,
    Warning,
} from '@phosphor-icons/react';

function ExportContent() {
    const searchParams = useSearchParams();
    const projectId = searchParams.get('project');
    const { currency } = useCurrency();

    const [project, setProject] = useState<Project | null>(null);
    const [items, setItems] = useState<BOQItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        async function loadProject() {
            if (!projectId) {
                setError('No project specified');
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            const { project: loadedProject, items: loadedItems, error: loadError } =
                await getProjectWithItems(projectId);

            if (loadError) {
                setError(loadError.message);
            } else if (loadedProject) {
                setProject(loadedProject);
                setItems(loadedItems);
            } else {
                setError('Project not found');
            }

            setIsLoading(false);
        }

        loadProject();
    }, [projectId]);

    const handleExportPDF = async () => {
        if (!project) return;

        setExporting(true);
        try {
            downloadBOQPDF(project, items, { currency });
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export PDF. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const handlePrint = () => {
        if (!project) return;

        try {
            printBOQPDF(project, items, { currency });
        } catch (error) {
            console.error('Print failed:', error);
            alert('Failed to print. Please try again.');
        }
    };

    const handleCopyLink = () => {
        if (!project) return;

        const shareUrl = `${window.location.origin}/share/boq/${project.id}`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = (platform: 'email' | 'whatsapp') => {
        if (!project) return;

        const subject = encodeURIComponent(`BOQ: ${project.name}`);
        const total = currency === 'USD' ? project.total_usd : project.total_zwg;
        const currencySymbol = currency === 'USD' ? '$' : 'ZiG ';
        const body = encodeURIComponent(
            `Here's the Bill of Quantities for ${project.name}.\n\nTotal: ${currencySymbol}${Number(total).toLocaleString()}\n\nView online: ${window.location.origin}/share/boq/${project.id}`
        );

        if (platform === 'email') {
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
        } else {
            window.open(`https://wa.me/?text=${body}`, '_blank');
        }
    };

    if (isLoading) {
        return (
            <MainLayout title="Export">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading project...</p>
                </div>
                <style jsx>{`
                    .loading-state {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 400px;
                        gap: var(--spacing-md);
                    }
                    .spinner {
                        width: 40px;
                        height: 40px;
                        border: 3px solid var(--color-border);
                        border-top-color: var(--color-primary);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    p { color: var(--color-text-secondary); }
                `}</style>
            </MainLayout>
        );
    }

    if (error || !project) {
        return (
            <MainLayout title="Export">
                <div className="error-state">
                    <Warning size={48} weight="light" />
                    <h2>{error || 'Project not found'}</h2>
                    <p>Unable to load the project for export.</p>
                    <Link href="/projects">
                        <Button variant="secondary" icon={<ArrowLeft size={18} />}>
                            Back to Projects
                        </Button>
                    </Link>
                </div>
                <style jsx>{`
                    .error-state {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 400px;
                        gap: var(--spacing-md);
                        text-align: center;
                        color: var(--color-text-muted);
                    }
                    h2 { color: var(--color-text); margin: 0; }
                    p { margin: 0; }
                `}</style>
            </MainLayout>
        );
    }

    const totalDisplay = currency === 'USD'
        ? `$${Number(project.total_usd).toLocaleString()}`
        : `ZiG ${Number(project.total_zwg).toLocaleString()}`;

    return (
        <MainLayout title="Export BOQ">
            <div className="export-page">
                {/* Back Link */}
                <Link href={`/projects/${project.id}`} className="back-link">
                    <ArrowLeft size={16} />
                    Back to Project
                </Link>

                <h1>Export Bill of Quantities</h1>
                <p className="subtitle">Download or share your BOQ for {project.name}</p>

                {/* Preview Card */}
                <Card className="preview-card">
                    <CardContent>
                        <div className="preview-header">
                            <div>
                                <h3>{project.name}</h3>
                                {project.location && <p className="location">{project.location}</p>}
                            </div>
                            <div className="preview-total">
                                <span className="label">Total</span>
                                <span className="value">{totalDisplay}</span>
                            </div>
                        </div>
                        <div className="preview-stats">
                            <div className="stat">
                                <span className="stat-value">{items.length}</span>
                                <span className="stat-label">Line Items</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">{project.scope.replace('_', ' ')}</span>
                                <span className="stat-label">Scope</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">{project.labor_preference === 'with_labor' ? 'Yes' : 'No'}</span>
                                <span className="stat-label">Labor Included</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Export Options */}
                <div className="export-grid">
                    {/* PDF Export */}
                    <Card className="export-option">
                        <CardContent>
                            <div className="option-icon pdf">
                                <FilePdf size={32} weight="duotone" />
                            </div>
                            <h4>Download PDF</h4>
                            <p>Professional formatted document ready for printing</p>
                            <Button
                                fullWidth
                                onClick={handleExportPDF}
                                loading={exporting}
                                icon={<FilePdf size={18} />}
                            >
                                Download PDF
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Print */}
                    <Card className="export-option">
                        <CardContent>
                            <div className="option-icon print">
                                <Printer size={32} weight="duotone" />
                            </div>
                            <h4>Print Directly</h4>
                            <p>Send to printer for physical copies</p>
                            <Button
                                fullWidth
                                variant="secondary"
                                onClick={handlePrint}
                                icon={<Printer size={18} />}
                            >
                                Print
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Excel (Coming Soon) */}
                    <Card className="export-option disabled">
                        <CardContent>
                            <div className="option-icon excel">
                                <FileXls size={32} weight="duotone" />
                            </div>
                            <h4>Export to Excel</h4>
                            <p>Spreadsheet format for editing</p>
                            <Button fullWidth variant="secondary" disabled>
                                Coming Soon
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Share Options */}
                <h2>Share</h2>
                <div className="share-grid">
                    <Card className="share-option">
                        <CardContent>
                            <div className="share-row">
                                <div className="share-info">
                                    <Copy size={24} />
                                    <div>
                                        <h4>Copy Link</h4>
                                        <p>Share a direct link to view online</p>
                                    </div>
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={handleCopyLink}
                                    icon={copied ? <Check size={18} /> : <Copy size={18} />}
                                >
                                    {copied ? 'Copied!' : 'Copy'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="share-option">
                        <CardContent>
                            <div className="share-row">
                                <div className="share-info">
                                    <EnvelopeSimple size={24} />
                                    <div>
                                        <h4>Email</h4>
                                        <p>Send via email</p>
                                    </div>
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={() => handleShare('email')}
                                    icon={<EnvelopeSimple size={18} />}
                                >
                                    Email
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="share-option">
                        <CardContent>
                            <div className="share-row">
                                <div className="share-info">
                                    <WhatsappLogo size={24} />
                                    <div>
                                        <h4>WhatsApp</h4>
                                        <p>Share via WhatsApp</p>
                                    </div>
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={() => handleShare('whatsapp')}
                                    icon={<WhatsappLogo size={18} />}
                                >
                                    Share
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <style jsx>{`
                .export-page {
                    max-width: 800px;
                    margin: 0 auto;
                }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    color: var(--color-text-secondary);
                    text-decoration: none;
                    font-size: 0.875rem;
                    margin-bottom: var(--spacing-md);
                }

                .back-link:hover {
                    color: var(--color-primary);
                }

                h1 {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--color-text);
                    margin: 0 0 var(--spacing-xs) 0;
                }

                .subtitle {
                    color: var(--color-text-secondary);
                    margin: 0 0 var(--spacing-xl) 0;
                }

                h2 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: var(--spacing-xl) 0 var(--spacing-md) 0;
                }

                :global(.preview-card) {
                    margin-bottom: var(--spacing-xl);
                    background: linear-gradient(135deg, var(--color-primary) 0%, #1a3a6d 100%);
                    color: white;
                }

                .preview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: var(--spacing-lg);
                }

                .preview-header h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin: 0;
                }

                .location {
                    opacity: 0.8;
                    font-size: 0.875rem;
                    margin: var(--spacing-xs) 0 0 0;
                }

                .preview-total {
                    text-align: right;
                }

                .preview-total .label {
                    display: block;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    opacity: 0.8;
                }

                .preview-total .value {
                    font-size: 1.5rem;
                    font-weight: 700;
                }

                .preview-stats {
                    display: flex;
                    gap: var(--spacing-xl);
                    padding-top: var(--spacing-md);
                    border-top: 1px solid rgba(255, 255, 255, 0.2);
                }

                .stat {
                    display: flex;
                    flex-direction: column;
                }

                .stat-value {
                    font-size: 1.125rem;
                    font-weight: 600;
                }

                .stat-label {
                    font-size: 0.75rem;
                    opacity: 0.8;
                }

                .export-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: var(--spacing-md);
                }

                :global(.export-option) {
                    text-align: center;
                }

                :global(.export-option.disabled) {
                    opacity: 0.6;
                }

                .option-icon {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto var(--spacing-md);
                }

                .option-icon.pdf {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                }

                .option-icon.print {
                    background: rgba(78, 154, 247, 0.1);
                    color: var(--color-primary);
                }

                .option-icon.excel {
                    background: rgba(34, 197, 94, 0.1);
                    color: #22c55e;
                }

                :global(.export-option) h4 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0 0 var(--spacing-xs) 0;
                }

                :global(.export-option) p {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                    margin: 0 0 var(--spacing-md) 0;
                }

                .share-grid {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .share-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .share-info {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                    color: var(--color-text-secondary);
                }

                .share-info h4 {
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0;
                }

                .share-info p {
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                    margin: 0;
                }

                @media (max-width: 768px) {
                    .export-grid {
                        grid-template-columns: 1fr;
                    }

                    .preview-stats {
                        flex-wrap: wrap;
                    }
                }
            `}</style>
        </MainLayout>
    );
}

function ExportPage() {
    return (
        <ProtectedRoute>
            <Suspense fallback={<div>Loading...</div>}>
                <ExportContent />
            </Suspense>
        </ProtectedRoute>
    );
}

export default ExportPage;
