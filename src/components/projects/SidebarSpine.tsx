'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    House,
    CurrencyCircleDollar,
    ListChecks,
    ChartBar,
    Files,
    Gear,
    CaretDown,
    CaretRight,
    Buildings,
    Plus
} from '@phosphor-icons/react';
import { Project } from '@/lib/database.types';
import { getProjects } from '@/lib/services/projects';
import { useAuth } from '@/components/providers/AuthProvider';

export type ProjectView = 'overview' | 'budget' | 'boq' | 'tracking' | 'documents' | 'settings';

interface SidebarSpineProps {
    project: Project;
    activeView: ProjectView;
    onViewChange: (view: ProjectView) => void;
    currentProjectName?: string;
}

const navItems: { id: ProjectView; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <House size={20} /> },
    { id: 'budget', label: 'Budget Planner', icon: <CurrencyCircleDollar size={20} /> },
    { id: 'boq', label: 'Bill of Quantities', icon: <ListChecks size={20} /> },
    { id: 'tracking', label: 'Tracking & Timeline', icon: <ChartBar size={20} /> },
    { id: 'documents', label: 'Documents', icon: <Files size={20} /> },
    { id: 'settings', label: 'Configurations', icon: <Gear size={20} /> },
];

export default function SidebarSpine({ project, activeView, onViewChange }: SidebarSpineProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);

    useEffect(() => {
        if (isProjectMenuOpen && projects.length === 0) {
            loadProjects();
        }
    }, [isProjectMenuOpen]);

    async function loadProjects() {
        setIsLoadingProjects(true);
        const { projects, error } = await getProjects();
        if (projects) {
            setProjects(projects);
        }
        setIsLoadingProjects(false);
    }

    const handleProjectSelect = (projectId: string) => {
        router.push(`/projects/${projectId}`);
        setIsProjectMenuOpen(false);
    };

    return (
        <aside className="sidebar-spine">
            {/* Project Switcher */}
            <div className="project-switcher">
                <button
                    className="switcher-btn"
                    onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                >
                    <div className="project-icon">
                        <Buildings size={20} weight="duotone" />
                    </div>
                    <div className="project-info">
                        <span className="label">Active Project</span>
                        <span className="name">{project.name}</span>
                    </div>
                    <CaretDown size={14} className={`caret ${isProjectMenuOpen ? 'open' : ''}`} />
                </button>

                {/* Dropdown for Switcher */}
                {isProjectMenuOpen && (
                    <div className="switcher-dropdown">
                        {isLoadingProjects ? (
                            <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                        ) : (
                            <>
                                {projects.map((p) => (
                                    <div
                                        key={p.id}
                                        className={`dropdown-item ${p.id === project.id ? 'active' : ''}`}
                                        onClick={() => handleProjectSelect(p.id)}
                                    >
                                        <Buildings size={16} />
                                        <span className="truncate">{p.name}</span>
                                    </div>
                                ))}

                                {projects.length === 0 && (
                                    <div className="p-2 text-center text-slate-400 text-xs">No other projects found</div>
                                )}
                            </>
                        )}

                        <div className="dropdown-divider"></div>

                        <Link href="/projects" className="dropdown-item view-all" onClick={() => setIsProjectMenuOpen(false)}>
                            View All Projects
                        </Link>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="spine-nav">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onViewChange(item.id)}
                        className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                        {activeView === item.id && <div className="active-indicator" />}
                    </button>
                ))}
            </nav>

            <style jsx>{`
                .sidebar-spine {
                    width: 280px;
                    height: calc(100vh - 64px); /* Subtract top navbar height */
                    background: #ffffff;
                    border-right: 1px solid var(--color-border-light);
                    display: flex;
                    flex-direction: column;
                    flex-shrink: 0;
                    position: sticky;
                    top: 64px;
                }

                .project-switcher {
                    padding: 20px 16px;
                    border-bottom: 1px solid var(--color-border-light);
                    position: relative;
                }

                .switcher-btn {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 100%;
                    background: var(--color-background);
                    border: 1px solid var(--color-border-light);
                    padding: 10px 12px;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: left;
                }

                .switcher-btn:hover {
                    border-color: var(--color-primary);
                    background: white;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }

                .project-icon {
                    width: 32px;
                    height: 32px;
                    background: rgba(78, 154, 247, 0.1);
                    color: var(--color-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                }

                .project-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .label {
                    font-size: 0.65rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-secondary);
                    font-weight: 600;
                    margin-bottom: 2px;
                }

                .name {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-text);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .caret {
                    color: var(--color-text-secondary);
                    transition: transform 0.2s;
                }

                .caret.open {
                    transform: rotate(180deg);
                }

                .switcher-dropdown {
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 16px;
                    right: 16px;
                    background: white;
                    border: 1px solid var(--color-border-light);
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    z-index: 50;
                    padding: 4px;
                    max-height: 300px;
                    overflow-y: auto;
                }

                .dropdown-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.1s;
                    text-decoration: none;
                }

                .dropdown-item:hover {
                    background: var(--color-background);
                    color: var(--color-text);
                }

                .dropdown-item.active {
                    background: rgba(78, 154, 247, 0.08);
                    color: var(--color-primary);
                    font-weight: 500;
                }

                .dropdown-divider {
                    height: 1px;
                    background: var(--color-border-light);
                    margin: 4px 8px;
                }

                .dropdown-item.view-all {
                    justify-content: center;
                    color: var(--color-primary);
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .spine-nav {
                    flex: 1;
                    padding: 24px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    overflow-y: auto;
                }

                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    border-radius: 10px;
                    background: transparent;
                    border: none;
                    text-align: left;
                    cursor: pointer;
                    color: var(--color-text-secondary);
                    transition: all 0.2s ease;
                    position: relative;
                }

                .nav-item:hover {
                    background: var(--color-background);
                    color: var(--color-text);
                }

                .nav-item.active {
                    background: rgba(78, 154, 247, 0.08);
                    color: var(--color-primary);
                    font-weight: 600;
                }

                .nav-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .nav-label {
                    flex: 1;
                    font-size: 0.9rem;
                }
                
                .active-indicator {
                    position: absolute;
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 3px;
                    height: 16px;
                    background: var(--color-primary);
                    border-radius: 0 4px 4px 0;
                }

                @media (max-width: 1024px) {
                    .sidebar-spine {
                        width: 240px;
                    }
                }
            `}</style>
        </aside>
    );
}
