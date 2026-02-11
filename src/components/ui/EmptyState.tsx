import React from 'react';
import { Package } from '@phosphor-icons/react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-border-light rounded-xl bg-mist">
            <div className="text-secondary mb-3">
                {icon || <Package size={32} />}
            </div>
            <h3 className="text-lg font-medium text-text mb-1">{title}</h3>
            <p className="text-secondary mb-4 max-w-sm">{description}</p>
            {action}
        </div>
    );
}
