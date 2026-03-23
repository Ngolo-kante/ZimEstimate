'use client';

import { useReveal } from '@/hooks/useReveal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { AnimatedHero } from '@/components/ui/AnimatedHero';
import { BentoGrid, BentoGridItem } from '@/components/ui/BentoGrid';
import { Timeline } from '@/components/ui/Timeline';
import {
  Scan,
  Camera,
  NotePencil,
  ArrowRight,
  ChartLine,
  Package,
  CurrencyDollar,
  Wallet,
  ChartLineUp,
  Stack,
  CheckCircle,
  Storefront,
  DownloadSimple,
  ShieldCheck,
  FileText,
} from '@phosphor-icons/react';

type IconType = typeof Scan;

const workflows: Array<{
  id: string;
  icon: IconType;
  title: string;
  label: string;
  href: string;
}> = [
    {
      id: 'vision',
      icon: Scan,
      title: 'Vision AI Takeoff',
      label: 'HIGH PRECISION',
      href: '/ai/vision-takeoff',
    },
    {
      id: 'scanner',
      icon: Camera,
      title: 'Smart Quote Scanner',
      label: 'FIELD READY',
      href: '/ai/quote-scanner',
    },
    {
      id: 'manual',
      icon: NotePencil,
      title: 'Manual Builder',
      label: 'PRO CONTROL',
      href: '/boq/new?method=manual',
    },
    {
      id: 'quick-projects',
      icon: CheckCircle,
      title: 'Quick Projects',
      label: 'UTILITIES & ADD-ONS',
      href: '/quick-projects',
    },
  ];

const signals: Array<{
  icon: IconType;
  label: string;
  value: string;
  subtext: string;
}> = [
    {
      icon: ChartLine,
      label: 'MARKET ACCURACY',
      value: '98.2%',
      subtext: 'Weekly material price verification',
    },
    {
      icon: Package,
      label: 'MATERIAL COVERAGE',
      value: '2.8k+',
      subtext: 'Tracked products and vendor references',
    },
    {
      icon: CurrencyDollar,
      label: 'DUAL CURRENCY',
      value: 'USD + ZiG',
      subtext: 'Live conversion across all project views',
    },
  ];

// Platform capabilities for the offers section
const offerings: Array<{
  icon: IconType;
  title: string;
  description: string;
  href: string;
}> = [
    {
      icon: Wallet,
      title: 'Budget Planner',
      description: 'Set savings targets and forecast required daily or weekly contributions.',
      href: '/projects',
    },
    {
      icon: ChartLineUp,
      title: 'Budget vs Actual',
      description: 'Track variance by quantity and unit price in real-time.',
      href: '/projects',
    },
    {
      icon: Stack,
      title: 'Stage-Based BOQ',
      description: 'Organize costs by substructure, superstructure, roofing, and finishing.',
      href: '/boq/new?method=manual',
    },
    {
      icon: CheckCircle,
      title: 'Usage Tracking',
      description: 'Record consumption against BOQ quantities and trigger low-stock actions.',
      href: '/projects',
    },
    {
      icon: Storefront,
      title: 'Procurement Hub',
      description: 'Create RFQs, compare supplier responses, and log purchases.',
      href: '/projects',
    },
    {
      icon: DownloadSimple,
      title: 'PDF/Excel Exports',
      description: 'Generate share-ready reports for clients, QS, and site teams.',
      href: '/export',
    },
  ];

const workflowLine = [
  { step: '01', title: 'Estimate', content: <p className="text-slate-600">Generate BOQ quickly from drawings, scans, or manual input.</p> },
  { step: '02', title: 'Price', content: <p className="text-slate-600">Pull current market pricing and compare budget scenarios.</p> },
  { step: '03', title: 'Procure', content: <p className="text-slate-600">Run RFQ cycles and record purchases from selected suppliers.</p> },
  { step: '04', title: 'Track', content: <p className="text-slate-600">Monitor usage, variance, and progress by construction stage.</p> },
];

export default function HomePage() {
  const router = useRouter();
  const { profile } = useAuth();

  const isAdmin =
    profile?.tier === 'admin' ||
    (profile?.email?.toLowerCase() === 'demo@zimestimate.com');

  useReveal({ selector: '.reveal-item', threshold: 0.16, once: true });

  const heroActions = (
    <>
      <Button
        onClick={() => router.push('/boq/new?method=manual')}
        icon={<ArrowRight size={18} />}
        iconPosition="right"
        size="lg"
        className="hero-primary shadow-blue-500/25 shadow-lg"
      >
        Create Estimate Now
      </Button>
      <Link href="/market-insights" className="hero-link font-medium text-slate-600 hover:text-blue-600 transition-colors">
        Check Live Material Prices
      </Link>
      {isAdmin && (
        <Link href="/admin/suppliers" className="hero-link-admin flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100/50 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors">
          <ShieldCheck size={16} weight="bold" className="text-emerald-600" />
          Open Admin Portal
        </Link>
      )}
    </>
  );

  return (
    <MainLayout fullWidth>
      <div className="flex flex-col gap-24 pb-24 home-page-reset overflow-x-hidden">
        <section className="px-4 mt-8 md:px-8 max-w-[1400px] mx-auto w-full reveal-item" data-delay="1">
          <AnimatedHero
            title={
              <>
                <span className="text-xs tracking-[0.2em] font-bold text-blue-600 uppercase mb-2 block">
                  ESTIMATE. PROCURE. TRACK.
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
                  One operating screen for <br className="hidden md:block" />Zimbabwe construction projects.
                </h1>
              </>
            }
            subtitle="ZimEstimate connects BOQ generation, live pricing, procurement, and usage tracking so your team can move from estimate to execution without context switching."
            actions={heroActions}
          >
            {/* Nano Banana Gen Asset Placeholder */}
            <div className="relative w-full aspect-[4/3] md:aspect-video lg:aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-slate-900 flex items-center justify-center group cursor-pointer">
              {/* Replace this img with the actual generated asset later */}
              <img src="/placeholder-hero.webp" alt="Construction Site Render" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 ease-out" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="p-3 bg-white/10 backdrop-blur rounded-2xl mb-2 text-white/50 border border-white/10">
                  <Scan size={32} weight="duotone" />
                </div>
                <span className="text-white/70 font-medium text-sm">[Nano Banana Gen Asset Here]</span>
              </div>
              <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur shadow-sm rounded-lg p-2 text-xs font-medium text-slate-600 flex items-center gap-1">
                <CheckCircle weight="fill" className="text-emerald-500" /> Auto-priced BOQ
              </div>
            </div>
          </AnimatedHero>
        </section>

        <section className="px-4 md:px-8 max-w-7xl mx-auto w-full reveal-item" data-delay="2">
          <div className="bg-white border text-center border-slate-200/60 rounded-[2rem] p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <span className="text-blue-600 text-sm font-bold tracking-wider uppercase">QUICK START</span>
            <h2 className="text-3xl font-bold text-slate-900 mt-2 mb-8">Smart BOQ Builder</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
              {workflows.map((workflow) => {
                const Icon = workflow.icon;
                return (
                  <Link
                    key={workflow.id}
                    href={workflow.href}
                    className="group relative flex flex-col items-start p-6 rounded-2xl bg-slate-50 border border-transparent hover:border-blue-100 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-400 transform scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-300" />
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-slate-800 group-hover:bg-blue-100 group-hover:text-blue-600 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300 mb-4">
                      <Icon size={24} weight="bold" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{workflow.title}</h3>
                    <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mt-1 group-hover:text-blue-500 transition-colors">{workflow.label}</span>
                    <div className="mt-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all">
                      <ArrowRight size={20} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 md:px-8 w-full reveal-item" data-delay="6">
          <Timeline
            title="One pipeline from planning to site execution."
            description="Follow our seamless workflow to take control of your construction projects from start to finish."
            data={workflowLine}
          />
        </section>

        <section className="px-4 md:px-8 max-w-7xl mx-auto w-full reveal-item" data-delay="4">
          <div className="mb-10 text-center">
            <span className="text-blue-600 text-sm font-bold tracking-wider uppercase block mb-2">TRUST PROOF</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Built for real pricing pressure.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {signals.map((signal) => {
              const Icon = signal.icon;
              return (
                <div key={signal.label} className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                  <div className="flex items-center gap-2 text-slate-500 mb-4">
                    <Icon size={18} weight="duotone" className="text-blue-500" />
                    <span className="text-xs font-bold tracking-widest uppercase">{signal.label}</span>
                  </div>
                  <strong className="text-3xl font-extrabold text-slate-900 block mb-2">{signal.value}</strong>
                  <p className="text-sm text-slate-600 line-clamp-2">{signal.subtext}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="px-4 md:px-8 w-full reveal-item" data-delay="5">
          <div className="text-center mb-12">
            <span className="text-blue-600 text-sm font-bold tracking-wider uppercase block mb-2">PLATFORM CAPABILITIES</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Everything after the estimate is already connected.</h2>
            <p className="text-slate-600">Core capabilities designed to reduce rework and improve cost control.</p>
          </div>

          <BentoGrid>
            {offerings.map((offer, i) => (
              <BentoGridItem
                key={offer.title}
                title={offer.title}
                description={offer.description}
                header={
                  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-100 relative overflow-hidden group bg-slate-900 items-center justify-center">
                    {/* Nano Banana Gen Asset placeholder for Bento Block */}
                    <img src={`/placeholder-bento-${i + 1}.webp`} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-500 filter blur-[2px] group-hover:blur-0" />
                    <div className="relative z-10 p-2 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 text-white/50 text-[10px] font-medium tracking-wide uppercase">
                      [Nano Banana]
                    </div>
                  </div>
                }
                icon={<div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100"><offer.icon className="h-4 w-4" weight="bold" /></div>}
                className={i === 0 || i === 3 ? "md:col-span-2" : ""}
              />
            ))}
          </BentoGrid>
        </section>

        <section className="px-4 md:px-8 max-w-7xl mx-auto w-full reveal-item" data-delay="3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-[2rem] p-8 md:p-12 border border-slate-700/50 shadow-2xl relative overflow-hidden">

            {/* Decorative background elements */}
            <div className="absolute top-0 lg:-top-20 left-0 lg:-left-20 w-64 h-64 bg-blue-500 rounded-full mix-blend-color-dodge filter blur-3xl opacity-20"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500 rounded-full mix-blend-color-dodge filter blur-3xl opacity-20"></div>

            <div className="flex gap-6 items-start relative z-10 w-full md:w-1/2">
              <div className="w-12 h-12 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/20">
                <FileText size={24} weight="duotone" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white leading-tight">Ready to move this from estimate to execution?</h3>
                <p className="text-slate-400 mt-2 text-sm leading-relaxed">Create your account to save projects, run procurement, and export client-ready reports.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 relative z-10 w-full md:w-auto shrink-0">
              <Button
                onClick={() => router.push('/auth/signup')}
                icon={<ArrowRight size={16} />}
                iconPosition="right"
                size="lg"
                className="bg-white text-slate-900 hover:bg-slate-50 border border-white"
              >
                Create Free Account
              </Button>
              <Button
                onClick={() => router.push('/boq/new?method=manual')}
                className="bg-slate-800 text-white border border-slate-700 hover:bg-slate-700"
                size="lg"
              >
                Start BOQ First
              </Button>
            </div>
          </div>
        </section>

      </div>
    </MainLayout>
  );
}
