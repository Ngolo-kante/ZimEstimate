'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, Confetti as ConfettiIcon, TrendDown, ArrowRight, X } from '@phosphor-icons/react';
import Button from './Button';

interface CelebrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    stats?: {
        label: string;
        value: string;
        highlight?: boolean;
    }[];
    actionLabel?: string;
    onAction?: () => void;
    variant?: 'stage-complete' | 'savings' | 'milestone' | 'general';
}

// Confetti particle
interface Particle {
    id: number;
    x: number;
    y: number;
    color: string;
    rotation: number;
    scale: number;
    velocityX: number;
    velocityY: number;
}

const CONFETTI_COLORS = [
    '#22c55e', // green
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#ec4899', // pink
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#ef4444', // red
];

function ConfettiAnimation({ isActive }: { isActive: boolean }) {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        if (!isActive) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- reset animation state
            setParticles([]);
            return;
        }

        // Create initial burst of confetti
        const newParticles: Particle[] = [];
        for (let i = 0; i < 50; i++) {
            newParticles.push({
                id: i,
                x: 50 + (Math.random() - 0.5) * 20,
                y: 30,
                color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
                rotation: Math.random() * 360,
                scale: 0.5 + Math.random() * 0.5,
                velocityX: (Math.random() - 0.5) * 15,
                velocityY: -10 - Math.random() * 10,
            });
        }
        setParticles(newParticles);

        // Animate particles
        let frame: number;
        let lastTime = performance.now();

        const animate = (currentTime: number) => {
            const deltaTime = (currentTime - lastTime) / 16; // Normalize to ~60fps
            lastTime = currentTime;

            setParticles(prev => {
                const updated = prev.map(p => ({
                    ...p,
                    x: p.x + p.velocityX * deltaTime * 0.5,
                    y: p.y + p.velocityY * deltaTime * 0.5,
                    velocityY: p.velocityY + 0.5 * deltaTime, // Gravity
                    rotation: p.rotation + 5 * deltaTime,
                })).filter(p => p.y < 120); // Remove particles that fall off screen

                return updated;
            });

            frame = requestAnimationFrame(animate);
        };

        frame = requestAnimationFrame(animate);

        return () => {
            if (frame) cancelAnimationFrame(frame);
        };
    }, [isActive]);

    if (!isActive || particles.length === 0) return null;

    return (
        <div className="confetti-container">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="confetti-particle"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        backgroundColor: p.color,
                        transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
                    }}
                />
            ))}
            <style jsx>{`
                .confetti-container {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    pointer-events: none;
                    z-index: 10;
                }
                .confetti-particle {
                    position: absolute;
                    width: 10px;
                    height: 10px;
                    border-radius: 2px;
                }
            `}</style>
        </div>
    );
}

export function CelebrationModal({
    isOpen,
    onClose,
    title,
    message,
    stats,
    actionLabel,
    onAction,
    variant = 'general'
}: CelebrationModalProps) {
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Delay confetti for dramatic effect
            const timer = setTimeout(() => setShowConfetti(true), 200);
            return () => clearTimeout(timer);
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- reset animation on close
            setShowConfetti(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (variant) {
            case 'stage-complete':
                return <CheckCircle size={48} className="icon success" />;
            case 'savings':
                return <TrendDown size={48} className="icon savings" />;
            case 'milestone':
                return <ConfettiIcon size={48} className="icon milestone" />;
            default:
                return <CheckCircle size={48} className="icon success" />;
        }
    };

    const getGradient = () => {
        switch (variant) {
            case 'stage-complete':
                return 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)';
            case 'savings':
                return 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
            case 'milestone':
                return 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
            default:
                return 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)';
        }
    };

    return (
        <div className="celebration-overlay" onClick={onClose}>
            <div className="celebration-modal" onClick={e => e.stopPropagation()}>
                <ConfettiAnimation isActive={showConfetti} />

                <button className="close-btn" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="celebration-content">
                    <div className="icon-container">
                        {getIcon()}
                    </div>

                    <h2 className="celebration-title">{title}</h2>
                    <p className="celebration-message">{message}</p>

                    {stats && stats.length > 0 && (
                        <div className="stats-grid">
                            {stats.map((stat, index) => (
                                <div
                                    key={index}
                                    className={`stat-item ${stat.highlight ? 'highlight' : ''}`}
                                >
                                    <span className="stat-label">{stat.label}</span>
                                    <span className="stat-value">{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="celebration-actions">
                        {actionLabel && onAction ? (
                            <Button onClick={onAction} className="action-btn">
                                {actionLabel}
                                <ArrowRight size={18} />
                            </Button>
                        ) : (
                            <Button onClick={onClose} className="action-btn">
                                Continue
                            </Button>
                        )}
                    </div>
                </div>

                <style jsx>{`
                    .celebration-overlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.6);
                        backdrop-filter: blur(8px);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                        padding: 1rem;
                        animation: fadeIn 0.2s ease-out;
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    .celebration-modal {
                        position: relative;
                        background: ${getGradient()};
                        border-radius: 24px;
                        padding: 48px 40px;
                        max-width: 440px;
                        width: 100%;
                        text-align: center;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                        animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                        overflow: hidden;
                    }

                    @keyframes scaleIn {
                        from {
                            opacity: 0;
                            transform: scale(0.9) translateY(20px);
                        }
                        to {
                            opacity: 1;
                            transform: scale(1) translateY(0);
                        }
                    }

                    .close-btn {
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        border: none;
                        background: rgba(0, 0, 0, 0.1);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #374151;
                        transition: all 0.2s;
                        z-index: 20;
                    }

                    .close-btn:hover {
                        background: rgba(0, 0, 0, 0.15);
                    }

                    .celebration-content {
                        position: relative;
                        z-index: 5;
                    }

                    .icon-container {
                        margin-bottom: 20px;
                        animation: bounce 0.5s ease-out 0.3s both;
                    }

                    @keyframes bounce {
                        0% { transform: scale(0); }
                        50% { transform: scale(1.2); }
                        100% { transform: scale(1); }
                    }

                    .icon-container :global(.icon) {
                        margin: 0 auto;
                    }

                    .icon-container :global(.success) {
                        color: #16a34a;
                    }

                    .icon-container :global(.savings) {
                        color: #2563eb;
                    }

                    .icon-container :global(.milestone) {
                        color: #d97706;
                    }

                    .celebration-title {
                        font-size: 1.75rem;
                        font-weight: 800;
                        color: #0f172a;
                        margin: 0 0 12px 0;
                        letter-spacing: -0.02em;
                    }

                    .celebration-message {
                        font-size: 1rem;
                        color: #475569;
                        margin: 0 0 24px 0;
                        line-height: 1.6;
                    }

                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                        gap: 12px;
                        margin-bottom: 28px;
                    }

                    .stat-item {
                        background: rgba(255, 255, 255, 0.7);
                        border-radius: 12px;
                        padding: 16px 12px;
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }

                    .stat-item.highlight {
                        background: rgba(34, 197, 94, 0.2);
                        border: 2px solid rgba(34, 197, 94, 0.3);
                    }

                    .stat-label {
                        font-size: 0.75rem;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }

                    .stat-value {
                        font-size: 1.25rem;
                        font-weight: 700;
                        color: #0f172a;
                    }

                    .celebration-actions {
                        display: flex;
                        justify-content: center;
                    }

                    .celebration-actions :global(.action-btn) {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 14px 28px;
                        font-size: 1rem;
                        font-weight: 600;
                    }

                    @media (max-width: 480px) {
                        .celebration-modal {
                            padding: 36px 24px;
                        }

                        .celebration-title {
                            font-size: 1.5rem;
                        }

                        .stats-grid {
                            grid-template-columns: 1fr 1fr;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}
