'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    House,
    CurrencyCircleDollar,
    ListChecks,
    Clipboard,
    Truck,
    Files,
    Gear,
    CaretDown,
    Buildings,
} from '@phosphor-icons/react';
import { Project } from '@/lib/database.types';
import { getProjects } from '@/lib/services/projects';

export type ProjectView = 'overview' | 'budget' | 'boq' | 'procurement' | 'usage' | 'documents' | 'settings';

interface SidebarSpineProps {
    project: Project;
    activeView: ProjectView;
    onViewChange: (view: ProjectView) => void;
    currentProjectName?: string;
    isMobileOpen?: boolean;
    onMobileClose?: () => void;
}

const navItems: { id: ProjectView; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <House size={20} /> },
    { id: 'budget', label: 'Budget Planner', icon: <CurrencyCircleDollar size={20} /> },
    { id: 'boq', label: 'Bill of Quantities', icon: <ListChecks size={20} /> },
    { id: 'procurement', label: 'Procurement Hub', icon: <Truck size={20} /> },
    { id: 'usage', label: 'Usage Tracking', icon: <Clipboard size={20} /> },
    { id: 'documents', label: 'Documents', icon: <Files size={20} /> },
    { id: 'settings', label: 'Configurations', icon: <Gear size={20} /> },
];

export default function SidebarSpine({ project, activeView, onViewChange, isMobileOpen, onMobileClose }: SidebarSpineProps) {
    const router = useRouter();
    const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Initialize collapse state from local storage on mount
    useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebar_collapsed');
            if (saved) setIsCollapsed(saved === 'true');
        }
    });

    const toggleCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem('sidebar_collapsed', String(newState));
        if (newState) setIsProjectMenuOpen(false); // Close menu if collapsing
    };

    const loadProjects = async () => {
        setIsLoadingProjects(true);
        const { projects } = await getProjects();
        if (projects) {
            setProjects(projects);
        }
        setIsLoadingProjects(false);
    };

    const handleToggleMenu = () => {
        if (isCollapsed) {
            toggleCollapse(); // Expand if clicking switcher while collapsed
            return;
        }
        const nextOpen = !isProjectMenuOpen;
        setIsProjectMenuOpen(nextOpen);
        if (nextOpen && projects.length === 0) {
            void loadProjects();
        }
    };

    const handleProjectSelect = (projectId: string) => {
        router.push(`/projects/${projectId}`);
        setIsProjectMenuOpen(false);
    };

    return (
        <>
            {isMobileOpen && <div className="sidebar-backdrop" onClick={onMobileClose} />}
            <aside className={`sidebar-spine${isMobileOpen ? ' mobile-open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
                {/* Project Switcher */}
                <div className="project-switcher">
                    <button
                        className="switcher-btn"
                        onClick={handleToggleMenu}
                        title={isCollapsed ? project.name : undefined}
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
                    {isProjectMenuOpen && !isCollapsed && (
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
                            onClick={() => {
                                onViewChange(item.id);
                                onMobileClose?.();
                            }}
                            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                            {activeView === item.id && <div className="active-indicator" />}
                        </button>
                    ))}
                </nav>

                {/* Collapse Toggle (Desktop only) */}
                <button
                    className="collapse-toggle"
                    onClick={toggleCollapse}
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    <CaretDown size={16} className={`toggle-icon ${isCollapsed ? 'collapsed' : ''}`} />
                </button>

                <style jsx>{`
                    .sidebar-spine {
                        width: 272px;
                        height: calc(100vh - 64px);
                        background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(246, 250, 255, 0.9));
                        backdrop-filter: blur(16px);
                        -webkit-backdrop-filter: blur(16px);
                        border-right: 1px solid rgba(211, 211, 215, 0.75);
                        display: flex;
                        flex-direction: column;
                        flex-shrink: 0;
                        position: sticky;
                        top: 64px;
                        z-index: 40;
                        box-shadow: 18px 0 30px rgba(6, 20, 47, 0.035);
                        transition: width 0.3s cubic-bezier(0.2, 0, 0, 1);
                    }

                    .sidebar-spine.collapsed {
                        width: 84px;
                    }

                    .project-switcher {
                        padding: 22px 16px 18px;
                        position: relative;
                    }

                    .sidebar-spine.collapsed .project-switcher {
                        padding: 22px 10px 18px;
                    }

                    .switcher-btn {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        width: 100%;
                        background: rgba(255, 255, 255, 0.9);
                        border: 1px solid #d4e6ff;
                        padding: 12px;
                        border-radius: 14px;
                        cursor: pointer;
                        transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
                        text-align: left;
                        box-shadow: 0 8px 18px rgba(6, 20, 47, 0.04);
                        overflow: hidden;
                        white-space: nowrap;
                        font-family: var(--font-body);
                    }

                    .sidebar-spine.collapsed .switcher-btn {
                        justify-content: center;
                        padding: 12px 0;
                        gap: 0;
                    }

                    .switcher-btn:hover {
                        border-color: #a7ccf9;
                        box-shadow: 0 10px 22px rgba(31, 96, 174, 0.14);
                        transform: translateY(-1px);
                    }

                    .switcher-btn:focus-visible {
                        outline: none;
                        box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.25);
                    }

                    .project-icon {
                        width: 40px;
                        height: 40px;
                        background: linear-gradient(135deg, #ecf4ff, #d6e8ff);
                        color: #19508a;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 10px;
                        flex-shrink: 0;
                    }

                    .project-info {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        transition: opacity 0.2s, max-width 0.2s;
                    }

                    .sidebar-spine.collapsed .project-info {
                        opacity: 0;
                        max-width: 0;
                        margin: 0;
                    }

                    .label {
                        font-size: 0.68rem;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: #7689a5;
                        font-weight: 600;
                        margin-bottom: 2px;
                    }

                    .name {
                        font-size: 0.92rem;
                        font-weight: 600;
                        color: #0f294b;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .caret {
                        color: #7891b5;
                        transition: transform 0.2s, opacity 0.2s;
                        flex-shrink: 0;
                    }

                    .sidebar-spine.collapsed .caret {
                        opacity: 0;
                        width: 0;
                    }

                    .caret.open {
                        transform: rotate(180deg);
                    }

                    .switcher-dropdown {
                        position: absolute;
                        top: calc(100% - 10px);
                        left: 16px;
                        right: 16px;
                        background: white;
                        border: 1px solid #d3e4f8;
                        border-radius: 14px;
                        box-shadow: 0 18px 36px rgba(15, 52, 94, 0.12);
                        z-index: 50;
                        padding: 6px;
                        max-height: 300px;
                        overflow-y: auto;
                        animation: slideDown 0.2s ease-out forwards;
                    }

                    @keyframes slideDown {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }

                    .dropdown-item {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 10px 12px;
                        font-size: 0.9rem;
                        color: #516b8e;
                        border-radius: 10px;
                        cursor: pointer;
                        transition: all 0.2s;
                        text-decoration: none;
                    }

                    .dropdown-item:hover {
                        background: #eff6ff;
                        color: #173f6a;
                        transform: translateX(2px);
                    }

                    .dropdown-item:focus-visible {
                        outline: none;
                        box-shadow: inset 0 0 0 2px rgba(78, 154, 247, 0.22);
                    }

                    .dropdown-item.active {
                        background: #e7f2ff;
                        color: #17467a;
                        font-weight: 600;
                    }

                    .dropdown-divider {
                        height: 1px;
                        background: var(--color-border-light);
                        margin: 6px 12px;
                    }

                    .dropdown-item.view-all {
                        justify-content: center;
                        color: #225f9b;
                        font-size: 0.85rem;
                        font-weight: 600;
                    }

                    .spine-nav {
                        flex: 1;
                        padding: 0 14px 20px;
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        overflow-y: auto;
                        overflow-x: hidden;
                    }
                    
                    .sidebar-spine.collapsed .spine-nav {
                        padding: 0 10px 20px;
                    }

                    .nav-item {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 11px 14px;
                        border-radius: 12px;
                        background: rgba(255, 255, 255, 0.55);
                        border: none;
                        text-align: left;
                        cursor: pointer;
                        color: #5a6f8d;
                        transition: all 0.2s ease;
                        position: relative;
                        font-weight: 500;
                        white-space: nowrap;
                    }

                    .sidebar-spine.collapsed .nav-item {
                        justify-content: center;
                        padding: 12px 0;
                        gap: 0;
                    }

                    .nav-item:hover {
                        background: #edf6ff;
                        color: #164d83;
                        transform: translateX(2px);
                    }

                    .nav-item.active {
                        background: linear-gradient(135deg, #e9f4ff, #f3f9ff);
                        color: #164d83;
                        font-weight: 600;
                        box-shadow: 0 10px 18px rgba(22, 77, 131, 0.14);
                    }

                    .nav-item:focus-visible {
                        outline: none;
                        box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.25);
                    }

                    .nav-icon {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: transform 0.2s;
                        flex-shrink: 0;
                    }
                    
                    .nav-item:hover .nav-icon {
                        transform: scale(1.1);
                    }
                    
                    .nav-item.active .nav-icon {
                        transform: scale(1.1);
                    }

                    .nav-label {
                        flex: 1;
                        font-size: 0.95rem;
                        transition: opacity 0.2s, max-width 0.2s;
                        opacity: 1;
                        max-width: 200px;
                    }

                    .sidebar-spine.collapsed .nav-label {
                        opacity: 0;
                        max-width: 0;
                        margin: 0;
                    }
                    
                    .active-indicator {
                        position: absolute;
                        right: 10px;
                        top: 50%;
                        transform: translateY(-50%);
                        width: 5px;
                        height: 5px;
                        background: #2f76c5;
                        border-radius: 50%;
                        box-shadow: 0 0 8px rgba(47, 118, 197, 0.4);
                        opacity: 1;
                        transition: opacity 0.2s;
                        animation: pulseIndicator 1.8s ease-in-out infinite;
                    }

                    @keyframes pulseIndicator {
                        0%, 100% { opacity: 0.95; filter: brightness(1); }
                        50% { opacity: 0.55; filter: brightness(1.2); }
                    }

                    .sidebar-spine.collapsed .active-indicator {
                        right: 6px;
                        top: 6px;
                        transform: none;
                    }

                    .collapse-toggle {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 14px;
                        border: none;
                        border-top: 1px solid rgba(211, 211, 215, 0.8);
                        background: transparent;
                        color: #6f86a9;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .collapse-toggle:hover {
                        background: rgba(233, 244, 255, 0.65);
                        color: #255f9b;
                    }

                    .collapse-toggle:focus-visible {
                        outline: none;
                        box-shadow: inset 0 0 0 3px rgba(78, 154, 247, 0.24);
                    }

                    .toggle-icon {
                        transform: rotate(90deg);
                        transition: transform 0.3s;
                    }

                    .toggle-icon.collapsed {
                        transform: rotate(-90deg);
                    }

                    @media (max-width: 1024px) {
                        .sidebar-spine {
                            width: 252px;
                        }
                        .sidebar-spine.collapsed {
                            width: 84px;
                        }
                    }

                    @media (max-width: 768px) {
                        .sidebar-spine {
                            position: fixed;
                            left: 0;
                            top: 0;
                            height: 100vh;
                            z-index: 1000;
                            transform: translateX(-100%);
                            transition: transform 0.3s ease;
                            width: 278px;
                            background: linear-gradient(180deg, #fdfefe, #f4f9ff);
                        }

                        .sidebar-spine.mobile-open {
                            transform: translateX(0);
                        }

                        .sidebar-backdrop {
                            position: fixed;
                            inset: 0;
                            background: rgba(0, 0, 0, 0.4);
                            z-index: 999;
                        }

                        /* Disable collapse on mobile overlay */
                        .collapse-toggle {
                            display: none;
                        }
                        
                        .sidebar-spine.collapsed {
                            width: 278px; /* Reset width for mobile */
                        }
                        
                        .sidebar-spine.collapsed .project-info,
                        .sidebar-spine.collapsed .nav-label,
                        .sidebar-spine.collapsed .caret {
                            opacity: 1;
                            max-width: none;
                        }
                        
                        .sidebar-spine.collapsed .switcher-btn {
                            width: 100%;
                            justify-content: flex-start;
                        }
                        
                        .sidebar-spine.collapsed .nav-item {
                            width: 100%;
                            justify-content: flex-start;
                        }
                    }

                    @media (prefers-reduced-motion: reduce) {
                        .sidebar-spine,
                        .switcher-btn,
                        .nav-item,
                        .dropdown-item,
                        .collapse-toggle,
                        .active-indicator {
                            transition: none;
                            animation: none;
                            transform: none !important;
                        }
                    }
                `}</style>
            </aside>
        </>
    );
}
