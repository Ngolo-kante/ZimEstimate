'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ScraperConfig } from '@/lib/database.types';
import {
    Plus,
    Trash,
    Play,
    Pause,
    CheckCircle,
    WarningCircle,
    Clock,
    Globe
} from '@phosphor-icons/react';

export default function ScraperPage() {
    const [configs, setConfigs] = useState<ScraperConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isTestRunning, setIsTestRunning] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        site_name: '',
        base_url: '',
        price_selector: '',
        item_name_selector: '',
        cron_schedule: 'weekly'
    });

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('scraper_configs')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setConfigs(data);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this scraper?')) return;
        const { error } = await supabase.from('scraper_configs').delete().eq('id', id);
        if (!error) fetchConfigs();
    };

    const handleToggleActive = async (config: ScraperConfig) => {
        const { error } = await supabase
            .from('scraper_configs')
            .update({ is_active: !config.is_active })
            .eq('id', config.id);
        if (!error) fetchConfigs();
    };

    const handleTestRun = async (config: ScraperConfig) => {
        setIsTestRunning(config.id);
        try {
            // Call the scraper API
            const response = await fetch('/api/scraper/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configId: config.id, url: config.base_url, priceSelector: config.price_selector, nameSelector: config.item_name_selector })
            });
            const result = await response.json();

            if (result.success) {
                // Update local state to show the green check immediately
                setConfigs(prev => prev.map(c =>
                    c.id === config.id
                        ? { ...c, last_successful_run_at: new Date().toISOString() }
                        : c
                ));

                const matchInfo = result.match.materialId
                    ? `✅ Matched: "${result.name}" (${(result.match.confidence * 100).toFixed(0)}% confidence)`
                    : `⚠️ Unmatched (Raw: "${result.name}")`;

                alert(`Success! Found Price: $${result.price}\n\n${matchInfo}\nMethod: ${result.match.method}`);
            } else {
                alert(`Failed: ${result.error}`);
            }
        } catch (e) {
            alert('Error running test scrape');
        } finally {
            setIsTestRunning(null);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('scraper_configs').insert([formData]);
        if (!error) {
            setShowModal(false);
            setFormData({
                site_name: '',
                base_url: '',
                price_selector: '',
                item_name_selector: '',
                cron_schedule: 'weekly'
            });
            fetchConfigs();
        } else {
            alert('Error creating scraper: ' + error.message);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans selection:bg-gray-800">
            <div className="max-w-6xl mx-auto">
                <header className="flex items-center justify-between mb-12 border-b border-gray-800 pb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Scraper Admin Hub</h1>
                        <p className="text-gray-400">Manage automated material price tracking pipelines.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded font-medium hover:bg-gray-200 transition-colors"
                    >
                        <Plus size={18} weight="bold" />
                        Add Scraper
                    </button>
                </header>

                {loading ? (
                    <div className="text-gray-500 animate-pulse">Loading configurations...</div>
                ) : configs.length === 0 ? (
                    <div className="border border-dashed border-gray-800 rounded-lg p-12 text-center">
                        <Globe size={48} className="mx-auto text-gray-700 mb-4" />
                        <h3 className="text-xl font-medium text-gray-300">No scrapers configured</h3>
                        <p className="text-gray-500 mt-2">Add a new target to start tracking prices.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {configs.map((config) => (
                            <div
                                key={config.id}
                                className={`border border-gray-800 bg-gray-900/50 rounded-lg p-6 hover:border-gray-700 transition-all ${!config.is_active ? 'opacity-60' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${config.is_active ? 'bg-green-500' : 'bg-gray-600'}`} />
                                        <h3 className="font-semibold text-lg">{config.site_name}</h3>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleToggleActive(config)}
                                            className="text-gray-500 hover:text-white transition-colors"
                                            title={config.is_active ? "Pause" : "Resume"}
                                        >
                                            {config.is_active ? <Pause size={18} /> : <Play size={18} />}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(config.id)}
                                            className="text-gray-500 hover:text-red-500 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div>
                                        <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Target URL</span>
                                        <p className="text-sm text-gray-300 truncate font-mono mt-1" title={config.base_url}>
                                            {config.base_url}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Item Selector</span>
                                            <code className="block text-xs bg-gray-950 p-1.5 rounded text-blue-400 font-mono mt-1 border border-gray-800">
                                                {config.item_name_selector}
                                            </code>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Price Selector</span>
                                            <code className="block text-xs bg-gray-950 p-1.5 rounded text-green-400 font-mono mt-1 border border-gray-800">
                                                {config.price_selector}
                                            </code>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <Clock size={14} />
                                            <span className="capitalize">{config.cron_schedule}</span>
                                        </div>
                                        {config.last_successful_run_at && (
                                            <div className="flex items-center gap-2 text-xs text-green-500" title="Last successful scrape">
                                                <CheckCircle size={14} weight="fill" />
                                                <span>{new Date(config.last_successful_run_at).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleTestRun(config)}
                                        disabled={isTestRunning === config.id}
                                        className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {isTestRunning === config.id ? (
                                            'Running...'
                                        ) : (
                                            <>
                                                <Play size={12} weight="fill" />
                                                Test Run
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg p-6 shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">New Scraper Configuration</h2>
                                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                                    &times;
                                </button>
                            </div>

                            <form onSubmit={handleCreate} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Site Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-black border border-gray-800 rounded p-2 text-sm focus:border-white focus:outline-none transition-colors"
                                            placeholder="e.g. Halsteds"
                                            value={formData.site_name}
                                            onChange={e => setFormData({ ...formData, site_name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Schedule</label>
                                        <select
                                            className="w-full bg-black border border-gray-800 rounded p-2 text-sm focus:border-white focus:outline-none transition-colors appearance-none"
                                            value={formData.cron_schedule}
                                            onChange={e => setFormData({ ...formData, cron_schedule: e.target.value })}
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Target URL</label>
                                    <input
                                        type="url"
                                        required
                                        className="w-full bg-black border border-gray-800 rounded p-2 text-sm font-mono focus:border-white focus:outline-none transition-colors"
                                        placeholder="https://..."
                                        value={formData.base_url}
                                        onChange={e => setFormData({ ...formData, base_url: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Item Title Selector</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-black border border-gray-800 rounded p-2 text-sm font-mono text-blue-400 focus:border-blue-500 focus:outline-none transition-colors"
                                            placeholder="h1.product-title"
                                            value={formData.item_name_selector}
                                            onChange={e => setFormData({ ...formData, item_name_selector: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Price Selector</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-black border border-gray-800 rounded p-2 text-sm font-mono text-green-400 focus:border-green-500 focus:outline-none transition-colors"
                                            placeholder=".price .amount"
                                            value={formData.price_selector}
                                            onChange={e => setFormData({ ...formData, price_selector: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="bg-white text-black px-4 py-2 rounded text-sm font-bold hover:bg-gray-200 transition-colors"
                                    >
                                        Create Scraper
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
