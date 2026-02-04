'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardHeader, CardTitle, CardContent, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressRing, { ProgressBar } from '@/components/ui/ProgressRing';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { Project } from '@/lib/database.types';
import {
    getProjectsGroupedByStatus,
    getAggregatedBudgetStats,
    getAllReminders,
    getProjectPurchaseStats,
    createReminder,
    deleteReminder,
} from '@/lib/services/projects';
import {
    Plus,
    FileArrowUp,
    PencilSimple,
    Cube,
    Wall,
    HouseSimple,
    PaintBrush,
    ShieldCheck,
    Crown,
    CaretDown,
    CaretRight,
    CalendarBlank,
    Bell,
    TrendUp,
    TrendDown,
    Minus,
    MapPin,
    Clock,
    Trash,
} from '@phosphor-icons/react';

type ReminderType = 'material' | 'savings' | 'deadline';

interface Reminder {
    id: string;
    project_id: string;
    project_name?: string;
    reminder_type: string;
    message: string;
    scheduled_date: string;
    is_sent: boolean;
}

interface ProjectWithStats extends Project {
    purchaseStats?: {
        totalItems: number;
        purchasedItems: number;
        estimatedTotal: number;
        actualSpent: number;
    };
}

const milestoneIcons = {
    substructure: Cube,
    superstructure: Wall,
    roofing: HouseSimple,
    finishing: PaintBrush,
    exterior: ShieldCheck,
};

const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'rgba(16, 185, 129, 0.1)', text: 'var(--color-success)' },
    draft: { bg: 'rgba(78, 154, 247, 0.15)', text: 'var(--color-accent)' },
    completed: { bg: 'rgba(6, 20, 47, 0.1)', text: 'var(--color-primary)' },
};

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
    const { formatPrice } = useCurrency();
    return <>{formatPrice(priceUsd, priceZwg)}</>;
}

function DashboardContent() {
    const router = useRouter();
    const { profile, projectCount, canCreateProject } = useAuth();

    // Data states
    const [projectsByStatus, setProjectsByStatus] = useState<{
        active: ProjectWithStats[];
        draft: ProjectWithStats[];
        completed: ProjectWithStats[];
    }>({ active: [], draft: [], completed: [] });
    const [budgetStats, setBudgetStats] = useState({
        totalBudget: 0,
        totalSpent: 0,
        variance: 0,
        projectCount: 0,
    });
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);

    // UI states
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        active: true,
        draft: false,
        completed: false,
    });
    const [showReminderForm, setShowReminderForm] = useState(false);
    const [newReminder, setNewReminder] = useState({
        project_id: '',
        reminder_type: 'deadline' as ReminderType,
        message: '',
        scheduled_date: '',
    });

    const tierColors: Record<string, string> = {
        free: 'var(--color-text-secondary)',
        pro: 'var(--color-accent)',
        admin: 'var(--color-primary)',
    };

    // Fetch all data on mount
    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [projectsResult, budgetResult, remindersResult] = await Promise.all([
                    getProjectsGroupedByStatus(),
                    getAggregatedBudgetStats(),
                    getAllReminders(),
                ]);

                // Fetch purchase stats for each project
                const projectsWithStats = { ...projectsResult };
                for (const status of ['active', 'draft', 'completed'] as const) {
                    if (!projectsResult.error) {
                        projectsWithStats[status] = await Promise.all(
                            projectsResult[status].map(async (project) => {
                                const stats = await getProjectPurchaseStats(project.id);
                                return { ...project, purchaseStats: stats };
                            })
                        );
                    }
                }

                if (!projectsResult.error) setProjectsByStatus(projectsWithStats);
                if (!budgetResult.error) setBudgetStats(budgetResult);
                if (!remindersResult.error) setReminders(remindersResult.reminders);
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleCreateReminder = async () => {
        if (!newReminder.project_id || !newReminder.message || !newReminder.scheduled_date) return;

        const { error } = await createReminder({
            project_id: newReminder.project_id,
            reminder_type: newReminder.reminder_type,
            message: newReminder.message,
            scheduled_date: newReminder.scheduled_date,
            phone_number: profile?.phone_number || '',
        });

        if (!error) {
            const { reminders: updated } = await getAllReminders();
            setReminders(updated);
            setShowReminderForm(false);
            setNewReminder({ project_id: '', reminder_type: 'deadline', message: '', scheduled_date: '' });
        }
    };

    const handleDeleteReminder = async (id: string) => {
        await deleteReminder(id);
        setReminders(prev => prev.filter(r => r.id !== id));
    };

    const allProjects = [...projectsByStatus.active, ...projectsByStatus.draft, ...projectsByStatus.completed];
    const overallProgress = budgetStats.totalBudget > 0
        ? Math.round((budgetStats.totalSpent / budgetStats.totalBudget) * 100)
        : 0;

    const upcomingDeadlines = allProjects
        .filter(p => p.target_date && new Date(p.target_date) > new Date())
        .sort((a, b) => new Date(a.target_date!).getTime() - new Date(b.target_date!).getTime())
        .slice(0, 3);

    if (loading) {
        return (
            <MainLayout title="Dashboard">
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading your dashboard...</p>
                </div>
                <style jsx>{`
                    .loading-state {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 400px;
                        gap: var(--spacing-md);
                    }
                    .spinner {
                        width: 40px;
                        height: 40px;
                        border: 3px solid var(--color-border);
                        border-top-color: var(--color-accent);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Dashboard">
            <div className="dashboard">
                {/* Welcome Section */}
                <section className="welcome-section">
                    <div className="welcome-text">
                        <h2>Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!</h2>
                        <p>Track your construction projects and manage estimates.</p>
                        <div className="user-tier">
                            <Crown size={14} weight="fill" style={{ color: tierColors[profile?.tier || 'free'] }} />
                            <span style={{ color: tierColors[profile?.tier || 'free'] }}>
                                {profile?.tier?.charAt(0).toUpperCase()}{profile?.tier?.slice(1)} Plan
                            </span>
                            {profile?.tier === 'free' && (
                                <span className="project-count">({projectCount}/3 projects)</span>
                            )}
                        </div>
                    </div>
                    <Link href="/boq/new">
                        <Button
                            icon={<Plus size={18} weight="bold" />}
                            disabled={!canCreateProject()}
                            title={!canCreateProject() ? 'Project limit reached. Upgrade to Pro.' : ''}
                        >
                            New Project
                        </Button>
                    </Link>
                </section>

                {/* Stats Grid - All Clickable */}
                <section className="stats-grid">
                    <Card variant="dashboard" onClick={() => router.push('/projects')}>
                        <CardHeader>
                            <CardTitle>Total Budget</CardTitle>
                            <CardBadge variant="accent">{budgetStats.projectCount} Projects</CardBadge>
                        </CardHeader>
                        <CardContent>
                            <p className="stat-value">
                                <PriceDisplay priceUsd={budgetStats.totalBudget} priceZwg={budgetStats.totalBudget * 30} />
                            </p>
                            <p className="stat-label">Across all active projects</p>
                        </CardContent>
                    </Card>

                    <Card variant="dashboard" onClick={() => router.push('/projects?view=tracking')}>
                        <CardHeader>
                            <CardTitle>Spent to Date</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="stat-value">
                                <PriceDisplay priceUsd={budgetStats.totalSpent} priceZwg={budgetStats.totalSpent * 30} />
                            </p>
                            <ProgressBar progress={overallProgress} />
                        </CardContent>
                    </Card>

                    <Card variant="dashboard" onClick={() => router.push('/projects?status=active')}>
                        <CardHeader>
                            <CardTitle>Overall Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="progress-display">
                                <ProgressRing progress={overallProgress} size={80} />
                                <div className="progress-meta">
                                    <span className="progress-label">Complete</span>
                                    <span className="progress-detail">
                                        {projectsByStatus.completed.length} of {allProjects.length} projects
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Actual vs Budget Section */}
                <section className="budget-section">
                    <h3 className="section-title">Actual vs. Budget</h3>
                    <div className="budget-cards">
                        <Card variant="dashboard" onClick={() => router.push('/projects?view=tracking')}>
                            <div className="budget-metric">
                                <div className="metric-icon estimated">
                                    <CalendarBlank size={20} weight="light" />
                                </div>
                                <div className="metric-details">
                                    <span className="metric-label">Estimated</span>
                                    <span className="metric-value">
                                        <PriceDisplay priceUsd={budgetStats.totalBudget} priceZwg={budgetStats.totalBudget * 30} />
                                    </span>
                                </div>
                            </div>
                        </Card>

                        <Card variant="dashboard" onClick={() => router.push('/projects?view=tracking')}>
                            <div className="budget-metric">
                                <div className="metric-icon actual">
                                    <TrendUp size={20} weight="light" />
                                </div>
                                <div className="metric-details">
                                    <span className="metric-label">Actual Spent</span>
                                    <span className="metric-value">
                                        <PriceDisplay priceUsd={budgetStats.totalSpent} priceZwg={budgetStats.totalSpent * 30} />
                                    </span>
                                </div>
                            </div>
                        </Card>

                        <Card variant="dashboard" onClick={() => router.push('/projects?view=tracking')}>
                            <div className="budget-metric">
                                <div className={`metric-icon ${budgetStats.variance >= 0 ? 'positive' : 'negative'}`}>
                                    {budgetStats.variance > 0 ? <TrendDown size={20} /> :
                                     budgetStats.variance < 0 ? <TrendUp size={20} /> :
                                     <Minus size={20} />}
                                </div>
                                <div className="metric-details">
                                    <span className="metric-label">Variance</span>
                                    <span className={`metric-value ${budgetStats.variance >= 0 ? 'positive' : 'negative'}`}>
                                        {budgetStats.variance >= 0 ? 'Under ' : 'Over '}
                                        <PriceDisplay
                                            priceUsd={Math.abs(budgetStats.variance)}
                                            priceZwg={Math.abs(budgetStats.variance) * 30}
                                        />
                                    </span>
                                </div>
                            </div>
                        </Card>
                    </div>
                    <p className="budget-hint">
                        Click on any project below to enter actual prices and quantities for model training.
                    </p>
                </section>

                {/* Project Hierarchy by Status */}
                <section className="projects-section">
                    <h3 className="section-title">Your Projects</h3>

                    {allProjects.length === 0 ? (
                        <Card variant="dashboard">
                            <div className="empty-state">
                                <HouseSimple size={48} weight="light" />
                                <p>No projects yet. Create your first project to get started!</p>
                                <Link href="/boq/new">
                                    <Button icon={<Plus size={16} />}>Create Project</Button>
                                </Link>
                            </div>
                        </Card>
                    ) : (
                        <div className="project-groups">
                            {(['active', 'draft', 'completed'] as const).map((status) => {
                                const projects = projectsByStatus[status];
                                if (projects.length === 0) return null;

                                return (
                                    <div key={status} className="project-group">
                                        <button
                                            className="group-header"
                                            onClick={() => toggleSection(status)}
                                        >
                                            <div className="group-title">
                                                {expandedSections[status] ? (
                                                    <CaretDown size={18} />
                                                ) : (
                                                    <CaretRight size={18} />
                                                )}
                                                <span className="status-label" style={{
                                                    background: statusColors[status].bg,
                                                    color: statusColors[status].text,
                                                }}>
                                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                                </span>
                                                <span className="group-count">{projects.length}</span>
                                            </div>
                                        </button>

                                        {expandedSections[status] && (
                                            <div className="project-list">
                                                {projects.map((project) => (
                                                    <Card
                                                        key={project.id}
                                                        variant="dashboard"
                                                        onClick={() => router.push(`/projects/${project.id}`)}
                                                    >
                                                        <div className="project-card">
                                                            <div className="project-header">
                                                                <h4>{project.name}</h4>
                                                                {project.location && (
                                                                    <span className="project-location">
                                                                        <MapPin size={12} />
                                                                        {project.location}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="project-stats">
                                                                <div className="stat">
                                                                    <span className="stat-label">Budget</span>
                                                                    <span className="stat-value">
                                                                        <PriceDisplay
                                                                            priceUsd={project.purchaseStats?.estimatedTotal || project.total_usd}
                                                                            priceZwg={(project.purchaseStats?.estimatedTotal || project.total_usd) * 30}
                                                                        />
                                                                    </span>
                                                                </div>
                                                                <div className="stat">
                                                                    <span className="stat-label">Spent</span>
                                                                    <span className="stat-value">
                                                                        <PriceDisplay
                                                                            priceUsd={project.purchaseStats?.actualSpent || 0}
                                                                            priceZwg={(project.purchaseStats?.actualSpent || 0) * 30}
                                                                        />
                                                                    </span>
                                                                </div>
                                                                <div className="stat">
                                                                    <span className="stat-label">Items</span>
                                                                    <span className="stat-value">
                                                                        {project.purchaseStats?.purchasedItems || 0}/{project.purchaseStats?.totalItems || 0}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {project.purchaseStats && project.purchaseStats.totalItems > 0 && (
                                                                <ProgressBar
                                                                    progress={(project.purchaseStats.purchasedItems / project.purchaseStats.totalItems) * 100}
                                                                    showLabel
                                                                />
                                                            )}
                                                        </div>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Planning & Reminders Section */}
                <section className="planning-section">
                    <div className="section-header">
                        <h3 className="section-title">Planning & Reminders</h3>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={<Plus size={14} />}
                            onClick={() => setShowReminderForm(!showReminderForm)}
                        >
                            Add Reminder
                        </Button>
                    </div>

                    {showReminderForm && (
                        <Card variant="dashboard" className="reminder-form">
                            <div className="form-row">
                                <select
                                    value={newReminder.project_id}
                                    onChange={(e) => setNewReminder(prev => ({ ...prev, project_id: e.target.value }))}
                                >
                                    <option value="">Select Project</option>
                                    {allProjects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <select
                                    value={newReminder.reminder_type}
                                    onChange={(e) => setNewReminder(prev => ({ ...prev, reminder_type: e.target.value as ReminderType }))}
                                >
                                    <option value="deadline">Deadline</option>
                                    <option value="material">Material Purchase</option>
                                    <option value="savings">Savings Goal</option>
                                </select>
                            </div>
                            <input
                                type="text"
                                placeholder="Reminder message"
                                value={newReminder.message}
                                onChange={(e) => setNewReminder(prev => ({ ...prev, message: e.target.value }))}
                            />
                            <div className="form-row">
                                <input
                                    type="date"
                                    value={newReminder.scheduled_date}
                                    onChange={(e) => setNewReminder(prev => ({ ...prev, scheduled_date: e.target.value }))}
                                />
                                <Button onClick={handleCreateReminder}>Save</Button>
                            </div>
                        </Card>
                    )}

                    <div className="planning-grid">
                        {/* Upcoming Deadlines */}
                        <Card variant="dashboard" onClick={() => router.push('/projects')}>
                            <CardHeader>
                                <CardTitle>Upcoming Deadlines</CardTitle>
                                <CalendarBlank size={20} />
                            </CardHeader>
                            <CardContent>
                                {upcomingDeadlines.length === 0 ? (
                                    <p className="empty-text">No upcoming deadlines</p>
                                ) : (
                                    <ul className="deadline-list">
                                        {upcomingDeadlines.map(project => {
                                            const daysLeft = Math.ceil(
                                                (new Date(project.target_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                                            );
                                            return (
                                                <li key={project.id} className="deadline-item">
                                                    <span className="deadline-name">{project.name}</span>
                                                    <span className={`deadline-days ${daysLeft <= 7 ? 'urgent' : ''}`}>
                                                        {daysLeft} days
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>

                        {/* Reminders */}
                        <Card variant="dashboard">
                            <CardHeader>
                                <CardTitle>Reminders</CardTitle>
                                <Bell size={20} />
                            </CardHeader>
                            <CardContent>
                                {reminders.length === 0 ? (
                                    <p className="empty-text">No active reminders</p>
                                ) : (
                                    <ul className="reminder-list">
                                        {reminders.slice(0, 5).map(reminder => (
                                            <li key={reminder.id} className="reminder-item">
                                                <div className="reminder-content">
                                                    <span className="reminder-type">
                                                        {reminder.reminder_type === 'deadline' && <Clock size={14} />}
                                                        {reminder.reminder_type === 'material' && <Cube size={14} />}
                                                        {reminder.reminder_type === 'savings' && <TrendUp size={14} />}
                                                    </span>
                                                    <div className="reminder-details">
                                                        <span className="reminder-message">{reminder.message}</span>
                                                        <span className="reminder-meta">
                                                            {reminder.project_name} · {new Date(reminder.scheduled_date).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    className="delete-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteReminder(reminder.id);
                                                    }}
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>

                {/* BOQ Builder Selection */}
                <section className="boq-section">
                    <h3 className="section-title">Smart BOQ Builder</h3>
                    <p className="section-subtitle">Choose how you want to create your Bill of Quantities</p>

                    <div className="boq-options">
                        <Card variant="choice" onClick={() => router.push('/ai/vision-takeoff')}>
                            <div className="choice-icon">
                                <FileArrowUp size={40} weight="light" />
                            </div>
                            <h4>Upload Floor Plan</h4>
                            <p>AI analyzes your blueprint</p>
                            <CardBadge variant="success">Best for Accuracy</CardBadge>
                        </Card>

                        <Card variant="choice" onClick={() => router.push('/boq/new')}>
                            <div className="choice-icon">
                                <PencilSimple size={40} weight="light" />
                            </div>
                            <h4>Manual Entry</h4>
                            <p>Build BOQ step by step</p>
                        </Card>
                    </div>
                </section>
            </div>

            <style jsx>{`
                .dashboard {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-xl);
                }

                .welcome-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .welcome-text h2 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0 0 0.25rem 0;
                }

                .welcome-text p {
                    color: var(--color-text-secondary);
                    margin: 0;
                }

                .user-tier {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    margin-top: var(--spacing-xs);
                    font-size: 0.75rem;
                    font-weight: 500;
                }

                .project-count {
                    color: var(--color-text-muted);
                    font-weight: 400;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: var(--spacing-lg);
                }

                .stat-value {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--color-text);
                    margin: 0 0 var(--spacing-xs) 0;
                }

                .stat-label {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                    margin: 0;
                }

                .progress-display {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-lg);
                }

                .progress-meta {
                    display: flex;
                    flex-direction: column;
                }

                .progress-meta .progress-label {
                    font-size: 1rem;
                    font-weight: 500;
                    color: var(--color-text);
                }

                .progress-meta .progress-detail {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                }

                /* Budget Section */
                .budget-section {
                    margin-top: var(--spacing-md);
                }

                .budget-cards {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: var(--spacing-md);
                    margin-top: var(--spacing-md);
                }

                .budget-metric {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                }

                .metric-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .metric-icon.estimated {
                    background: rgba(78, 154, 247, 0.15);
                    color: var(--color-accent);
                }

                .metric-icon.actual {
                    background: rgba(6, 20, 47, 0.1);
                    color: var(--color-primary);
                }

                .metric-icon.positive {
                    background: rgba(16, 185, 129, 0.1);
                    color: var(--color-success);
                }

                .metric-icon.negative {
                    background: rgba(239, 68, 68, 0.1);
                    color: var(--color-error);
                }

                .metric-details {
                    display: flex;
                    flex-direction: column;
                }

                .metric-label {
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .metric-value {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--color-text);
                }

                .metric-value.positive {
                    color: var(--color-success);
                }

                .metric-value.negative {
                    color: var(--color-error);
                }

                .budget-hint {
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                    margin-top: var(--spacing-sm);
                    font-style: italic;
                }

                /* Projects Section */
                .projects-section {
                    margin-top: var(--spacing-md);
                }

                .section-title {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0 0 var(--spacing-md) 0;
                }

                .section-subtitle {
                    color: var(--color-text-secondary);
                    margin: 0 0 var(--spacing-lg) 0;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-md);
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: var(--spacing-xl);
                    gap: var(--spacing-md);
                    color: var(--color-text-secondary);
                    text-align: center;
                }

                .project-groups {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .project-group {
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                }

                .group-header {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    padding: var(--spacing-md);
                    background: var(--color-surface);
                    border: none;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .group-header:hover {
                    background: var(--color-background);
                }

                .group-title {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    color: var(--color-text);
                }

                .status-label {
                    padding: 0.25rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 500;
                }

                .group-count {
                    color: var(--color-text-secondary);
                    font-size: 0.875rem;
                }

                .project-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm);
                    background: var(--color-background);
                }

                .project-card {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .project-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .project-header h4 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--color-text);
                }

                .project-location {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                }

                .project-stats {
                    display: flex;
                    gap: var(--spacing-lg);
                }

                .project-stats .stat {
                    display: flex;
                    flex-direction: column;
                }

                .project-stats .stat-label {
                    font-size: 0.625rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-secondary);
                }

                .project-stats .stat-value {
                    font-size: 0.875rem;
                    font-weight: 600;
                    margin: 0;
                }

                /* Planning Section */
                .planning-section {
                    margin-top: var(--spacing-md);
                }

                .planning-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: var(--spacing-lg);
                }

                .reminder-form {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    margin-bottom: var(--spacing-md);
                }

                .reminder-form .form-row {
                    display: flex;
                    gap: var(--spacing-sm);
                }

                .reminder-form select,
                .reminder-form input {
                    flex: 1;
                    padding: var(--spacing-sm);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    background: var(--color-surface);
                }

                .deadline-list,
                .reminder-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .deadline-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing-xs) 0;
                    border-bottom: 1px solid var(--color-border-light);
                }

                .deadline-item:last-child {
                    border-bottom: none;
                }

                .deadline-name {
                    font-size: 0.875rem;
                    color: var(--color-text);
                }

                .deadline-days {
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--color-text-secondary);
                    padding: 0.125rem 0.5rem;
                    background: var(--color-background);
                    border-radius: 9999px;
                }

                .deadline-days.urgent {
                    background: rgba(239, 68, 68, 0.1);
                    color: var(--color-error);
                }

                .reminder-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding: var(--spacing-xs) 0;
                    border-bottom: 1px solid var(--color-border-light);
                }

                .reminder-item:last-child {
                    border-bottom: none;
                }

                .reminder-content {
                    display: flex;
                    gap: var(--spacing-sm);
                    flex: 1;
                }

                .reminder-type {
                    color: var(--color-accent);
                }

                .reminder-details {
                    display: flex;
                    flex-direction: column;
                    gap: 0.125rem;
                }

                .reminder-message {
                    font-size: 0.875rem;
                    color: var(--color-text);
                }

                .reminder-meta {
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                }

                .delete-btn {
                    background: none;
                    border: none;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    padding: var(--spacing-xs);
                    border-radius: var(--radius-sm);
                    transition: all 0.2s;
                }

                .delete-btn:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: var(--color-error);
                }

                .empty-text {
                    color: var(--color-text-secondary);
                    font-size: 0.875rem;
                    text-align: center;
                    padding: var(--spacing-md);
                }

                /* BOQ Section */
                .boq-section {
                    margin-top: var(--spacing-md);
                }

                .boq-options {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: var(--spacing-lg);
                    max-width: 600px;
                }

                .choice-icon {
                    width: 72px;
                    height: 72px;
                    border-radius: 50%;
                    background: var(--color-background);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-accent);
                    margin-bottom: var(--spacing-sm);
                }

                .boq-options h4 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0 0 var(--spacing-xs) 0;
                }

                .boq-options p {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                    margin: 0 0 var(--spacing-sm) 0;
                }

                @media (max-width: 1200px) {
                    .stats-grid,
                    .budget-cards {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 768px) {
                    .stats-grid,
                    .budget-cards,
                    .planning-grid,
                    .boq-options {
                        grid-template-columns: 1fr;
                    }

                    .welcome-section {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: var(--spacing-md);
                    }

                    .project-stats {
                        flex-wrap: wrap;
                    }
                }
            `}</style>
        </MainLayout>
    );
}

export default function Dashboard() {
    return (
        <ProtectedRoute>
            <DashboardContent />
        </ProtectedRoute>
    );
}
