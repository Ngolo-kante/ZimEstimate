'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ScraperConfig } from '@/lib/database.types';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
    Plus,
    Trash,
    Play,
    Pause,
    CheckCircle,
    Clock,
    Globe,
    ArrowsClockwise,
    MagnifyingGlass,
    ArrowLeft,
    Eye
} from '@phosphor-icons/react';

export default function ScraperPage() {
    const [configs, setConfigs] = useState<ScraperConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isTestRunning, setIsTestRunning] = useState<string | null>(null);
    const [isBulkRunning, setIsBulkRunning] = useState(false);
    const [bulkStatus, setBulkStatus] = useState<{ total: number; completed: number; failed: number } | null>(null);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        site_name: '',
        base_url: '',
        price_selector: '',
        item_name_selector: '',
        cron_schedule: 'weekly',
        category: 'general',
        scrape_mode: 'single' as 'single' | 'category',
        container_selector: '',
        item_card_selector: ''
    });

    const categoryOptions = [
        'general',
        'cement',
        'bricks',
        'sand',
        'aggregates',
        'steel',
        'roofing',
        'timber',
        'electrical',
        'plumbing',
        'finishes',
        'hardware',
    ];

    const filteredConfigs = useMemo(() => {
        let items = configs;
        if (selectedCategory !== 'all') {
            items = items.filter((config) => (config.category || 'general') === selectedCategory);
        }
        if (searchQuery) {
            items = items.filter(config =>
                config.site_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                config.base_url.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return items;
    }, [configs, selectedCategory, searchQuery]);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('scraper_configs')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setConfigs(data);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this scraper?')) return;
        try {
            const response = await fetch(`/api/scraper/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete');
            fetchConfigs();
        } catch (error: any) {
            console.error('Delete error:', error);
            alert('Error deleting scraper: ' + error.message);
        }
    };

    const handleToggleActive = async (config: ScraperConfig) => {
        try {
            const response = await fetch(`/api/scraper/${config.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !config.is_active })
            });
            if (!response.ok) throw new Error('Failed to update status');
            fetchConfigs();
        } catch (error: any) {
            console.error('Toggle error:', error);
            alert('Error updating scraper status: ' + error.message);
        }
    };

    const runScraper = async (config: ScraperConfig) => {
        setIsTestRunning(config.id);
        try {
            const isCategory = config.scrape_mode === 'category';
            const endpoint = isCategory ? '/api/scraper/category' : '/api/scraper/test';

            const payload = isCategory
                ? {
                    configId: config.id,
                    url: config.base_url,
                    containerSelector: config.container_selector,
                    itemCardSelector: config.item_card_selector,
                    nameSelector: config.item_name_selector,
                    priceSelector: config.price_selector
                }
                : {
                    configId: config.id,
                    url: config.base_url,
                    priceSelector: config.price_selector,
                    nameSelector: config.item_name_selector
                };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to scrape');
            }

            setConfigs(prev => prev.map(c =>
                c.id === config.id
                    ? { ...c, last_successful_run_at: new Date().toISOString() }
                    : c
            ));

            return result;
        } finally {
            setIsTestRunning(null);
        }
    };

    const handleTestRun = async (config: ScraperConfig) => {
        try {
            const result = await runScraper(config);

            if (config.scrape_mode === 'category') {
                // Category scraper result
                alert(`Category Scrape Complete!\n\n📦 Items Found: ${result.itemsFound}\n✅ Matched: ${result.itemsMatched}\n⏳ Pending Review: ${result.itemsPending}`);
            } else {
                // Single item scraper result
                const matchInfo = result.match?.materialCode
                    ? `✅ Matched: "${result.name}" (${(result.match.confidence * 100).toFixed(0)}% confidence)`
                    : `⚠️ Unmatched (Raw: "${result.name}")`;

                alert(`Success! Found Price: $${result.price}\n\n${matchInfo}\nMethod: ${result.match?.method || 'unknown'}`);
            }
        } catch (err) {
            alert('Error running test scrape: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    const handleRunAll = async () => {
        const activeConfigs = filteredConfigs.filter((config) => config.is_active);
        if (activeConfigs.length === 0) {
            alert('No active scrapers visible for this filter set.');
            return;
        }

        setIsBulkRunning(true);
        setBulkStatus({ total: activeConfigs.length, completed: 0, failed: 0 });

        try {
            const configIds = activeConfigs.map(c => c.id);
            const response = await fetch('/api/scraper/run-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: selectedCategory !== 'all' ? selectedCategory : undefined,
                    configIds
                })
            });

            const result = await response.json();
            setBulkStatus({
                total: result.total,
                completed: result.succeeded + result.failed,
                failed: result.failed
            });

            // Refresh configs to get updated timestamps
            await fetchConfigs();

            const matchedItems = result.results
                .filter((r: { success: boolean }) => r.success)
                .reduce((sum: number, r: { itemsMatched?: number }) => sum + (r.itemsMatched || 0), 0);

            alert(`Bulk run complete!\n\n✅ Succeeded: ${result.succeeded}\n❌ Failed: ${result.failed}\n📦 Items matched: ${matchedItems}`);
        } catch (err) {
            console.error('Bulk run error:', err);
            alert('Error running bulk scrape. Check console for details.');
        } finally {
            setIsBulkRunning(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const response = await fetch('/api/scraper/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create scraper');
            }

            const result = await response.json();

            if (result.success) {
                setShowModal(false);
                setFormData({
                    site_name: '',
                    base_url: '',
                    price_selector: '',
                    item_name_selector: '',
                    cron_schedule: 'weekly',
                    category: 'general',
                    scrape_mode: 'single',
                    container_selector: '',
                    item_card_selector: ''
                });
                fetchConfigs();
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error: any) {
            console.error('Error creating scraper:', error);
            alert('Error creating scraper: ' + error.message);
        }
    };

    return (
        <MainLayout title="Scraper Command Center">
            <div className="scraper-page">
                {/* Header & Stats */}
                <div className="page-header">
                    <div className="header-top">
                        <Link href="/market-insights" className="back-link">
                            <ArrowLeft size={16} /> Back to Insights
                        </Link>
                        <div className="status-indicator">
                            <span className={`status-dot ${isBulkRunning ? 'processing' : 'ready'}`} />
                            {isBulkRunning ? 'System Processing...' : 'System Ready'}
                        </div>
                    </div>

                    <div className="header-main">
                        <div>
                            <h1>Scraper Command Center</h1>
                            <p>Manage data sources and execute extraction jobs directly.</p>
                        </div>
                        <div className="header-actions">
                            <Link href="/admin/scraper-review" className="review-link-btn">
                                <Eye size={16} weight="bold" /> Review Queue
                            </Link>
                            <Button onClick={() => setShowModal(true)} variant="secondary">
                                <Plus size={16} weight="bold" /> New Scraper
                            </Button>
                            <Button onClick={handleRunAll} disabled={isBulkRunning} className="run-all-btn">
                                <ArrowsClockwise size={18} className={isBulkRunning ? 'animate-spin' : ''} weight="bold" />
                                {isBulkRunning ? 'Running Jobs...' : 'Sync Visible Scrapers'}
                            </Button>
                        </div>
                    </div>

                    {bulkStatus && isBulkRunning && (
                        <div className="bulk-progress">
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(bulkStatus.completed / bulkStatus.total) * 100}%` }}
                                />
                            </div>
                            <div className="progress-text">
                                Processed {bulkStatus.completed} of {bulkStatus.total} ({bulkStatus.failed} failed)
                            </div>
                        </div>
                    )}
                </div>

                {/* Filters Row */}
                <div className="filters-row">
                    <div className="search-filter">
                        <Input
                            placeholder="Find scrapers..."
                            icon={<MagnifyingGlass size={16} />}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="category-filter">
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            <option value="all">All Categories</option>
                            {categoryOptions.map(cat => (
                                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading configurations...</p>
                    </div>
                ) : filteredConfigs.length === 0 ? (
                    <div className="empty-state">
                        <Globe size={48} weight="thin" />
                        <h3>No Scrapers Found</h3>
                        <p>No configurations match your current filters.</p>
                        <Button variant="secondary" onClick={() => setShowModal(true)}>Create One</Button>
                    </div>
                ) : (
                    <div className="configs-grid">
                        {filteredConfigs.map(config => (
                            <div key={config.id} className={`config-card ${!config.is_active ? 'inactive' : ''}`}>
                                <div className="card-header">
                                    <div className="site-info">
                                        <div className="badge-row">
                                            <span className={`status-badge ${config.is_active ? 'active' : 'paused'}`}>
                                                {config.is_active ? 'Active' : 'Paused'}
                                            </span>
                                            {config.scrape_mode === 'category' && (
                                                <span className="status-badge mode-badge">Category</span>
                                            )}
                                        </div>
                                        <h3>{config.site_name}</h3>
                                    </div>
                                    <div className="card-actions">
                                        <button onClick={() => handleToggleActive(config)} title={config.is_active ? 'Pause' : 'Resume'}>
                                            {config.is_active ? <Pause size={18} /> : <Play size={18} />}
                                        </button>
                                        <button onClick={() => handleDelete(config.id)} title="Delete" className="delete">
                                            <Trash size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="card-details">
                                    <div className="detail-item">
                                        <span className="label">Target</span>
                                        <span className="value url" title={config.base_url}>{config.base_url}</span>
                                    </div>
                                    <div className="detail-row">
                                        <div className="detail-item">
                                            <span className="label">Schedule</span>
                                            <span className="value badged"><Clock size={12} weight="fill" /> {config.cron_schedule}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Category</span>
                                            <span className="value">{config.category || 'General'}</span>
                                        </div>
                                    </div>
                                    {config.last_successful_run_at && (
                                        <div className="last-run">
                                            <CheckCircle size={14} weight="fill" className="text-green-500" />
                                            Last run: {new Date(config.last_successful_run_at).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>

                                <div className="card-footer">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => handleTestRun(config)}
                                        disabled={isTestRunning === config.id}
                                        className="test-btn"
                                    >
                                        {isTestRunning === config.id ? 'Testing...' : 'Run Test'}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal - Styled */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>New Configuration</h3>
                            <button onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label>Provider Name</label>
                                <Input
                                    placeholder="e.g. Halsteds Hardware"
                                    value={formData.site_name}
                                    onChange={e => setFormData({ ...formData, site_name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Schedule</label>
                                    <select
                                        value={formData.cron_schedule}
                                        onChange={e => setFormData({ ...formData, cron_schedule: e.target.value })}
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Scrape Mode</label>
                                <div className="mode-toggle">
                                    <button
                                        type="button"
                                        className={`mode-btn ${formData.scrape_mode === 'single' ? 'active' : ''}`}
                                        onClick={() => setFormData({ ...formData, scrape_mode: 'single' })}
                                    >
                                        Single Product
                                    </button>
                                    <button
                                        type="button"
                                        className={`mode-btn ${formData.scrape_mode === 'category' ? 'active' : ''}`}
                                        onClick={() => setFormData({ ...formData, scrape_mode: 'category' })}
                                    >
                                        Category Page
                                    </button>
                                </div>
                                <span className="mode-hint">
                                    {formData.scrape_mode === 'single'
                                        ? 'Scrape a single product page'
                                        : 'Scrape multiple products from a listing page'}
                                </span>
                            </div>

                            <div className="form-group">
                                <label>Target URL</label>
                                <Input
                                    placeholder="https://..."
                                    type="url"
                                    value={formData.base_url}
                                    onChange={e => setFormData({ ...formData, base_url: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="selectors-section">
                                <h4>CSS Selectors</h4>

                                {formData.scrape_mode === 'category' && (
                                    <>
                                        <div className="form-group">
                                            <label>Container Selector</label>
                                            <Input
                                                placeholder=".listings, .products-grid"
                                                value={formData.container_selector}
                                                onChange={e => setFormData({ ...formData, container_selector: e.target.value })}
                                                className="code-input"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Item Card Selector</label>
                                            <Input
                                                placeholder=".listing, .product-card"
                                                value={formData.item_card_selector}
                                                onChange={e => setFormData({ ...formData, item_card_selector: e.target.value })}
                                                required
                                                className="code-input"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="form-group">
                                    <label>Product Name {formData.scrape_mode === 'category' && '(within card)'}</label>
                                    <Input
                                        placeholder={formData.scrape_mode === 'category' ? '.listing-title a' : '.product-title'}
                                        value={formData.item_name_selector}
                                        onChange={e => setFormData({ ...formData, item_name_selector: e.target.value })}
                                        required
                                        className="code-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Price {formData.scrape_mode === 'category' && '(within card)'}</label>
                                    <Input
                                        placeholder={formData.scrape_mode === 'category' ? '.usd-price-tooltip' : '.price-amount'}
                                        value={formData.price_selector}
                                        onChange={e => setFormData({ ...formData, price_selector: e.target.value })}
                                        required
                                        className="code-input"
                                    />
                                </div>
                            </div>

                            <div className="modal-actions">
                                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                                <Button type="submit">save Configuration</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .scraper-page {
                    max-width: 1200px;
                    margin: 0 auto;
                    color: #0f172a;
                }

                .page-header {
                    margin-bottom: 32px;
                    padding-bottom: 24px;
                    border-bottom: 1px solid #e2e8f0;
                }

                .header-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .back-link {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #64748b;
                    font-size: 0.9rem;
                    text-decoration: none;
                    transition: color 0.2s;
                }
                
                .back-link:hover { color: #0f172a; }

                .status-indicator {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8rem;
                    color: #64748b;
                    font-weight: 500;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }
                .status-dot.ready { background: #22c55e; box-shadow: 0 0 0 2px #dcfce7; }
                .status-dot.processing { background: #3b82f6; box-shadow: 0 0 0 2px #dbeafe; animation: pulse 1.5s infinite; }

                .header-main {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    flex-wrap: wrap;
                    gap: 20px;
                }

                .header-main h1 {
                    font-size: 2rem;
                    font-weight: 800;
                    margin: 0 0 8px 0;
                    letter-spacing: -0.02em;
                }
                
                .header-main p { color: #64748b; margin: 0; }
                
                .header-actions {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                .review-link-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 16px;
                    background: #fef3c7;
                    color: #92400e;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                .review-link-btn:hover {
                    background: #fde68a;
                }

                .run-all-btn :global(button) {
                     background: #0f172a;
                     color: white;
                }

                .bulk-progress {
                    margin-top: 24px;
                    background: #f8fafc;
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                }

                .progress-bar {
                    height: 6px;
                    background: #e2e8f0;
                    border-radius: 3px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }

                .progress-fill {
                    height: 100%;
                    background: #3b82f6;
                    transition: width 0.3s ease;
                }

                .progress-text {
                    font-size: 0.85rem;
                    color: #64748b;
                    font-weight: 500;
                }

                /* Filters */
                .filters-row {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 32px;
                }

                .search-filter { flex: 1; max-width: 400px; }
                
                .category-filter select {
                    height: 100%;
                    padding: 0 16px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    color: #475569;
                    font-size: 0.9rem;
                    cursor: pointer;
                }

                /* Grid */
                .configs-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
                    gap: 24px;
                }

                .config-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 24px;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                }
                
                .config-card:hover {
                    border-color: #cbd5e1;
                    box-shadow: 0 4px 20px -4px rgba(0,0,0,0.05);
                }
                
                .config-card.inactive { opacity: 0.7; }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                }

                .site-info h3 { margin: 8px 0 0 0; font-size: 1.1rem; font-weight: 700; }
                
                .status-badge {
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    padding: 2px 8px;
                    border-radius: 99px;
                    font-weight: 600;
                    letter-spacing: 0.05em;
                }
                
                .status-badge.active { background: #dcfce7; color: #166534; }
                .status-badge.paused { background: #f1f5f9; color: #64748b; }
                .status-badge.mode-badge { background: #dbeafe; color: #1d4ed8; }

                .badge-row { display: flex; gap: 6px; flex-wrap: wrap; }

                .card-actions { display: flex; gap: 8px; }
                
                .card-actions button {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #e2e8f0;
                    background: white;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .card-actions button:hover { border-color: #94a3b8; color: #0f172a; }
                .card-actions button.delete:hover { border-color: #fecaca; color: #ef4444; background: #fef2f2; }

                .card-details {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    margin-bottom: 20px;
                }

                .detail-item { display: flex; flex-direction: column; gap: 4px; }
                .detail-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                
                .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
                .value { font-size: 0.9rem; font-family: monospace; color: #334155; }
                .value.url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .value.badged { 
                    display: flex; align-items: center; gap: 6px; 
                    font-family: inherit; text-transform: capitalize;
                }

                .last-run {
                    margin-top: auto;
                    padding-top: 12px;
                    border-top: 1px solid #f1f5f9;
                    font-size: 0.8rem;
                    color: #64748b;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .test-btn { width: 100%; border-color: #e2e8f0; }
                
                /* Modal */
                .modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;
                }
                
                .modal-content {
                    background: white; width: 100%; max-width: 500px;
                    border-radius: 20px; padding: 32px;
                    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2);
                }
                
                .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .modal-header h3 { margin: 0; font-size: 1.25rem; }
                .modal-header button { font-size: 1.5rem; color: #94a3b8; background: none; border: none; cursor: pointer; }
                
                .form-group { margin-bottom: 16px; }
                .form-group label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 6px; color: #475569; }
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                
                select { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; }
                
                .selectors-section { background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
                .selectors-section h4 { margin: 0 0 12px 0; font-size: 0.9rem; color: #64748b; }

                .mode-toggle { display: flex; gap: 8px; margin-bottom: 8px; }
                .mode-btn {
                    flex: 1;
                    padding: 10px 16px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: white;
                    color: #64748b;
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .mode-btn:hover { border-color: #94a3b8; }
                .mode-btn.active {
                    background: #0f172a;
                    color: white;
                    border-color: #0f172a;
                }
                .mode-hint {
                    display: block;
                    font-size: 0.75rem;
                    color: #94a3b8;
                    margin-top: 4px;
                }
                
                .modal-actions { display: flex; justify-content: flex-end; gap: 12px; }

                .loading-state { text-align: center; padding: 60px; color: #94a3b8; }
                .spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s infinite; margin: 0 auto 16px auto; }
                
                .empty-state {
                    text-align: center; padding: 60px; border: 2px dashed #e2e8f0; border-radius: 20px;
                    color: #94a3b8;
                }
                .empty-state h3 { color: #0f172a; margin: 16px 0 8px 0; }
                .empty-state p { margin-bottom: 24px; }

                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
                @keyframes spin { to { transform: rotate(360deg); } }

                @media (max-width: 768px) {
                    .header-main { flex-direction: column; align-items: flex-start; }
                    .header-actions { width: 100%; }
                    .header-actions button { flex: 1; }
                    .filters-row { flex-direction: column; }
                }
             `}</style>
        </MainLayout>
    );
}
