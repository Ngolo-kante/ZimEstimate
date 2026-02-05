'use client';

import { useState, Suspense, useMemo, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useProjectAutoSave } from '@/hooks/useProjectAutoSave';
import { useAuth } from '@/components/providers/AuthProvider';
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
  Layout,
  Package,
  HardHat,
  Graph,
  House,
  Tag,
  MagnifyingGlass,
  X,
  CloudCheck,
  CloudArrowUp,
  Warning,
  MapPin,
  WhatsappLogo,
  FloppyDisk,
  EnvelopeSimple,
  ChatText,
  FilePdf,
  FileXls,
  FileDoc,
  ShareNetwork,
} from '@phosphor-icons/react';
import SavingOverlay from '@/components/ui/SavingOverlay';
import {
  materials as allMaterials,
  getBestPrice,
} from '@/lib/materials';
import { applyAveragePriceUpdate, calculateVariance, getScaledPriceZwg } from '@/lib/boqPricing';
import { exportBOQToPDF } from '@/lib/pdf-export';
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
    lastUpdated: bestPrice?.lastUpdated || '',
    description: m.specifications || '',
  };
});

// Get unique categories (kept for future use)
const _categories = [...new Set(materialCatalog.map(m => m.category))];

const SYSTEM_PRICE_VERSION = materialCatalog.reduce((latest, material) => {
  if (material.lastUpdated && material.lastUpdated > latest) {
    return material.lastUpdated;
  }
  return latest;
}, '');

const LOCATION_TYPES = [
  { value: 'urban', label: 'Urban', description: 'City & town locations', icon: HouseSimple },
  { value: 'peri-urban', label: 'Peri-Urban', description: 'Outer city and growth areas', icon: House },
  { value: 'rural', label: 'Rural', description: 'Farms, villages & remote sites', icon: MapPin },
];

const BUILDING_TYPES = [
  { value: 'single_storey', label: 'Single Storey', description: 'One level above ground', icon: House },
  { value: 'double_storey', label: 'Double Storey', description: 'Two levels above ground', icon: Stack },
];

const DEFAULT_ROOM_INPUTS = {
  bedrooms: '',
  diningRoom: '',
  veranda: '',
  bathrooms: '',
  kitchen: '',
  pantry: '',
  livingRoom: '',
  garage1: '',
  garage2: '',
};

type RoomInputKey = keyof typeof DEFAULT_ROOM_INPUTS;

const ROOM_INPUTS: Array<{ key: RoomInputKey; label: string }> = [
  { key: 'bedrooms', label: 'Bedrooms' },
  { key: 'diningRoom', label: 'Dining Room' },
  { key: 'veranda', label: 'Veranda' },
  { key: 'bathrooms', label: 'Bathrooms' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'pantry', label: 'Pantry' },
  { key: 'livingRoom', label: 'Living Room' },
  { key: 'garage1', label: 'Garage 1' },
  { key: 'garage2', label: 'Garage 2' },
];

const LOCATION_TYPE_LABELS: Record<string, string> = {
  urban: 'Urban',
  'peri-urban': 'Peri-Urban',
  rural: 'Rural',
};

const buildLocationLabel = (locationType: string, specificLocation: string) => {
  const label = LOCATION_TYPE_LABELS[locationType] || '';
  if (!label && !specificLocation) return '';
  if (!label) return specificLocation;
  if (!specificLocation) return label;
  return `${label} — ${specificLocation}`;
};

const parseLocation = (location?: string | null) => {
  if (!location) return { locationType: '', specificLocation: '' };
  const parts = location.split(' — ');
  const possibleLabel = parts[0];
  const matchedType = Object.keys(LOCATION_TYPE_LABELS).find(
    (key) => LOCATION_TYPE_LABELS[key] === possibleLabel
  );
  if (matchedType) {
    return {
      locationType: matchedType,
      specificLocation: parts.slice(1).join(' — ').trim(),
    };
  }
  return { locationType: '', specificLocation: location };
};

interface BOQItem {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number | null;
  unit: string;
  averagePriceUsd: number;
  averagePriceZwg: number;
  actualPriceUsd: number;
  actualPriceZwg: number;
  description?: string;
  category?: string; // Added for sorting
}

interface MilestoneData {
  id: string;
  items: BOQItem[];
  expanded: boolean;
}

interface ProjectDetailsState {
  name: string;
  locationType: string;
  specificLocation: string;
  floorPlanSize: string;
  buildingType: string;
  roomInputs: Record<RoomInputKey, string>;
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
    case 'bricks': return <Layout size={16} weight="duotone" className="text-blue-600" />;
    case 'cement': return <Package size={16} weight="duotone" className="text-blue-500" />;
    case 'sand':
    case 'aggregates': return <HardHat size={16} weight="duotone" className="text-blue-400" />;
    case 'steel': return <Graph size={16} weight="duotone" className="text-blue-700" />;
    case 'roofing': return <House size={16} weight="duotone" className="text-blue-500" />;
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
    <div className="relative w-full" ref={wrapperRef} style={{ zIndex: 1000 }} data-testid="material-dropdown">
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
                data-testid="material-search-input"
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
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [showSaveOverlay, setShowSaveOverlay] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [saveOverlayMessage, setSaveOverlayMessage] = useState('Creating your project...');
  const [saveOverlaySuccess, setSaveOverlaySuccess] = useState(false);
  const [saveOverlaySteps, setSaveOverlaySteps] = useState<Array<{ label: string; status: 'pending' | 'active' | 'done' }>>([]);

  // Get project ID from URL if editing existing project
  const projectIdFromUrl = searchParams.get('id');
  const [projectPriceVersion, setProjectPriceVersion] = useState<string>(SYSTEM_PRICE_VERSION);
  const [priceVersionReady, setPriceVersionReady] = useState(false);

  // State from URL params (kept for future use)
  const _projectType = searchParams.get('type') || 'residential';
  const [projectScope, setProjectScope] = useState(searchParams.get('scope') || 'full');

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedStages, setSelectedStages] = useState<string[]>(['substructure']);

  // Project Details State
  const [projectDetails, setProjectDetails] = useState<ProjectDetailsState>({
    name: '',
    locationType: '',
    specificLocation: '',
    floorPlanSize: '',
    buildingType: '',
    roomInputs: { ...DEFAULT_ROOM_INPUTS },
  });

  const locationLabel = useMemo(
    () => buildLocationLabel(projectDetails.locationType, projectDetails.specificLocation),
    [projectDetails.locationType, projectDetails.specificLocation]
  );

  const projectDetailsForSave = useMemo(
    () => ({
      name: projectDetails.name,
      location: locationLabel,
    }),
    [projectDetails.name, locationLabel]
  );

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

  // Auto-save hook for database persistence
  const {
    project,
    isSaving,
    isLoading,
    lastSaved,
    hasUnsavedChanges,
    error: saveError,
    saveNow,
    createNewProject,
    markChanged,
  } = useProjectAutoSave(
    projectDetailsForSave,
    projectScope === 'stage' ? 'stage' : 'entire',
    selectedStages,
    laborType,
    milestonesState,
    {
      projectId: projectIdFromUrl,
      autoSaveInterval: 30000, // 30 seconds
      onLoadComplete: (loadedProject, items) => {
        // Restore project details
        const parsedLocation = parseLocation(loadedProject.location);
        setProjectDetails({
          name: loadedProject.name,
          locationType: parsedLocation.locationType,
          specificLocation: parsedLocation.specificLocation,
          floorPlanSize: '',
          buildingType: '',
          roomInputs: { ...DEFAULT_ROOM_INPUTS },
        });

        // Restore scope and labor preference
        const savedStages = loadedProject.selected_stages && loadedProject.selected_stages.length > 0
          ? loadedProject.selected_stages
          : (loadedProject.scope !== 'entire_house' ? [loadedProject.scope] : []);
        if (savedStages.length > 0) {
          setProjectScope('stage');
          setSelectedStages(savedStages);
        } else {
          setProjectScope('entire');
        }
        setLaborType(loadedProject.labor_preference === 'with_labor' ? 'materials_labor' : 'materials_only');

        // Restore BOQ items grouped by category/milestone
        if (items.length > 0) {
          setMilestonesState(prev => {
            const newState = [...prev];
            items.forEach(item => {
              const milestoneIndex = newState.findIndex(m => m.id === item.category);
              if (milestoneIndex !== -1) {
                const material = materialCatalog.find(m => m.id === item.material_id);
                const averagePriceUsd = material?.priceUsd ?? item.unit_price_usd;
                const averagePriceZwg = material?.priceZwg ?? item.unit_price_zwg;
                const actualPriceUsd = item.unit_price_usd;
                const actualPriceZwg = item.unit_price_zwg ??
                  getScaledPriceZwg(actualPriceUsd, averagePriceUsd, averagePriceZwg, exchangeRate);

                newState[milestoneIndex].items.push({
                  id: item.id,
                  materialId: item.material_id,
                  materialName: item.material_name,
                  quantity: item.quantity,
                  unit: item.unit,
                  averagePriceUsd,
                  averagePriceZwg,
                  actualPriceUsd,
                  actualPriceZwg,
                  description: item.notes || undefined,
                  category: item.category,
                });
              }
            });
            return newState;
          });

          // Jump to step 4 if we have items
          setCurrentStep(4);
        }
      },
    }
  );

  const projectPriceKey = useMemo(
    () => `boq_price_version_${project?.id ?? projectIdFromUrl ?? 'draft'}`,
    [project?.id, projectIdFromUrl]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPriceVersionReady(false);
    const storedVersion = localStorage.getItem(projectPriceKey);
    const nextVersion = storedVersion || SYSTEM_PRICE_VERSION;
    localStorage.setItem(projectPriceKey, nextVersion);
    setProjectPriceVersion(nextVersion);
    setPriceVersionReady(true);
  }, [projectPriceKey]);

  useEffect(() => {
    if (!priceVersionReady || typeof window === 'undefined') return;
    localStorage.setItem(projectPriceKey, projectPriceVersion);
  }, [projectPriceKey, projectPriceVersion, priceVersionReady]);

  // Mark changes when milestone data changes (after initial load)
  useEffect(() => {
    if (project && currentStep === 4) {
      markChanged();
    }
  }, [milestonesState, project, currentStep, markChanged]);

  useEffect(() => {
    if (project && currentStep >= 2) {
      markChanged();
    }
  }, [projectScope, selectedStages, laborType, project, currentStep, markChanged]);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowShareMenu(false);
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Derived state
  const totalAmount = useMemo(() => {
    return milestonesState.reduce((total, ms) => {
      const msTotal = ms.items.reduce((t, item) => t + ((item.quantity || 0) * item.actualPriceUsd), 0);
      return total + msTotal;
    }, 0);
  }, [milestonesState]);

  const calculateMilestoneTotal = (items: BOQItem[]) => {
    return items.reduce((acc, item) => {
      return acc + (item.quantity || 0) * item.actualPriceUsd;
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

  const goToNextStep = async () => {
    if (currentStep === 1) {
      const floorPlanValue = Number(projectDetails.floorPlanSize);
      if (
        !projectDetails.name.trim() ||
        !projectDetails.locationType ||
        !projectDetails.buildingType ||
        !floorPlanValue ||
        floorPlanValue <= 0
      ) {
        alert('Please fill in project name, location type, floor plan size, and building type');
        return;
      }
    }
    if (currentStep === 2 && projectScope === 'stage' && selectedStages.length === 0) {
      alert('Please select at least one stage');
      return;
    }

    // Create project in database when moving from step 1 (if authenticated and no project yet)
    if (currentStep === 1 && isAuthenticated && !project) {
      const projectId = await createNewProject(projectDetailsForSave);
      if (!projectId) {
        // Project creation failed, but allow continuing in offline mode
        console.warn('Failed to create project in database, continuing locally');
      }
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

  const handleUpdateActualPrice = (milestoneId: string, itemId: string, price: number) => {
    setMilestonesState(prev => prev.map(m => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        items: m.items.map(item => {
          if (item.id !== itemId) return item;
          const nextActualPriceZwg = getScaledPriceZwg(price, item.averagePriceUsd, item.averagePriceZwg, exchangeRate);
          return { ...item, actualPriceUsd: price, actualPriceZwg: nextActualPriceZwg };
        })
      };
    }));
  };

  const handleUpdateAveragePrices = () => {
    setMilestonesState(prev => prev.map(m => ({
      ...m,
      items: m.items.map(item => {
        const material = materialCatalog.find(mat => mat.id === item.materialId);
        if (!material) return item;
        const nextAverageUsd = material.priceUsd;
        const nextAverageZwg = material.priceZwg;
        const updatedPricing = applyAveragePriceUpdate(
          {
            averagePriceUsd: item.averagePriceUsd,
            averagePriceZwg: item.averagePriceZwg,
            actualPriceUsd: item.actualPriceUsd,
          },
          nextAverageUsd,
          nextAverageZwg,
          exchangeRate
        );

        return { ...item, ...updatedPricing };
      })
    })));

    setProjectPriceVersion(SYSTEM_PRICE_VERSION);
  };

  const handleKeepCurrentPrices = () => {
    setProjectPriceVersion(SYSTEM_PRICE_VERSION);
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
        averagePriceUsd: material.priceUsd,
        averagePriceZwg: material.priceZwg,
        actualPriceUsd: material.priceUsd,
        actualPriceZwg: material.priceZwg,
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
          averagePriceUsd: mat.priceUsd,
          averagePriceZwg: mat.priceZwg,
          actualPriceUsd: mat.priceUsd,
          actualPriceZwg: mat.priceZwg,
          description: mat.description
        } as BOQItem;
      }).filter(Boolean) as BOQItem[];

      return { ...m, items: newItems, expanded: true };
    }));

    setIsGenerating(false);
  };

  const handleSaveProject = async () => {
    // Check if user is authenticated
    if (isAuthenticated) {
      setShowSaveOverlay(true);
      setSaveOverlayMessage('Creating your project...');
      setSaveOverlaySuccess(false);
      setSaveOverlaySteps([
        { label: 'Creating project', status: 'active' },
        { label: 'Setting timelines', status: 'pending' },
        { label: 'Creating substages', status: 'pending' },
        { label: 'Saving BOQ items', status: 'pending' },
      ]);

      try {
        const setStepState = (activeIndex: number, message: string) => {
          setSaveOverlayMessage(message);
          setSaveOverlaySteps(prev => prev.map((step, index) => {
            if (index < activeIndex) return { ...step, status: 'done' };
            if (index === activeIndex) return { ...step, status: 'active' };
            return { ...step, status: 'pending' };
          }));
        };

        // Step 1: Create project (if needed)
        if (!project) {
          setStepState(0, 'Creating your project...');
          const newProjectId = await createNewProject(projectDetailsForSave);
          if (!newProjectId) {
            throw new Error('Failed to create project');
          }
        }

        // Step 2: Timelines
        setStepState(1, 'Setting timelines...');
        await new Promise(resolve => setTimeout(resolve, 400));

        // Step 3: Stages
        setStepState(2, 'Creating substages...');
        await new Promise(resolve => setTimeout(resolve, 400));

        // Step 4: Save BOQ
        setStepState(3, 'Saving BOQ items...');
        await saveNow();

        // Show success state briefly
        setSaveOverlaySteps(prev => prev.map(step => ({ ...step, status: 'done' })));
        setSaveOverlaySuccess(true);
        setSaveOverlayMessage('Project saved!');

        // Wait a moment to show success, then redirect
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Redirect to projects page after save
        router.push('/projects?refresh=1');
      } catch (err) {
        setShowSaveOverlay(false);
        // Error handling is done by the hook
      }
    } else {
      setShowSavePrompt(true);
    }
  };

  // Step definitions - moved here so it's available in all code paths
  const steps = [
    { number: 1, label: 'Project Info' },
    { number: 2, label: 'Scope' },
    { number: 3, label: 'Labor' },
    { number: 4, label: 'Build BOQ' },
  ];

  const showPriceUpdateBanner = priceVersionReady && projectPriceVersion !== SYSTEM_PRICE_VERSION;

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
      return total + ms.items.reduce((t, item) => t + ((item.quantity || 0) * item.actualPriceUsd), 0);
    }, 0);
    const totalItems = milestonesState.reduce((acc, m) => acc + m.items.length, 0);
    const itemsWithQty = milestonesState.reduce((acc, m) =>
      acc + m.items.filter(i => i.quantity && i.quantity > 0).length, 0);

    return (
      <MainLayout title="Build BOQ">
        <WizardStyles />
        <div className="boq-builder">
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

          {showPriceUpdateBanner && (
            <div className="price-update-banner">
              <div className="price-update-content">
                <div className="price-update-text">
                  <h4>🇿🇼 Average prices have been updated this week.</h4>
                  <p>Would you like to update your project costing?</p>
                </div>
              </div>
              <div className="price-update-actions">
                <Button variant="primary" onClick={handleUpdateAveragePrices}>
                  Update Prices
                </Button>
                <Button variant="secondary" onClick={handleKeepCurrentPrices}>
                  Keep Current Prices
                </Button>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="builder-header">
            <div>
              <h1>{projectDetails.name || 'New Project'}</h1>
              <div className="builder-meta">
                <span>{locationLabel || 'Location not set'}</span>
                <span className="meta-dot">•</span>
                <span>{selectedStages.length > 0 ? `${selectedStages.length} Stages` : 'Entire House'}</span>
                {/* Save Status Indicator */}
                {isAuthenticated && (
                  <>
                    <span className="meta-dot">•</span>
                    <span className={`save-status ${isSaving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'}`}>
                      {isSaving ? (
                        <><CloudArrowUp size={14} className="animate-pulse" /> Saving...</>
                      ) : hasUnsavedChanges ? (
                        <><Warning size={14} /> Unsaved changes</>
                      ) : lastSaved ? (
                        <><CloudCheck size={14} /> Saved</>
                      ) : null}
                    </span>
                  </>
                )}
              </div>
              {saveError && (
                <div className="builder-error">{saveError}</div>
              )}
            </div>
            <div className="header-actions">
              <Button variant="secondary" onClick={goToPrevStep}>Edit Details</Button>
              <Button
                variant="primary"
                onClick={handleSaveProject}
                loading={isSaving}
                icon={<FloppyDisk size={18} />}
              >
                {isAuthenticated ? 'Save & View Projects' : 'Save Project'}
              </Button>
              {/* Share Dropdown */}
              <div className="dropdown-container" style={{ position: 'relative' }}>
                <Button
                  variant="ghost"
                  icon={<ShareNetwork size={18} />}
                  onClick={() => {
                    setShowShareMenu(!showShareMenu);
                    setShowExportMenu(false);
                  }}
                >
                  Share
                </Button>
                {showShareMenu && (
                  <div className="dropdown-menu" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    minWidth: '180px',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                    border: '1px solid #e2e8f0',
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        const summary = `*${projectDetails.name || 'BOQ Estimate'}*\n` +
                          `Location: ${locationLabel || 'Not specified'}\n\n` +
                          `*Total Estimate:*\n` +
                          `USD: $${totalMaterials.toLocaleString()}\n` +
                          `ZWG: ZiG ${(totalMaterials * exchangeRate).toLocaleString()}\n\n` +
                          `Materials: ${totalItems} items\n\n` +
                          `Generated with ZimEstimate`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank');
                        setShowShareMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#334155',
                        textAlign: 'left',
                      }}
                    >
                      <WhatsappLogo size={18} weight="fill" style={{ color: '#25D366' }} />
                      WhatsApp
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        const subject = encodeURIComponent(`BOQ Estimate: ${projectDetails.name || 'Project'}`);
                        const body = encodeURIComponent(
                          `${projectDetails.name || 'BOQ Estimate'}\n` +
                          `Location: ${locationLabel || 'Not specified'}\n\n` +
                          `Total Estimate:\n` +
                          `USD: $${totalMaterials.toLocaleString()}\n` +
                          `ZWG: ZiG ${(totalMaterials * exchangeRate).toLocaleString()}\n\n` +
                          `Materials: ${totalItems} items\n\n` +
                          `Generated with ZimEstimate`
                        );
                        window.location.href = `mailto:?subject=${subject}&body=${body}`;
                        setShowShareMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#334155',
                        textAlign: 'left',
                      }}
                    >
                      <EnvelopeSimple size={18} weight="fill" style={{ color: '#4E9AF7' }} />
                      Email
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        const message = encodeURIComponent(
                          `${projectDetails.name || 'BOQ Estimate'}\n` +
                          `Total: $${totalMaterials.toLocaleString()} / ZiG ${(totalMaterials * exchangeRate).toLocaleString()}\n` +
                          `${totalItems} materials - ZimEstimate`
                        );
                        window.location.href = `sms:?body=${message}`;
                        setShowShareMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#334155',
                        textAlign: 'left',
                      }}
                    >
                      <ChatText size={18} weight="fill" style={{ color: '#8B5CF6' }} />
                      SMS
                    </button>
                  </div>
                )}
              </div>

              {/* Export Dropdown */}
              <div className="dropdown-container" style={{ position: 'relative' }}>
                <Button
                  variant="primary"
                  icon={<DownloadSimple size={18} />}
                  onClick={() => {
                    setShowExportMenu(!showExportMenu);
                    setShowShareMenu(false);
                  }}
                >
                  Export
                </Button>
                {showExportMenu && (
                  <div className="dropdown-menu" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    minWidth: '180px',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                    border: '1px solid #e2e8f0',
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        const allItems = milestonesState.flatMap(ms =>
                          ms.items.map(item => ({
                            material_name: item.materialName,
                            category: ms.id,
                            quantity: item.quantity || 0,
                            unit: item.unit,
                            unit_price_usd: item.actualPriceUsd,
                            unit_price_zwg: item.actualPriceZwg,
                          }))
                        );
                        const boqData = {
                          projectName: projectDetails.name || 'Manual BOQ Project',
                          location: locationLabel,
                          totalArea: Number(projectDetails.floorPlanSize) || 0,
                          items: allItems,
                          totals: {
                            usd: totalMaterials,
                            zwg: totalMaterials * exchangeRate,
                          },
                          config: {
                            scope: projectScope === 'stage' ? selectedStages.join(', ') : 'Entire House',
                            brickType: 'Standard',
                            cementType: 'OPC',
                            includeLabor: laborType === 'materials_labor',
                          },
                        };
                        exportBOQToPDF(boqData, currency);
                        setShowExportMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#334155',
                        textAlign: 'left',
                      }}
                    >
                      <FilePdf size={18} weight="fill" style={{ color: '#EF4444' }} />
                      PDF Document
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        // Export as CSV for Excel
                        const headers = ['Material', 'Category', 'Quantity', 'Unit', 'Actual Price (USD)', 'Actual Price (ZWG)', 'Total (USD)', 'Total (ZWG)'];
                        const rows = milestonesState.flatMap(ms =>
                          ms.items.map(item => [
                            item.materialName,
                            ms.id,
                            item.quantity || 0,
                            item.unit,
                            item.actualPriceUsd.toFixed(2),
                            item.actualPriceZwg.toFixed(2),
                            ((item.quantity || 0) * item.actualPriceUsd).toFixed(2),
                            ((item.quantity || 0) * item.actualPriceZwg).toFixed(2),
                          ])
                        );
                        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `${projectDetails.name || 'BOQ'}_export.csv`;
                        link.click();
                        setShowExportMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#334155',
                        textAlign: 'left',
                      }}
                    >
                      <FileXls size={18} weight="fill" style={{ color: '#22C55E' }} />
                      Excel (CSV)
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        // Export as TXT for Word
                        let content = `${projectDetails.name || 'BOQ Estimate'}\n`;
                        content += `${'='.repeat(50)}\n\n`;
                        content += `Location: ${locationLabel || 'Not specified'}\n`;
                        content += `Date: ${new Date().toLocaleDateString()}\n\n`;
                        content += `MATERIALS LIST\n`;
                        content += `${'-'.repeat(50)}\n\n`;

                        milestonesState.forEach(ms => {
                          if (ms.items.length > 0) {
                            content += `\n${ms.id.toUpperCase()}\n`;
                            content += `${'-'.repeat(30)}\n`;
                            ms.items.forEach(item => {
                              const total = (item.quantity || 0) * item.actualPriceUsd;
                              content += `${item.materialName}\n`;
                              content += `  Qty: ${item.quantity || 0} ${item.unit} @ $${item.actualPriceUsd.toFixed(2)} = $${total.toFixed(2)}\n`;
                            });
                          }
                        });

                        content += `\n${'='.repeat(50)}\n`;
                        content += `TOTAL: $${totalMaterials.toLocaleString()} USD\n`;
                        content += `       ZiG ${(totalMaterials * exchangeRate).toLocaleString()}\n`;
                        content += `\nGenerated with ZimEstimate\n`;

                        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `${projectDetails.name || 'BOQ'}_export.txt`;
                        link.click();
                        setShowExportMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#334155',
                        textAlign: 'left',
                      }}
                    >
                      <FileDoc size={18} weight="fill" style={{ color: '#3B82F6' }} />
                      Word (TXT)
                    </button>
                  </div>
                )}
              </div>
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
                          {/* Table Header - Hidden on mobile */}
                          <div className="hidden md:grid grid-cols-[1fr_120px_120px_110px_90px_120px_110px_40px] gap-3 px-4 py-3 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest rounded-xl border border-slate-100">
                            <div>Material Description</div>
                            <div className="text-right">Average Price</div>
                            <div className="text-right">Actual Price</div>
                            <div className="text-right">Var (Absolute)</div>
                            <div className="text-right">Var %</div>
                            <div className="text-center">Quantity</div>
                            <div className="text-right">Line Total</div>
                            <div></div>
                          </div>

                          {sortMaterials(mData.items).map((item) => {
                            const { variance, variancePct } = calculateVariance(item.averagePriceUsd, item.actualPriceUsd);
                            const varianceLabel = variance === 0 ? '0.00' : `${variance > 0 ? '+' : ''}${variance.toFixed(2)}`;
                            const variancePctLabel = variancePct === null
                              ? '—'
                              : variancePct === 0
                                ? '0.0%'
                                : `${variancePct > 0 ? '+' : ''}${variancePct.toFixed(1)}%`;
                            const varianceClass = variance > 0
                              ? 'text-rose-600'
                              : variance < 0
                                ? 'text-emerald-600'
                                : 'text-slate-500';

                            return (
                              <div
                                key={item.id}
                                data-testid="boq-row"
                                className="material-row-modern group grid grid-cols-1 md:grid-cols-[1fr_120px_120px_110px_90px_120px_110px_40px] gap-3 md:gap-3 items-start md:items-center p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
                              >
                                {/* Name & Desc */}
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="font-medium text-slate-800 truncate leading-tight">{item.materialName}</span>
                                    <span className="text-xs text-slate-500 truncate mt-0.5">{item.description}</span>
                                  </div>
                                  {/* Mobile delete button */}
                                  <button
                                    onClick={() => handleRemoveItem(milestone.id, item.id)}
                                    className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                                    title="Remove item"
                                  >
                                    <Trash size={18} weight="bold" />
                                  </button>
                                </div>

                                {/* Mobile: Pricing + Qty */}
                                <div className="md:hidden mt-3 pt-3 border-t border-slate-100 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400 uppercase">Average Price</span>
                                    <span className="text-sm font-semibold text-slate-700">${item.averagePriceUsd.toFixed(2)}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-slate-400 uppercase">Actual Price</span>
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-24 pl-5 pr-2 py-1.5 text-right text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                        value={item.actualPriceUsd}
                                        onChange={(e) => handleUpdateActualPrice(milestone.id, item.id, parseFloat(e.target.value) || 0)}
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-slate-400 uppercase">Var (Absolute)</span>
                                      <span className={`text-sm font-semibold ${varianceClass}`}>{varianceLabel}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-slate-400 uppercase">Var %</span>
                                      <span className={`text-sm font-semibold ${varianceClass}`}>{variancePctLabel}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-400 uppercase">Qty</span>
                                      <input
                                        className="w-16 p-1.5 text-center text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                                        type="number"
                                        value={item.quantity || ''}
                                        onChange={(e) => handleUpdateQuantity(milestone.id, item.id, parseFloat(e.target.value))}
                                        placeholder="0"
                                      />
                                      <span className="text-[10px] text-slate-400">{item.unit}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-semibold text-slate-900">${((item.quantity || 0) * item.actualPriceUsd).toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Desktop: Average Price */}
                                <div className="hidden md:flex items-center justify-end">
                                  <span data-testid="boq-average-price" className="text-sm font-semibold text-slate-700">
                                    ${item.averagePriceUsd.toFixed(2)}
                                  </span>
                                </div>

                                {/* Desktop: Actual Price Edit */}
                                <div className="hidden md:flex items-center justify-end">
                                  <div className="relative group/input">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold transition-colors group-focus-within/input:text-blue-500">$</span>
                                    <input
                                      data-testid="boq-actual-price"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="w-24 pl-5 pr-2 py-2 text-right text-sm font-medium text-slate-700 bg-slate-50 border border-transparent rounded-lg focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                      value={item.actualPriceUsd}
                                      onChange={(e) => handleUpdateActualPrice(milestone.id, item.id, parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>

                                {/* Desktop: Var (Absolute) */}
                                <div className="hidden md:flex items-center justify-end">
                                  <span data-testid="boq-var-abs" className={`text-sm font-semibold ${varianceClass}`}>
                                    {varianceLabel}
                                  </span>
                                </div>

                                {/* Desktop: Var % */}
                                <div className="hidden md:flex items-center justify-end">
                                  <span data-testid="boq-var-pct" className={`text-sm font-semibold ${varianceClass}`}>
                                    {variancePctLabel}
                                  </span>
                                </div>

                                {/* Desktop: Quantity Edit */}
                                <div className="hidden md:flex justify-center">
                                  <div className="flex items-center bg-slate-50 border border-transparent rounded-lg focus-within:bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100 transition-all w-28 overflow-hidden">
                                    <input
                                      className="w-full p-2 text-center text-sm font-medium text-slate-700 outline-none bg-transparent"
                                      type="number"
                                      value={item.quantity || ''}
                                      onChange={(e) => handleUpdateQuantity(milestone.id, item.id, parseFloat(e.target.value))}
                                      placeholder="0"
                                    />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase pr-2 pl-1">
                                      {item.unit}
                                    </span>
                                  </div>
                                </div>

                                {/* Desktop: Total */}
                                <div className="hidden md:block text-right">
                                  <div className="text-xs font-bold text-slate-400 mb-0.5 uppercase tracking-tighter">Total</div>
                                  <div className="font-semibold text-slate-900">
                                    ${((item.quantity || 0) * item.actualPriceUsd).toFixed(2)}
                                  </div>
                                </div>

                                {/* Desktop: Remove */}
                                <div className="hidden md:flex justify-end">
                                  <button
                                    onClick={() => handleRemoveItem(milestone.id, item.id)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                    title="Remove item"
                                  >
                                    <Trash size={18} weight="bold" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
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

        {/* Saving Overlay */}
        <SavingOverlay
          isVisible={showSaveOverlay}
          message={saveOverlayMessage}
          success={saveOverlaySuccess}
          steps={saveOverlaySteps}
        />

        {/* Save Prompt Modal */}
        {showSavePrompt && (
          <div className="modal-overlay" onClick={() => setShowSavePrompt(false)}>
            <div className="save-modal" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <div className="modal-icon">
                <FloppyDisk size={32} weight="light" />
              </div>
              <h3>Save to Your Projects</h3>
              <p>Sign in or create an account to save this BOQ and access it anytime from your dashboard.</p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowSavePrompt(false)} style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)'
                }}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => window.location.href = '/auth/login?redirect=/boq/new'}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: 'var(--color-text-inverse)'
                  }}
                >
                  Sign In
                </button>
                <button
                  className="btn btn-accent"
                  onClick={() => window.location.href = '/auth/register?redirect=/boq/new'}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'var(--color-accent)',
                    color: 'white'
                  }}
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        )}
      </MainLayout>
    );
  }

  return (
    <MainLayout title="New Project">
      <WizardStyles />
      <div className="boq-wizard-container">
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
                <p>Set your project name, location type, and floor plan details to start estimating.</p>
              </div>
              <div className="wizard-card wizard-card--stack" style={{ maxWidth: '720px', margin: '0 auto' }}>
                <div className="wizard-section">
                  <div className="wizard-section-header">
                    <div>
                      <div className="section-kicker">Project Details</div>
                      <h3>Project Details</h3>
                      <p>Give your project a name and choose the location type.</p>
                    </div>
                  </div>

                  <div className="wizard-grid">
                    <div className="form-group grid-span-2">
                      <label className="wizard-label">
                        <House size={18} weight="light" />
                        Project Name
                        <span className="required">*</span>
                      </label>
                      <Input
                        className="wizard-select"
                        placeholder="e.g. Borrowdale 4-Bedroom House"
                        value={projectDetails.name}
                        onChange={(e) => setProjectDetails({ ...projectDetails, name: e.target.value })}
                      />
                    </div>

                    <div className="form-group grid-span-2">
                      <label className="wizard-label">
                        <MapPin size={18} weight="light" />
                        Location Type
                        <span className="required">*</span>
                      </label>
                      <div className="pill-grid" role="radiogroup" aria-label="Location Type">
                        {LOCATION_TYPES.map((option) => {
                          const Icon = option.icon;
                          const isSelected = projectDetails.locationType === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={`pill-option ${isSelected ? 'selected' : ''}`}
                              onClick={() => setProjectDetails({ ...projectDetails, locationType: option.value })}
                              aria-pressed={isSelected}
                              data-testid={`location-type-${option.value}`}
                            >
                              <span className="pill-icon">
                                <Icon size={18} weight={isSelected ? 'fill' : 'light'} />
                              </span>
                              <span className="pill-content">
                                <span className="pill-title">{option.label}</span>
                                <span className="pill-subtitle">{option.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="form-group grid-span-2">
                      <label className="wizard-label">
                        <MapPin size={18} weight="light" />
                        Specific Location
                        <span className="optional">(Optional)</span>
                      </label>
                      <Input
                        className="wizard-select"
                        placeholder="e.g. Borrowdale, Harare"
                        value={projectDetails.specificLocation}
                        onChange={(e) => setProjectDetails({ ...projectDetails, specificLocation: e.target.value })}
                      />
                      <span className="wizard-hint">
                        Add a suburb or area to keep projects organized.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="wizard-divider" />

                <div className="wizard-section">
                  <div className="wizard-section-header">
                    <div>
                      <div className="section-kicker">Floor Plan Details</div>
                      <h3>Floor Plan Details</h3>
                      <p>Capture the total floor area and building type.</p>
                    </div>
                  </div>

                  <div className="wizard-grid">
                    <div className="form-group">
                      <label className="wizard-label">
                        <Layout size={18} weight="light" />
                        Floor Plan Size
                        <span className="required">*</span>
                      </label>
                      <div className="input-with-suffix">
                        <input
                          type="number"
                          min="1"
                          step="0.1"
                          className="wizard-select"
                          placeholder="e.g. 240"
                          value={projectDetails.floorPlanSize}
                          onChange={(e) => setProjectDetails({ ...projectDetails, floorPlanSize: e.target.value })}
                        />
                        <span className="input-suffix">m²</span>
                      </div>
                      <span className="wizard-hint">Total floor area of the plan.</span>
                    </div>

                    <div className="form-group">
                      <label className="wizard-label">
                        <HouseSimple size={18} weight="light" />
                        Building Type
                        <span className="required">*</span>
                      </label>
                      <div className="pill-grid pill-grid--two" role="radiogroup" aria-label="Building Type">
                        {BUILDING_TYPES.map((option) => {
                          const Icon = option.icon;
                          const isSelected = projectDetails.buildingType === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={`pill-option ${isSelected ? 'selected' : ''}`}
                              onClick={() => setProjectDetails({ ...projectDetails, buildingType: option.value })}
                              aria-pressed={isSelected}
                              data-testid={`building-type-${option.value}`}
                            >
                              <span className="pill-icon">
                                <Icon size={18} weight={isSelected ? 'fill' : 'light'} />
                              </span>
                              <span className="pill-content">
                                <span className="pill-title">{option.label}</span>
                                <span className="pill-subtitle">{option.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="optional-rooms">
                    <div className="optional-header">
                      <div>
                        <h4>Optional Room Inputs</h4>
                        <p>These help refine future estimates and remain optional.</p>
                      </div>
                      <span className="optional-chip">Optional</span>
                    </div>
                    <div className="room-grid">
                      {ROOM_INPUTS.map((room) => (
                        <div key={room.key} className="room-input">
                          <label>{room.label}</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={projectDetails.roomInputs[room.key]}
                            onChange={(e) =>
                              setProjectDetails({
                                ...projectDetails,
                                roomInputs: {
                                  ...projectDetails.roomInputs,
                                  [room.key]: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="wizard-actions">
                  <div></div>
                  <Button
                    variant="primary"
                    onClick={goToNextStep}
                    icon={<ArrowRight size={18} />}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-content">
              <div className="step-header">
                <h2>Define Project Scope</h2>
                <p>Are you building the whole house or focusing on a specific stage?</p>
              </div>

              <div className="scope-selection">
                <div
                  className={`scope-card ${projectScope === 'entire' ? 'selected' : ''}`}
                  onClick={() => setProjectScope('entire')}
                >
                  <div className="scope-icon">
                    <HouseSimple
                      size={32}
                      weight={projectScope === 'entire' ? 'fill' : 'light'}
                    />
                  </div>
                  <div className="scope-content">
                    <h3>Entire House</h3>
                    <p>Full project from foundation to finish. Best for new builds.</p>
                  </div>
                  {projectScope === 'entire' && (
                    <CheckCircle className="check-icon" size={24} weight="fill" />
                  )}
                </div>

                <div
                  className={`scope-card ${projectScope === 'stage' ? 'selected' : ''}`}
                  onClick={() => setProjectScope('stage')}
                >
                  <div className="scope-icon">
                    <Stack
                      size={32}
                      weight={projectScope === 'stage' ? 'fill' : 'light'}
                    />
                  </div>
                  <div className="scope-content">
                    <h3>Specific Stage</h3>
                    <p>Focus on one phase like Substructure, Roofing, or Finishing.</p>
                  </div>
                  {projectScope === 'stage' && (
                    <CheckCircle className="check-icon" size={24} weight="fill" />
                  )}
                </div>
              </div>

              {projectScope === 'stage' && (
                <div className="stage-selector-container">
                  <div className="stage-grid">
                    {milestones.filter(m => m.id !== 'labor').map((m) => (
                      <div
                        key={m.id}
                        className={`stage-card ${selectedStages.includes(m.id) ? 'selected' : ''}`}
                        onClick={() => toggleStageSelection(m.id)}
                      >
                        <div className="stage-icon">
                          <m.icon
                            size={28}
                            weight={selectedStages.includes(m.id) ? 'fill' : 'light'}
                          />
                        </div>
                        <span>{m.label}</span>
                        {selectedStages.includes(m.id) && (
                          <CheckCircle className="stage-check" size={18} weight="fill" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="wizard-actions" style={{ maxWidth: '700px', margin: '32px auto 0 auto' }}>
                <Button variant="secondary" onClick={goToPrevStep}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={goToNextStep}
                  icon={<ArrowRight size={18} />}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-content">
              <div className="step-header">
                <h2>Labor Options</h2>
                <p>Do you want to include labor cost estimates in your BOQ?</p>
              </div>

              <div className="scope-selection">
                <div
                  className={`scope-card ${laborType === 'materials_only' ? 'selected' : ''}`}
                  onClick={() => setLaborType('materials_only')}
                >
                  <div className="scope-icon">
                    <Package size={32} weight={laborType === 'materials_only' ? 'fill' : 'light'} />
                  </div>
                  <div className="scope-content">
                    <h3>Materials Only</h3>
                    <p>Calculate material costs only. Labor costs not included.</p>
                  </div>
                  {laborType === 'materials_only' && <CheckCircle className="check-icon" size={24} weight="fill" />}
                </div>
                <div
                  className={`scope-card ${laborType === 'materials_labor' ? 'selected' : ''}`}
                  onClick={() => setLaborType('materials_labor')}
                >
                  <div className="scope-icon">
                    <HardHat size={32} weight={laborType === 'materials_labor' ? 'fill' : 'light'} />
                  </div>
                  <div className="scope-content">
                    <h3>Materials & Labor</h3>
                    <p>Include estimated builder and labor costs in your estimate.</p>
                  </div>
                  {laborType === 'materials_labor' && <CheckCircle className="check-icon" size={24} weight="fill" />}
                </div>
              </div>

              <div className="tips-section">
                <h3>Tip</h3>
                <ul>
                  <li>Labor costs are based on typical Zimbabwe market rates</li>
                  <li>You can adjust individual labor line items after generation</li>
                  <li>Materials-only is useful when you have your own construction team</li>
                </ul>
              </div>

              <div className="wizard-actions" style={{ maxWidth: '700px', margin: '32px auto 0 auto' }}>
                <Button variant="secondary" onClick={goToPrevStep}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={goToNextStep}
                  icon={<Sparkle size={18} />}
                >
                  Start Building BOQ
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
export default function BOQBuilderPage() {
  return (
    <Suspense fallback={<MainLayout><div>Loading...</div></MainLayout>}>
      <BOQBuilderContent />
    </Suspense>
  );
}
