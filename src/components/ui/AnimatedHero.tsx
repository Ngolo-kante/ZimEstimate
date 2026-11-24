"use client";

import { cn } from "@/lib/utils";
import React from "react";

export const AnimatedHero = ({
    children,
    className,
    title,
    subtitle,
    actions,
}: {
    children?: React.ReactNode;
    className?: string;
    title: React.ReactNode;
    subtitle: string;
    actions?: React.ReactNode;
}) => {
    return (
        <div
            className={cn(
                "relative flex flex-col items-center justify-center overflow-hidden bg-[var(--pw-fill-slate-50)] w-full rounded-3xl border border-[color-mix(in_oklab,var(--pw-line-slate-200)_50%,transparent)] shadow-sm",
                className
            )}
        >
            {/* Background radial gradient */}
            <div className="absolute inset-0 w-full h-full bg-[var(--pw-fill-slate-50)] z-0">
                <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10"></div>
                <div className="absolute top-0 -right-4 w-72 h-72 bg-emerald-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 animation-delay-2000"></div>
                <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 animation-delay-4000"></div>
            </div>

            <div className="z-10 w-full h-full flex flex-col pb-16 pt-24 px-6 relative">
                <div
                    /* The preview sits absolutely at 45% width from lg up, so the
                       copy has to stop short of it. 48% leaves clearance against
                       the card's 45% plus its right offset; wider than that and
                       the headline runs under the card and gets clipped. */
                    className="flex flex-col gap-6 lg:max-w-[48%]"
                >
                    {title}
                    <p className="text-lg text-[var(--pw-ink-slate-600)] max-w-xl">
                        {subtitle}
                    </p>
                    {actions && (
                        <div className="flex items-center gap-4 mt-4">
                            {actions}
                        </div>
                    )}
                </div>
                {children && (
                    <div
                        className="mt-12 lg:mt-0 lg:absolute lg:right-12 lg:top-1/2 lg:-translate-y-1/2 w-full lg:w-[45%] z-20"
                    >
                        {children}
                    </div>
                )}
            </div>

            {/* Grid Pattern overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-10" />
        </div>
    );
};
