'use client';

import { useState, Suspense, useMemo, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  Plus,
  Trash,
  Check,
  CaretDown,
  Cube,
  Wall,
  HouseSimple,
  PaintBrush,
  ShieldCheck,
  UserCircle,
  ArrowRight,
  CheckCircle,
  Sparkle,
  DownloadSimple,
  Stack,
  CaretRight,
  Layout,
  Package,
  HardHat,
  Graph,
  House,
  Tag,
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react';
import {
  materials as allMaterials,
  getBestPrice,
} from '@/lib/materials';
import WizardStyles from './WizardStyles';


// Milestone configuration with AI-suggested materials
const milestones = [
  {
    id: 'substructure',
    label: 'Substructure',
    icon: Cube,
    description: 'Covers Foundation, Window Level, Ring Beam/Roof Level, and associated masonry',
    suggestedMaterials: [
      'sand-river', 'sand-pit', 'stone-19mm', 'hardcore',
      'brick-common', 'cement-325', 'cement-425',
      'brickforce', 'rebar-12', 'bindwire',
      'dpc', 'dpm', 'termite-poison'
    ],
  },
  {
    id: 'superstructure',
    label: 'Superstructure',
    icon: Wall,
    description: 'Main walls, lintels, ring beams, and structural elements',
    suggestedMaterials: ['cement-brick', 'cement-32n', 'river-sand', 'rebar-y10', 'mesh-ref-193'],
  },
  {
    id: 'roofing',
    label: 'Roofing',
    icon: HouseSimple,
    description: 'Trusses, sheeting, fascia',
    suggestedMaterials: ['ibr-sheet-3m', 'timber-50x76', 'timber-38x38', 'fascia-pvc', 'roof-screws'],
  },
  {
    id: 'finishing',
    label: 'Finishing',
    icon: PaintBrush,
    description: 'Plaster, paint, tiles, fixtures',
    suggestedMaterials: ['plaster-sand', 'cement-32n', 'pva-20l'],
  },
  {
    id: 'exterior',
    label: 'Exterior & Security',
    icon: ShieldCheck,
    description: 'Boundary walls, gates, durawall',
    suggestedMaterials: ['durawall', 'cement-brick', 'cement-32n'],
  },
  {
    id: 'labor',
    label: 'Labor & Services',
    icon: UserCircle,
    description: 'Builder rates, food, transport, and logistics',
    suggestedMaterials: ['labor-builder', 'labor-assistant', 'labor-foreman', 'service-food', 'service-transport'],
  },
];

// Build material catalog with best prices and categories
const materialCatalog = allMaterials.map((m) => {
  const bestPrice = getBestPrice(m.id);
  // Normalize prices for bricks (per 1000 -> per brick)
  let unit = m.unit;
  let priceUsd = bestPrice?.priceUsd || 0;
  let priceZwg = bestPrice?.priceZwg || 0;

  if (m.category === 'bricks' && m.unit.includes('1000')) {
    unit = 'Brick';
    priceUsd = priceUsd / 1000;
    priceZwg = priceZwg / 1000;
  }

  return {
    id: m.id,
    name: m.name,
    category: m.category,
    unit: unit,
    priceUsd: priceUsd,
    priceZwg: priceZwg,
    description: m.specifications || '',
  };
});

// Get unique categories (kept for future use)
const _categories = [...new Set(materialCatalog.map(m => m.category))];

interface BOQItem {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number | null;
  unit: string;
  priceUsd: number;
  priceZwg: number;
  description?: string;
  category?: string; // Added for sorting
}

interface MilestoneData {
  id: string;
  items: BOQItem[];
  expanded: boolean;
}

// PriceDisplay kept for future use
const _PriceDisplay = ({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) => (
  <div className="flex flex-col items-end">
    <span className="text-sm font-semibold text-slate-800">${priceUsd.toFixed(2)}</span>
    <span className="text-xs text-slate-500">ZWG {priceZwg.toFixed(2)}</span>
  </div>
);

// Searchable Material Dropdown Component
// Helper to get category icon
const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'bricks': return <Layout size={16} weight="duotone" className="text-orange-500" />;
    case 'cement': return <Package size={16} weight="duotone" className="text-gray-500" />;
    case 'sand':
    case 'aggregates': return <HardHat size={16} weight="duotone" className="text-amber-600" />;
    case 'steel': return <Graph size={16} weight="duotone" className="text-blue-500" />;
    case 'roofing': return <House size={16} weight="duotone" className="text-red-500" />;
    default: return <Tag size={16} weight="duotone" className="text-slate-400" />;
  }
};

const MaterialDropdown = ({
  value,
  onChange,
  placeholder = 'Search materials...',
}: {
  value: string;
  onChange: (materialId: string) => void;
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredMaterials = useMemo(() => {
    if (!search) return materialCatalog.slice(0, 50); // Show first 50 as suggestions if no search
    return materialCatalog.filter((m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const selectedMaterial = materialCatalog.find((m) => m.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={wrapperRef} style={{ zIndex: 1000 }}>
      <div
        className={`wizard-select flex items-center justify-between cursor-pointer transition-all duration-200 ${isOpen ? 'ring-2 ring-blue-100 border-blue-400' : 'border-slate-200'}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          border: '1px solid',
          padding: '12px 16px',
          borderRadius: '12px',
          background: '#fff',
          boxShadow: isOpen ? '0 4px 12px rgba(78, 154, 247, 0.1)' : 'none',
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selectedMaterial ? (
            <>
              {getCategoryIcon(selectedMaterial.category)}
              <span className="font-medium text-slate-900 truncate">{selectedMaterial.name}</span>
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <CaretDown size={18} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-[1001] animate-fadeIn"
          style={{ maxHeight: '320px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          <div className="p-3 bg-slate-50 border-b border-slate-100">
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                placeholder="Search by name or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {filteredMaterials.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-slate-300 mb-2 flex justify-center"><Tag size={32} /></div>
                <p className="text-sm text-slate-500">No matching materials found</p>
              </div>
            ) : (
              <div className="p-1">
                {filteredMaterials.map((m) => (
                  <div
                    key={m.id}
                    className={`group p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${value === m.id ? 'bg-blue-50' : ''}`}
                    onClick={() => {
                      onChange(m.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover:border-blue-200">
                      {getCategoryIcon(m.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-sm font-semibold text-slate-800 truncate">{m.name}</span>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">${m.priceUsd.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{m.category}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                        <span className="text-[10px] text-slate-400">{m.unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function BOQBuilderContent() {
  const searchParams = useSearchParams();
  const _router = useRouter(); // Kept for future use

  // State from URL params (kept for future use)
  const _projectType = searchParams.get('type') || 'residential';
  const [projectScope, setProjectScope] = useState(searchParams.get('scope') || 'full');

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedStages, setSelectedStages] = useState<string[]>(['substructure']);

  // Project Details State
  const [projectDetails, setProjectDetails] = useState({
    name: '',
    location: '',
    budget: '',
    rooms: 4,
    area: 150, // sqm
  });

  // Labor Preference
  const [laborType, setLaborType] = useState<'materials_only' | 'materials_labor'>('materials_only');

  // Milestones State (The actual BOQ data)
  const [milestonesState, setMilestonesState] = useState<MilestoneData[]>(() =>
    milestones.map(m => ({
      id: m.id,
      items: [],
      expanded: true
    }))
  );

  // Modal State for adding items
  const [showAddMaterial, setShowAddMaterial] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<{ materialId: string; quantity: string }>({ materialId: '', quantity: '' });
  const [isGenerating, setIsGenerating] = useState(false);

  // Currency context - must be called at top level (not inside conditionals)
  const { currency, setCurrency, exchangeRate } = useCurrency();

  // Derived state
  const totalAmount = useMemo(() => {
    return milestonesState.reduce((total, ms) => {
      const msTotal = ms.items.reduce((t, item) => t + ((item.quantity || 0) * item.priceUsd), 0);
      return total + msTotal;
    }, 0);
  }, [milestonesState]);

  const calculateMilestoneTotal = (items: BOQItem[]) => {
    return items.reduce((acc, item) => {
      return acc + (item.quantity || 0) * item.priceUsd;
    }, 0);
  };

  // Helper to get next available ID
  const getNextId = () => Math.random().toString(36).substr(2, 9);

  // Sorting helper for Critical Materials (Bricks > Cement > Sand > Others)
  const sortMaterials = (items: BOQItem[]) => {
    const priorityOrder = ['bricks', 'cement', 'sand', 'aggregates', 'steel'];
    return [...items].sort((a, b) => {
      // Find category from catalog since it might not be on item directly if old data
      const catA = materialCatalog.find(m => m.id === a.materialId)?.category || '';
      const catB = materialCatalog.find(m => m.id === b.materialId)?.category || '';

      const idxA = priorityOrder.indexOf(catA);
      const idxB = priorityOrder.indexOf(catB);

      // If both are priority, lower index comes first
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      // If only A is priority, A comes first
      if (idxA !== -1) return -1;
      // If only B is priority, B comes first
      if (idxB !== -1) return 1;

      // Otherwise sort alphabetically
      return a.materialName.localeCompare(b.materialName);
    });
  };

  const toggleMilestone = (id: string) => {
    setMilestonesState(prev => prev.map(m =>
      m.id === id ? { ...m, expanded: !m.expanded } : m
    ));
  };

  const toggleStageSelection = (id: string) => {
    setSelectedStages(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const visibleMilestones = milestones.filter(m => {
    // If specific stages selected (Scope Selection step)
    if (projectScope === 'stage' && m.id !== 'labor') {
      return selectedStages.includes(m.id);
    }
    // Labor is handled separately by labor selection
    if (m.id === 'labor' && laborType === 'materials_only') return false;

    return true;
  });

  const goToNextStep = () => {
    if (currentStep === 1 && (!projectDetails.name || !projectDetails.location)) {
      alert('Please fill in project name and location');
      return;
    }
    if (currentStep === 2 && projectScope === 'stage' && selectedStages.length === 0) {
      alert('Please select at least one stage');
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const goToPrevStep = () => setCurrentStep(prev => prev - 1);

  const handleUpdateQuantity = (milestoneId: string, itemId: string, qty: number) => {
    setMilestonesState(prev => prev.map(m => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        items: m.items.map(item => item.id === itemId ? { ...item, quantity: qty } : item)
      };
    }));
  };

  const handleUpdateUnitPrice = (milestoneId: string, itemId: string, price: number) => {
    setMilestonesState(prev => prev.map(m => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        items: m.items.map(item => item.id === itemId ? { ...item, priceUsd: price } : item)
      };
    }));
  };

  const handleAddMaterial = (milestoneId: string) => {
    if (!newItem.materialId) return;

    const material = materialCatalog.find(m => m.id === newItem.materialId);
    if (!material) return;

    setMilestonesState(prev => prev.map(m => {
      if (m.id !== milestoneId) return m;

      const existingItem = m.items.find(i => i.materialId === newItem.materialId);
      if (existingItem) {
        const addedQty = parseFloat(newItem.quantity) || 1;
        return {
          ...m,
          items: m.items.map(i => i.materialId === newItem.materialId ? {
            ...i,
            quantity: (i.quantity || 0) + addedQty
          } : i)
        };
      }

      const newItemObj: BOQItem = {
        id: getNextId(),
        materialId: material.id,
        materialName: material.name,
        quantity: parseFloat(newItem.quantity) || 1,
        unit: material.unit,
        priceUsd: material.priceUsd,
        priceZwg: material.priceZwg,
        description: material.description
      };

      return { ...m, items: [newItemObj, ...m.items] };
    }));

    setNewItem({ materialId: '', quantity: '' });
    setShowAddMaterial(null);
  };

  const handleRemoveItem = (milestoneId: string, itemId: string) => {
    setMilestonesState(prev => prev.map(m => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        items: m.items.filter(i => i.id !== itemId)
      };
    }));
  };

  const handleAiGenerate = async (milestoneId: string) => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const milestoneConfig = milestones.find(m => m.id === milestoneId);
    if (!milestoneConfig || !milestoneConfig.suggestedMaterials) {
      setIsGenerating(false);
      return;
    }

    setMilestonesState(prev => prev.map(m => {
      if (m.id !== milestoneId) return m;
      if (m.items.length > 0) return m;

      const newItems = milestoneConfig.suggestedMaterials!.map(matId => {
        const mat = materialCatalog.find(mc => mc.id === matId);
        if (!mat) return null;
        return {
          id: getNextId(),
          materialId: mat.id,
          materialName: mat.name,
          quantity: null,
          unit: mat.unit,
          priceUsd: mat.priceUsd,
          priceZwg: mat.priceZwg,
          description: mat.description
        } as BOQItem;
      }).filter(Boolean) as BOQItem[];

      return { ...m, items: newItems, expanded: true };
    }));

    setIsGenerating(false);
  };

  // Step definitions - moved here so it's available in all code paths
  const steps = [
    { number: 1, label: 'Project Info' },
    { number: 2, label: 'Scope' },
    { number: 3, label: 'Labor' },
    { number: 4, label: 'Build BOQ' },
  ];

  if (currentStep === 4) {
    // Format currency based on current mode (currency, setCurrency, exchangeRate are from top-level hook)
    const formatCurrency = (valueUsd: number, showZig: boolean = false): string => {
      const useZig = showZig || currency === 'ZWG';
      if (useZig) {
        return `ZiG ${(valueUsd * exchangeRate).toFixed(2)}`;
      }
      return `$${valueUsd.toFixed(2)}`;
    };

    // Calculate totals
    const totalMaterials = milestonesState.reduce((total, ms) => {
      return total + ms.items.reduce((t, item) => t + ((item.quantity || 0) * item.priceUsd), 0);
    }, 0);
    const totalItems = milestonesState.reduce((acc, m) => acc + m.items.length, 0);
    const itemsWithQty = milestonesState.reduce((acc, m) =>
      acc + m.items.filter(i => i.quantity && i.quantity > 0).length, 0);

    return (
      <div className="boq-builder">
        <WizardStyles />

        {/* Step Progress Bar */}
        <div className="step-progress-bar">
          {steps.map((step, index) => (
            <div key={step.number} className="step-progress-item">
              <div className={`step-node ${currentStep >= step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}>
                {currentStep > step.number ? <Check size={16} weight="bold" /> : step.number}
              </div>
              <span className={`step-label ${currentStep >= step.number ? 'active' : ''}`}>{step.label}</span>
              {index < steps.length - 1 && (
                <div className={`step-connector ${currentStep > step.number ? 'active' : ''}`} />
              )}
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="builder-header">
          <div>
            <h1>{projectDetails.name || 'New Project'}</h1>
            <div className="flex gap-4 text-slate-500 text-sm">
              <span>{projectDetails.location}</span>
              <span>•</span>
              <span>{selectedStages.length} Stages</span>
            </div>
          </div>
          <div className="header-actions">
            <Button variant="secondary" onClick={goToPrevStep}>Edit Details</Button>
            <Button
              variant="primary"
              icon={<DownloadSimple size={18} />}
              onClick={() => alert('Download feature coming soon!')}
            >
              Export PDF
            </Button>
          </div>
        </div>

        {/* Currency Toggle - Prominent */}
        <div className="currency-toggle-bar">
          <span className="currency-label">Display prices in:</span>
          <div className="currency-toggle-group">
            <button
              className={`currency-btn ${currency === 'USD' ? 'active' : ''}`}
              onClick={() => setCurrency('USD')}
            >
              <span className="currency-symbol">$</span> USD
            </button>
            <button
              className={`currency-btn ${currency === 'ZWG' ? 'active' : ''}`}
              onClick={() => setCurrency('ZWG')}
            >
              <span className="currency-symbol">Z$</span> ZiG
            </button>
          </div>
        </div>

        {/* Stage Materials Cards FIRST (as per requirement) */}
        <div className="milestones-section">
          {visibleMilestones.map((milestone) => {
            const mData = milestonesState.find(m => m.id === milestone.id) || { items: [], expanded: true };
            const mTotal = calculateMilestoneTotal(mData.items);

            return (
              <div key={milestone.id} className="milestone-card bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
                <div
                  className="milestone-header flex items-center p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => toggleMilestone(milestone.id)}
                >
                  <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-sm mr-4 text-blue-500">
                    <milestone.icon size={20} weight="duotone" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{milestone.label}</h3>
                    <p className="text-xs text-slate-500">{milestone.description}</p>
                  </div>
                  <div className="text-right mr-4">
                    <span className="text-xs text-slate-500 block">{mData.items.length} items</span>
                    <span className="font-bold text-slate-700">${mTotal.toFixed(2)}</span>
                  </div>
                  <div className={`transform transition-transform text-slate-400 ${mData.expanded ? 'rotate-180' : ''}`}>
                    <CaretDown size={20} />
                  </div>
                </div>

                {mData.expanded && (
                  <div className="p-4">
                    {mData.items.length > 0 ? (
                      <div className="materials-list space-y-3">
                        {/* Table Header */}
                        <div className="grid grid-cols-[1fr_130px_140px_120px_48px] gap-4 px-4 py-3 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest rounded-xl border border-slate-100">
                          <div>Material Description</div>
                          <div className="text-right">Market Price</div>
                          <div className="text-center">Quantity</div>
                          <div className="text-right">Line Total</div>
                          <div></div>
                        </div>

                        {sortMaterials(mData.items).map((item) => (
                          <div key={item.id} className="material-row-modern group grid grid-cols-[1fr_130px_140px_120px_48px] gap-4 items-center p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
                            {/* Name & Desc */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                {getCategoryIcon(materialCatalog.find(m => m.id === item.materialId)?.category || '')}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-slate-900 truncate leading-tight">{item.materialName}</span>
                                <span className="text-xs text-slate-500 truncate mt-0.5">{item.description}</span>
                              </div>
                            </div>

                            {/* Unit Price Edit */}
                            <div className="flex items-center justify-end">
                              <div className="relative group/input">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold transition-colors group-focus-within/input:text-blue-500">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="w-28 pl-6 pr-3 py-2 text-right text-sm font-bold text-slate-700 bg-slate-50 border border-transparent rounded-lg focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                  value={item.priceUsd}
                                  onChange={(e) => handleUpdateUnitPrice(milestone.id, item.id, parseFloat(e.target.value) || 0)}
                                />
                              </div>
                            </div>

                            {/* Quantity Edit */}
                            <div className="flex justify-center">
                              <div className="flex items-center bg-slate-50 border border-transparent rounded-lg focus-within:bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100 transition-all w-32 overflow-hidden">
                                <input
                                  className="w-full p-2 text-center text-sm font-bold text-slate-700 outline-none bg-transparent"
                                  type="number"
                                  value={item.quantity || ''}
                                  onChange={(e) => handleUpdateQuantity(milestone.id, item.id, parseFloat(e.target.value))}
                                  placeholder="0"
                                />
                                <span className="text-[10px] font-bold text-slate-400 uppercase pr-3 pl-1">
                                  {item.unit}
                                </span>
                              </div>
                            </div>

                            {/* Total */}
                            <div className="text-right">
                              <div className="text-xs font-bold text-slate-400 mb-0.5 uppercase tracking-tighter">Total</div>
                              <div className="font-black text-slate-900">
                                ${((item.quantity || 0) * item.priceUsd).toFixed(2)}
                              </div>
                            </div>

                            {/* Remove */}
                            <div className="flex justify-end">
                              <button
                                onClick={() => handleRemoveItem(milestone.id, item.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                title="Remove item"
                              >
                                <Trash size={18} weight="bold" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200 mb-4">
                        <p>No materials added yet.</p>
                      </div>
                    )}

                    {/* Add Item Form */}
                    {showAddMaterial === milestone.id ? (
                      <div className="mt-4 p-6 bg-white border-2 border-blue-100 rounded-2xl shadow-xl shadow-blue-500/5 animate-fadeIn relative z-[50]">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                            <Plus size={18} weight="bold" />
                          </div>
                          <h4 className="font-bold text-slate-800">Add New Material</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                          <div className="md:col-span-7">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Select Material from Catalog</label>
                            <MaterialDropdown
                              value={newItem.materialId}
                              onChange={(id) => setNewItem({ ...newItem, materialId: id })}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Quantity</label>
                            <div className="relative group/qty">
                              <input
                                type="number"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-slate-700"
                                placeholder="0.00"
                                value={newItem.quantity}
                                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="md:col-span-2 flex gap-2">
                            <Button
                              variant="primary"
                              fullWidth
                              onClick={() => handleAddMaterial(milestone.id)}
                              disabled={!newItem.materialId || !newItem.quantity}
                              icon={<Check size={18} weight="bold" />}
                            >
                              Add
                            </Button>
                            <button
                              onClick={() => setShowAddMaterial(null)}
                              className="p-3 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-colors"
                            >
                              <X size={18} weight="bold" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3 mt-4">
                        <Button
                          variant="secondary"
                          icon={<Plus size={16} />}
                          size="sm"
                          onClick={() => setShowAddMaterial(milestone.id)}
                        >
                          Add Material
                        </Button>
                        <Button
                          variant="ghost"
                          icon={isGenerating ? <div className="animate-spin"><div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div></div> : <Sparkle size={16} />}
                          size="sm"
                          onClick={() => handleAiGenerate(milestone.id)}
                          disabled={isGenerating}
                          className="ai-suggest-btn"
                        >
                          {mData.items.length === 0 ? "Auto-Suggest Materials" : "Suggest More"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Grand Total Summary Card - Placed BELOW stage cards as per requirement */}
        <div className="grand-total-section">
          <div className="total-card p-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm uppercase font-semibold text-blue-600 mb-1">Grand Total Estimate</h3>
              <p className="text-slate-500 text-sm">
                {totalItems} materials • {itemsWithQty} with quantities
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-slate-900">{formatCurrency(totalMaterials)}</div>
              <div className="text-sm text-slate-500">{formatCurrency(totalMaterials, true)}</div>
            </div>
          </div>
        </div>

        {/* Floating Summary Bar */}
        <div className="floating-summary-bar">
          <div className="floating-summary-content">
            <div className="floating-summary-info">
              <Stack size={20} className="text-blue-500" />
              <span className="floating-total">{formatCurrency(totalMaterials)}</span>
              <span className="floating-items">{totalItems} items</span>
            </div>
            <Button
              variant="primary"
              icon={<DownloadSimple size={16} />}
              size="sm"
              onClick={() => alert('Download feature coming soon!')}
            >
              Export
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="boq-wizard-container">
      <WizardStyles />
      {/* Unified Step Progress Bar */}
      <div className="step-progress-bar">
        {steps.map((step, index) => (
          <div key={step.number} className="step-progress-item">
            <div className={`step-node ${currentStep >= step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}>
              {currentStep > step.number ? <Check size={16} weight="bold" /> : step.number}
            </div>
            <span className={`step-label ${currentStep >= step.number ? 'active' : ''}`}>{step.label}</span>
            {index < steps.length - 1 && (
              <div className={`step-connector ${currentStep > step.number ? 'active' : ''}`} />
            )}
          </div>
        ))}
      </div>

      <div className="wizard-step">
        {currentStep === 1 && (
          <div className="step-content">
            <div className="step-header">
              <h2>Project Details</h2>
              <p>Start by giving your project a name and location.</p>
            </div>
            <div className="wizard-card p-8 max-w-xl mx-auto">
              <div className="form-group">
                <label className="wizard-label">Project Name</label>
                <Input
                  className="wizard-select"
                  placeholder="e.g. Mabelreign Extension"
                  value={projectDetails.name}
                  onChange={(e) => setProjectDetails({ ...projectDetails, name: e.target.value })}
                />
              </div>
              <div className="form-group mt-4">
                <label className="wizard-label">Location</label>
                <div className="select-wrapper">
                  <select
                    className="wizard-select"
                    value={projectDetails.location}
                    onChange={(e) => setProjectDetails({ ...projectDetails, location: e.target.value })}
                  >
                    <option value="">Select Location</option>
                    <option value="harare">Harare</option>
                    <option value="bulawayo">Bulawayo</option>
                    <option value="mutare">Mutare</option>
                    <option value="gweru">Gweru</option>
                  </select>
                  <CaretDown className="select-icon" size={16} />
                </div>
              </div>

              <div className="wizard-actions">
                <Button
                  variant="primary"
                  onClick={goToNextStep}
                  icon={<ArrowRight size={18} />}
                >
                  Next Step
                </Button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="step-content">
            <div className="step-header">
              <h2>Define Scope</h2>
              <p>Are you building the whole house or just a stage?</p>
            </div>

            <div className="scope-selection">
              <div
                className={`scope-card ${projectScope === 'entire' ? 'selected' : ''
                  }`}
                onClick={() => setProjectScope('entire')}
              >
                <div className="scope-icon">
                  <HouseSimple
                    size={32}
                    weight={projectScope === 'entire' ? 'fill' : 'regular'}
                  />
                </div>
                <div className="scope-content">
                  <h3>Entire House</h3>
                  <p>
                    Full project from foundation to finish. Best for new
                    builds.
                  </p>
                </div>
                {projectScope === 'entire' && (
                  <CheckCircle
                    className="check-icon"
                    size={24}
                    weight="fill"
                  />
                )}
              </div>

              <div
                className={`scope-card ${projectScope === 'stage' ? 'selected' : ''
                  }`}
                onClick={() => setProjectScope('stage')}
              >
                <div className="scope-icon">
                  <Stack
                    size={32}
                    weight={projectScope === 'stage' ? 'fill' : 'regular'}
                  />
                </div>
                <div className="scope-content">
                  <h3>Specific Stage</h3>
                  <p>
                    Focus on one phase like Substructure, Roofing, or
                    Finishing.
                  </p>
                </div>
                {projectScope === 'stage' && (
                  <CheckCircle
                    className="check-icon"
                    size={24}
                    weight="fill"
                  />
                )}
              </div>
            </div>

            {projectScope === 'stage' && (
              <div className="stage-selector-container">
                <div className="stage-grid">
                  {milestones.filter(m => m.id !== 'labor').map((m) => (
                    <div
                      key={m.id}
                      className={`stage-card ${selectedStages.includes(m.id) ? 'selected' : ''
                        }`}
                      onClick={() => toggleStageSelection(m.id)}
                    >
                      <div className="stage-icon">
                        <m.icon
                          size={32}
                          weight={
                            selectedStages.includes(m.id)
                              ? 'fill'
                              : 'regular'
                          }
                        />
                      </div>
                      <span>{m.label}</span>
                      {selectedStages.includes(m.id) && (
                        <CheckCircle
                          className="stage-check"
                          size={20}
                          weight="fill"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="wizard-actions">
              <Button variant="secondary" onClick={goToPrevStep}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={goToNextStep}
                icon={<ArrowRight size={18} />}
              >
                Next Step
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="step-content">
            <div className="step-header">
              <h2>Labor Options</h2>
              <p>Do you want to include labor cost estimates?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
              <div
                className={`scope-card ${laborType === 'materials_only' ? 'selected' : ''}`}
                onClick={() => setLaborType('materials_only')}
              >
                <div className="scope-icon"><Cube size={32} weight={laborType === 'materials_only' ? 'fill' : 'regular'} /></div>
                <div className="scope-content">
                  <h3>Materials Only Estimate</h3>
                  <p>Exclude labor costs from your BOQ estimate.</p>
                </div>
                {laborType === 'materials_only' && <CheckCircle className="check-icon" size={24} weight="fill" />}
              </div>
              <div
                className={`scope-card ${laborType === 'materials_labor' ? 'selected' : ''}`}
                onClick={() => setLaborType('materials_labor')}
              >
                <div className="scope-icon"><UserCircle size={32} weight={laborType === 'materials_labor' ? 'fill' : 'regular'} /></div>
                <div className="scope-content">
                  <h3>Materials & Labor Estimate</h3>
                  <p>Include estimated builder and labor costs.</p>
                </div>
                {laborType === 'materials_labor' && <CheckCircle className="check-icon" size={24} weight="fill" />}
              </div>
            </div>

            <div className="wizard-actions">
              <Button variant="secondary" onClick={goToPrevStep}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={goToNextStep}
                icon={<Sparkle size={18} />}
              >
                Let&apos;s Build It
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default function BOQBuilderPage() {
  return (
    <Suspense fallback={<MainLayout><div>Loading...</div></MainLayout>}>
      <BOQBuilderContent />
    </Suspense>
  );
}


