'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { materials } from '@/lib/materials';
import {
    ArrowLeft,
    Check,
    X,
    MagnifyingGlass,
    ArrowsClockwise,
    Warning,
    CheckCircle,
    Clock,
    LinkSimple
} from '@phosphor-icons/react';

interface PendingMatch {
    id: string;
    scraped_name: string;
    scraped_price: number | null;
    source_url: string | null;
    suggested_material_code: string | null;
    confidence: number | null;
    match_method: string | null;
    created_at: string;
}

export default function ScraperReviewPage() {
    const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMaterial, setSelectedMaterial] = useState<string>('');
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Stats
    const [stats, setStats] = useState({ pending: 0, confirmed: 0, rejected: 0 });

    // Cement materials for the dropdown
    const cementMaterials = materials.filter(m => m.category === 'cement');

    useEffect(() => {
        fetchPendingMatches();
        fetchStats();
    }, []);

    const fetchPendingMatches = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pending_matches')
            .select('*')
            .is('resolved_at', null)
            .order('created_at', { ascending: false })
            .limit(100);

        if (!error && data) {
            setPendingMatches(data as PendingMatch[]);
        }
        setLoading(false);
    };

    const fetchStats = async () => {
        // Get counts
        const { count: pendingCount } = await supabase
            .from('pending_matches')
            .select('*', { count: 'exact', head: true })
            .is('resolved_at', null);

        const { count: confirmedCount } = await supabase
            .from('pending_matches')
            .select('*', { count: 'exact', head: true })
            .eq('resolution_type', 'confirmed');

        const { count: rejectedCount } = await supabase
            .from('pending_matches')
            .select('*', { count: 'exact', head: true })
            .eq('resolution_type', 'rejected');

        setStats({
            pending: pendingCount || 0,
            confirmed: confirmedCount || 0,
            rejected: rejectedCount || 0
        });
    };

    const handleConfirm = async (match: PendingMatch, materialCode?: string) => {
        const codeToUse = materialCode || match.suggested_material_code;
        if (!codeToUse) return;

        setProcessingId(match.id);

        // 1. Create alias
        const normalizedName = match.scraped_name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        await supabase.from('material_aliases').insert({
            material_code: codeToUse,
            alias_name: normalizedName,
            confidence_score: 1.0
        } as never);

        // 2. Mark as resolved
        await supabase.from('pending_matches').update({
            resolved_at: new Date().toISOString(),
            resolved_material_code: codeToUse,
            resolution_type: 'confirmed'
        } as never).eq('id', match.id);

        // 3. Update any pending price_observations with this match
        if (match.suggested_material_code) {
            await supabase.from('price_observations').update({
                material_key: codeToUse,
                review_status: 'confirmed'
            } as never).eq('material_key', match.suggested_material_code)
                .eq('review_status', 'pending');
        }

        setProcessingId(null);
        fetchPendingMatches();
        fetchStats();
    };

    const handleReject = async (match: PendingMatch) => {
        setProcessingId(match.id);

        await supabase.from('pending_matches').update({
            resolved_at: new Date().toISOString(),
            resolution_type: 'rejected'
        } as never).eq('id', match.id);

        // Update related observations
        if (match.suggested_material_code) {
            await supabase.from('price_observations').update({
                review_status: 'rejected'
            } as never).eq('material_key', match.suggested_material_code)
                .eq('review_status', 'pending');
        }

        setProcessingId(null);
        fetchPendingMatches();
        fetchStats();
    };

    const handleRemap = async (match: PendingMatch, newMaterialCode: string) => {
        if (!newMaterialCode) return;
        await handleConfirm(match, newMaterialCode);
    };

    const getMaterialName = (code: string | null) => {
        if (!code) return 'No suggestion';
        const m = materials.find(mat => mat.id === code);
        return m?.name || code;
    };

    const getConfidenceColor = (confidence: number | null) => {
        if (!confidence) return 'gray';
        if (confidence >= 0.8) return 'green';
        if (confidence >= 0.6) return 'yellow';
        return 'red';
    };

    const filteredMatches = pendingMatches.filter(m =>
        m.scraped_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <MainLayout title="Scraper Review">
            <div className="review-page">
                {/* Header */}
                <div className="page-header">
                    <Link href="/scraper" className="back-link">
                        <ArrowLeft size={16} /> Back to Scrapers
                    </Link>
                    <div className="header-main">
                        <div>
                            <h1>Scraper Review Queue</h1>
                            <p>Review and confirm scraped price matches</p>
                        </div>
                        <Button onClick={fetchPendingMatches} variant="secondary">
                            <ArrowsClockwise size={16} /> Refresh
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="stats-row">
                    <div className="stat-card pending">
                        <Clock size={24} weight="fill" />
                        <div>
                            <span className="stat-value">{stats.pending}</span>
                            <span className="stat-label">Pending</span>
                        </div>
                    </div>
                    <div className="stat-card confirmed">
                        <CheckCircle size={24} weight="fill" />
                        <div>
                            <span className="stat-value">{stats.confirmed}</span>
                            <span className="stat-label">Confirmed</span>
                        </div>
                    </div>
                    <div className="stat-card rejected">
                        <Warning size={24} weight="fill" />
                        <div>
                            <span className="stat-value">{stats.rejected}</span>
                            <span className="stat-label">Rejected</span>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="search-bar">
                    <Input
                        placeholder="Search scraped names..."
                        icon={<MagnifyingGlass size={16} />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Table */}
                <div className="review-table-container">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner" />
                            <p>Loading pending matches...</p>
                        </div>
                    ) : filteredMatches.length === 0 ? (
                        <div className="empty-state">
                            <CheckCircle size={48} weight="thin" />
                            <h3>All Caught Up!</h3>
                            <p>No pending matches to review.</p>
                        </div>
                    ) : (
                        <table className="review-table">
                            <thead>
                                <tr>
                                    <th>Scraped Name</th>
                                    <th>Price</th>
                                    <th>Suggested Match</th>
                                    <th>Confidence</th>
                                    <th>Remap To</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMatches.map(match => (
                                    <tr key={match.id} className={processingId === match.id ? 'processing' : ''}>
                                        <td className="scraped-name">
                                            <div className="name-cell">
                                                <span>{match.scraped_name}</span>
                                                {match.source_url && (
                                                    <a href={match.source_url} target="_blank" rel="noopener noreferrer" className="source-link">
                                                        <LinkSimple size={12} />
                                                    </a>
                                                )}
                                            </div>
                                            <span className="method-badge">{match.match_method}</span>
                                        </td>
                                        <td className="price">
                                            {match.scraped_price ? `$${match.scraped_price.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="suggestion">
                                            {getMaterialName(match.suggested_material_code)}
                                        </td>
                                        <td>
                                            <span className={`confidence-badge ${getConfidenceColor(match.confidence)}`}>
                                                {match.confidence ? `${(match.confidence * 100).toFixed(0)}%` : '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <select
                                                className="remap-select"
                                                value={selectedMaterial}
                                                onChange={(e) => setSelectedMaterial(e.target.value)}
                                            >
                                                <option value="">Keep suggested</option>
                                                {cementMaterials.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="actions">
                                            <button
                                                className="action-btn confirm"
                                                onClick={() => selectedMaterial
                                                    ? handleRemap(match, selectedMaterial)
                                                    : handleConfirm(match)
                                                }
                                                disabled={processingId === match.id}
                                                title="Confirm & Create Alias"
                                            >
                                                <Check size={18} weight="bold" />
                                            </button>
                                            <button
                                                className="action-btn reject"
                                                onClick={() => handleReject(match)}
                                                disabled={processingId === match.id}
                                                title="Reject Match"
                                            >
                                                <X size={18} weight="bold" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <style jsx>{`
                .review-page {
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .page-header {
                    margin-bottom: 32px;
                }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: #64748b;
                    text-decoration: none;
                    font-size: 0.9rem;
                    margin-bottom: 16px;
                }
                .back-link:hover { color: #0f172a; }

                .header-main {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }

                .header-main h1 {
                    font-size: 2rem;
                    font-weight: 800;
                    margin: 0 0 8px 0;
                }

                .header-main p {
                    color: #64748b;
                    margin: 0;
                }

                /* Stats */
                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 16px;
                    margin-bottom: 24px;
                }

                .stat-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .stat-card.pending { border-left: 4px solid #f59e0b; }
                .stat-card.pending svg { color: #f59e0b; }
                .stat-card.confirmed { border-left: 4px solid #22c55e; }
                .stat-card.confirmed svg { color: #22c55e; }
                .stat-card.rejected { border-left: 4px solid #ef4444; }
                .stat-card.rejected svg { color: #ef4444; }

                .stat-value {
                    display: block;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #0f172a;
                }

                .stat-label {
                    font-size: 0.8rem;
                    color: #64748b;
                    text-transform: uppercase;
                }

                /* Search */
                .search-bar {
                    margin-bottom: 24px;
                    max-width: 400px;
                }

                /* Table */
                .review-table-container {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                }

                .review-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .review-table th {
                    text-align: left;
                    padding: 16px;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: #64748b;
                    font-weight: 600;
                }

                .review-table td {
                    padding: 16px;
                    border-bottom: 1px solid #f1f5f9;
                    vertical-align: middle;
                }

                .review-table tr:last-child td { border-bottom: none; }
                .review-table tr.processing { opacity: 0.5; }

                .name-cell {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .source-link {
                    color: #94a3b8;
                    transition: color 0.2s;
                }
                .source-link:hover { color: #3b82f6; }

                .method-badge {
                    display: inline-block;
                    font-size: 0.7rem;
                    background: #f1f5f9;
                    color: #64748b;
                    padding: 2px 6px;
                    border-radius: 4px;
                    margin-top: 4px;
                }

                .price {
                    font-weight: 600;
                    font-family: monospace;
                }

                .suggestion {
                    max-width: 200px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .confidence-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 99px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                .confidence-badge.green { background: #dcfce7; color: #166534; }
                .confidence-badge.yellow { background: #fef3c7; color: #92400e; }
                .confidence-badge.red { background: #fee2e2; color: #991b1b; }
                .confidence-badge.gray { background: #f1f5f9; color: #64748b; }

                .remap-select {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    background: white;
                }

                .actions {
                    display: flex;
                    gap: 8px;
                }

                .action-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .action-btn.confirm:hover {
                    background: #dcfce7;
                    border-color: #86efac;
                    color: #166534;
                }

                .action-btn.reject:hover {
                    background: #fee2e2;
                    border-color: #fca5a5;
                    color: #991b1b;
                }

                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                /* States */
                .loading-state, .empty-state {
                    padding: 60px;
                    text-align: center;
                    color: #94a3b8;
                }

                .empty-state h3 { color: #0f172a; margin: 16px 0 8px; }

                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #f1f5f9;
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin: 0 auto 16px;
                }

                @keyframes spin { to { transform: rotate(360deg); } }

                @media (max-width: 900px) {
                    .stats-row { grid-template-columns: 1fr; }
                    .review-table { display: block; overflow-x: auto; }
                }
            `}</style>
        </MainLayout>
    );
}
