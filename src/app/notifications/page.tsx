'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import {
    Bell,
    CheckCircle,
    Clock,
    Info,
    Warning,
    Trash,
    Funnel,
    Check
} from '@phosphor-icons/react';

// Mock Data
const MOCK_NOTIFICATIONS = [
    {
        id: 1,
        type: 'success',
        title: 'Project Created Successfully',
        message: 'The project "Borrowdale 4-Bedroom House" has been created and saved to your dashboard.',
        time: '2 mins ago',
        read: false,
        category: 'project'
    },
    {
        id: 2,
        type: 'info',
        title: 'Material Prices Updated',
        message: 'Market prices for cement and brick products have been updated based on recent market analysis.',
        time: '1 hour ago',
        read: false,
        category: 'system'
    },
    {
        id: 3,
        type: 'warning',
        title: 'Subscription Expiring Soon',
        message: 'Your Pro trial period ends in 3 days. Upgrade now to keep accessing premium features.',
        time: '1 day ago',
        read: true,
        category: 'account'
    },
    {
        id: 4,
        type: 'info',
        title: 'Welcome to ZimEstimate',
        message: 'Thanks for joining! Start by creating your first BOQ or browsing our marketplace templates.',
        time: '2 days ago',
        read: true,
        category: 'system'
    }
];

export default function NotificationsPage() {
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleMarkAllRead = () => {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const handleMarkRead = (id: number) => {
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const handleDelete = (id: number) => {
        setNotifications(notifications.filter(n => n.id !== id));
    };

    const filteredNotifications = activeTab === 'all'
        ? notifications
        : notifications.filter(n => !n.read);

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle size={20} weight="fill" className="text-green-500" />;
            case 'warning': return <Warning size={20} weight="fill" className="text-orange-500" />;
            case 'error': return <Warning size={20} weight="fill" className="text-red-500" />;
            default: return <Info size={20} weight="fill" className="text-blue-500" />;
        }
    };

    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto py-8 px-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">Notifications</h1>
                        <p className="text-slate-500">Stay updated with your project activity and system alerts.</p>
                    </div>
                    <div className="flex gap-3">
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                title="Mark all as read"
                            >
                                <Check size={16} />
                                Mark all read
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs & Filters */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                    <div className="flex border-b border-slate-100">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`flex-1 px-6 py-4 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === 'all'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            All Notifications
                        </button>
                        <button
                            onClick={() => setActiveTab('unread')}
                            className={`flex-1 px-6 py-4 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === 'unread'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Unread
                            {unreadCount > 0 && (
                                <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* List */}
                    <div className="divide-y divide-slate-100">
                        {filteredNotifications.length > 0 ? (
                            filteredNotifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-6 flex gap-4 transition-colors hover:bg-slate-50 group ${!notification.read ? 'bg-blue-50/30' : ''}`}
                                >
                                    <div className="flex-shrink-0 mt-1">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!notification.read ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                                            {getIcon(notification.type)}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className={`text-sm font-semibold mb-1 ${!notification.read ? 'text-slate-900' : 'text-slate-700'}`}>
                                                    {notification.title}
                                                </h3>
                                                <p className="text-sm text-slate-600 leading-relaxed mb-2">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={14} />
                                                        {notification.time}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="capitalize">{notification.category}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!notification.read && (
                                                    <button
                                                        onClick={() => handleMarkRead(notification.id)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Mark as read"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(notification.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {!notification.read && (
                                        <div className="self-center">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                    <Bell size={32} />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900 mb-1">No notifications</h3>
                                <p className="text-slate-500">You're all caught up! Check back later for updates.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
