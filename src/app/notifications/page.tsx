'use client';

import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import {
    deleteProjectNotification,
    getProjectNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from '@/lib/services/projects';
import { ProjectNotification } from '@/lib/database.types';
import {
    Bell,
    CheckCircle,
    Clock,
    Info,
    Warning,
    Trash,
    Check
} from '@phosphor-icons/react';

type NotificationItem = ProjectNotification & {
    timeLabel: string;
    typeLabel: string;
};

const formatTimeAgo = (timestamp: string, nowMs: number) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const diffMs = nowMs - date.getTime();
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
};

const buildNotificationItems = (records: ProjectNotification[]) => {
    const nowMs = Date.now();
    return records.map((notification) => ({
        ...notification,
        timeLabel: formatTimeAgo(notification.created_at, nowMs),
        typeLabel: notification.type.replace('_', ' '),
    }));
};

export default function NotificationsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const { error: showError } = useToast();
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadNotifications = async () => {
            setIsLoading(true);
            if (!user) {
                setNotifications([]);
                setIsLoading(false);
                return;
            }

            const { notifications, error } = await getProjectNotifications(user.id);
            if (error) {
                showError('Failed to load notifications');
            } else {
                setNotifications(buildNotificationItems(notifications));
            }
            setIsLoading(false);
        };

        loadNotifications();
    }, [user, showError]);

    const unreadCount = useMemo(
        () => notifications.filter(n => !n.is_read).length,
        [notifications]
    );

    const handleMarkAllRead = async () => {
        if (!user || unreadCount === 0) return;
        const { error } = await markAllNotificationsRead(user.id);
        if (error) {
            showError('Failed to mark all notifications as read');
            return;
        }
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const handleMarkRead = async (id: string) => {
        const { error } = await markNotificationRead(id);
        if (error) {
            showError('Failed to mark notification as read');
            return;
        }
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const handleDelete = async (id: string) => {
        const { error } = await deleteProjectNotification(id);
        if (error) {
            showError('Failed to delete notification');
            return;
        }
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const filteredNotifications = activeTab === 'all'
        ? notifications
        : notifications.filter(n => !n.is_read);

    const getIcon = (type: string) => {
        switch (type.toLowerCase()) {
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
                        {authLoading || isLoading ? (
                            <div className="py-20 text-center text-slate-500">Loading notifications...</div>
                        ) : filteredNotifications.length > 0 ? (
                            filteredNotifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-6 flex gap-4 transition-colors hover:bg-slate-50 group ${!notification.is_read ? 'bg-blue-50/30' : ''}`}
                                >
                                    <div className="flex-shrink-0 mt-1">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!notification.is_read ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                                            {getIcon(notification.type)}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className={`text-sm font-semibold mb-1 ${!notification.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                                                    {notification.title}
                                                </h3>
                                                <p className="text-sm text-slate-600 leading-relaxed mb-2">
                                                        {notification.message}
                                                    </p>
                                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={14} />
                                                            {notification.timeLabel}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="capitalize">{notification.typeLabel}</span>
                                                    </div>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!notification.is_read && (
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

                                    {!notification.is_read && (
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
                                <p className="text-slate-500">You&apos;re all caught up! Check back later for updates.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
