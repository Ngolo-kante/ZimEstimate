// Database type definitions for ZimEstimate
// This file defines the Supabase database schema types

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type UserTier = 'free' | 'pro' | 'admin';

export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';

export type ProjectScope = 'entire_house' | 'substructure' | 'superstructure' | 'roofing' | 'finishing' | 'exterior';

export type LaborPreference = 'materials_only' | 'with_labor';

export type MilestoneType =
    | 'substructure'
    | 'superstructure'
    | 'roofing'
    | 'finishing'
    | 'exterior';

export type AccessLevel = 'view' | 'edit';

export type Currency = 'USD' | 'ZWG';

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed';

export type StageStatus = 'planning' | 'pending_approval' | 'in_progress' | 'on_hold' | 'completed';

export type BOQCategory = 'substructure' | 'superstructure' | 'roofing' | 'finishing' | 'exterior';

export type DocumentCategory = 'plan' | 'permit' | 'receipt' | 'contract' | 'photo' | 'general';

export type SavingsFrequency = 'weekly' | 'monthly' | 'quarterly';

// Tier limits configuration
export const TIER_LIMITS = {
    free: {
        maxProjects: 3,
        aiFeatures: false,
        advancedExport: false,
    },
    pro: {
        maxProjects: Infinity,
        aiFeatures: true,
        advancedExport: true,
    },
    admin: {
        maxProjects: Infinity,
        aiFeatures: true,
        advancedExport: true,
        canManageMaterials: true,
        canManageSuppliers: true,
    },
} as const;

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    email: string;
                    full_name: string | null;
                    avatar_url: string | null;
                    tier: UserTier;
                    preferred_currency: Currency;
                    phone_number: string | null;
                    whatsapp_reminders: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    tier?: UserTier;
                    preferred_currency?: Currency;
                    phone_number?: string | null;
                    whatsapp_reminders?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    email?: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    tier?: UserTier;
                    preferred_currency?: Currency;
                    phone_number?: string | null;
                    whatsapp_reminders?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            projects: {
                Row: {
                    id: string;
                    owner_id: string;
                    name: string;
                    location: string | null;
                    description: string | null;
                    scope: ProjectScope;
                    labor_preference: LaborPreference;
                    status: ProjectStatus;
                    selected_stages: string[] | null;
                    usage_tracking_enabled: boolean;
                    usage_low_stock_alert_enabled: boolean;
                    usage_low_stock_threshold: number;
                    total_usd: number;
                    total_zwg: number;
                    target_date: string | null;
                    budget_target_usd: number | null;
                    start_date: string | null;
                    target_completion_date: string | null;
                    target_purchase_date: string | null;
                    savings_frequency: SavingsFrequency;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    owner_id: string;
                    name: string;
                    location?: string | null;
                    description?: string | null;
                    scope?: ProjectScope;
                    labor_preference?: LaborPreference;
                    status?: ProjectStatus;
                    selected_stages?: string[] | null;
                    usage_tracking_enabled?: boolean;
                    usage_low_stock_alert_enabled?: boolean;
                    usage_low_stock_threshold?: number;
                    total_usd?: number;
                    total_zwg?: number;
                    target_date?: string | null;
                    budget_target_usd?: number | null;
                    start_date?: string | null;
                    target_completion_date?: string | null;
                    target_purchase_date?: string | null;
                    savings_frequency?: SavingsFrequency;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    owner_id?: string;
                    name?: string;
                    location?: string | null;
                    description?: string | null;
                    scope?: ProjectScope;
                    labor_preference?: LaborPreference;
                    status?: ProjectStatus;
                    selected_stages?: string[] | null;
                    usage_tracking_enabled?: boolean;
                    usage_low_stock_alert_enabled?: boolean;
                    usage_low_stock_threshold?: number;
                    total_usd?: number;
                    total_zwg?: number;
                    target_date?: string | null;
                    budget_target_usd?: number | null;
                    start_date?: string | null;
                    target_completion_date?: string | null;
                    target_purchase_date?: string | null;
                    savings_frequency?: SavingsFrequency;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            boq_items: {
                Row: {
                    id: string;
                    project_id: string;
                    material_id: string;
                    material_name: string;
                    category: string;
                    quantity: number;
                    unit: string;
                    unit_price_usd: number;
                    unit_price_zwg: number;
                    total_usd: number;
                    total_zwg: number;
                    notes: string | null;
                    sort_order: number;
                    // Actual tracking fields
                    actual_quantity: number | null;
                    actual_price_usd: number | null;
                    is_purchased: boolean;
                    purchased_date: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    material_id: string;
                    material_name: string;
                    category: string;
                    quantity: number;
                    unit: string;
                    unit_price_usd: number;
                    unit_price_zwg: number;
                    total_usd?: number;
                    total_zwg?: number;
                    notes?: string | null;
                    sort_order?: number;
                    actual_quantity?: number | null;
                    actual_price_usd?: number | null;
                    is_purchased?: boolean;
                    purchased_date?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    material_id?: string;
                    material_name?: string;
                    category?: string;
                    quantity?: number;
                    unit?: string;
                    unit_price_usd?: number;
                    unit_price_zwg?: number;
                    total_usd?: number;
                    total_zwg?: number;
                    notes?: string | null;
                    sort_order?: number;
                    actual_quantity?: number | null;
                    actual_price_usd?: number | null;
                    is_purchased?: boolean;
                    purchased_date?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            project_shares: {
                Row: {
                    id: string;
                    project_id: string;
                    shared_with_user_id: string | null;
                    shared_with_email: string;
                    access_level: AccessLevel;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    shared_with_user_id?: string | null;
                    shared_with_email: string;
                    access_level?: AccessLevel;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    shared_with_user_id?: string | null;
                    shared_with_email?: string;
                    access_level?: AccessLevel;
                    created_at?: string;
                };
            };
            materials: {
                Row: {
                    id: string;
                    category: string;
                    subcategory: string | null;
                    name: string;
                    unit: string;
                    specifications: string | null;
                    price_usd: number;
                    price_zwg: number;
                    supplier_id: string | null;
                    is_active: boolean;
                    last_updated: string;
                };
                Insert: {
                    id?: string;
                    category: string;
                    subcategory?: string | null;
                    name: string;
                    unit: string;
                    specifications?: string | null;
                    price_usd: number;
                    price_zwg: number;
                    supplier_id?: string | null;
                    is_active?: boolean;
                    last_updated?: string;
                };
                Update: {
                    id?: string;
                    category?: string;
                    subcategory?: string | null;
                    name?: string;
                    unit?: string;
                    specifications?: string | null;
                    price_usd?: number;
                    price_zwg?: number;
                    supplier_id?: string | null;
                    is_active?: boolean;
                    last_updated?: string;
                };
            };
            suppliers: {
                Row: {
                    id: string;
                    name: string;
                    location: string | null;
                    contact_phone: string | null;
                    contact_email: string | null;
                    website: string | null;
                    is_trusted: boolean;
                    rating: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    location?: string | null;
                    contact_phone?: string | null;
                    contact_email?: string | null;
                    website?: string | null;
                    is_trusted?: boolean;
                    rating?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    location?: string | null;
                    contact_phone?: string | null;
                    contact_email?: string | null;
                    website?: string | null;
                    is_trusted?: boolean;
                    rating?: number;
                    created_at?: string;
                };
            };
            price_sources: {
                Row: {
                    id: string;
                    name: string;
                    source_type: string;
                    base_url: string | null;
                    parser: string;
                    selectors: Json | null;
                    headers: Json | null;
                    trust_level: number;
                    is_active: boolean;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    source_type: string;
                    base_url?: string | null;
                    parser?: string;
                    selectors?: Json | null;
                    headers?: Json | null;
                    trust_level?: number;
                    is_active?: boolean;
                    notes?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    source_type?: string;
                    base_url?: string | null;
                    parser?: string;
                    selectors?: Json | null;
                    headers?: Json | null;
                    trust_level?: number;
                    is_active?: boolean;
                    notes?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            price_observations: {
                Row: {
                    id: string;
                    source_id: string | null;
                    source_name: string | null;
                    material_key: string;
                    material_name: string | null;
                    unit: string | null;
                    price_original: number | null;
                    currency: Currency | null;
                    price_usd: number | null;
                    price_zwg: number | null;
                    location: string | null;
                    supplier_name: string | null;
                    supplier_contact: string | null;
                    url: string | null;
                    confidence: number;
                    scraped_at: string;
                    observed_at: string | null;
                };
                Insert: {
                    id?: string;
                    source_id?: string | null;
                    source_name?: string | null;
                    material_key: string;
                    material_name?: string | null;
                    unit?: string | null;
                    price_original?: number | null;
                    currency?: Currency | null;
                    price_usd?: number | null;
                    price_zwg?: number | null;
                    location?: string | null;
                    supplier_name?: string | null;
                    supplier_contact?: string | null;
                    url?: string | null;
                    confidence?: number;
                    scraped_at?: string;
                    observed_at?: string | null;
                };
                Update: {
                    id?: string;
                    source_id?: string | null;
                    source_name?: string | null;
                    material_key?: string;
                    material_name?: string | null;
                    unit?: string | null;
                    price_original?: number | null;
                    currency?: Currency | null;
                    price_usd?: number | null;
                    price_zwg?: number | null;
                    location?: string | null;
                    supplier_name?: string | null;
                    supplier_contact?: string | null;
                    url?: string | null;
                    confidence?: number;
                    scraped_at?: string;
                    observed_at?: string | null;
                };
            };
            price_weekly: {
                Row: {
                    material_key: string;
                    week_start: string;
                    avg_price_usd: number | null;
                    avg_price_zwg: number | null;
                    median_price_usd: number | null;
                    median_price_zwg: number | null;
                    min_price_usd: number | null;
                    max_price_usd: number | null;
                    min_price_zwg: number | null;
                    max_price_zwg: number | null;
                    sample_count: number;
                    last_scraped_at: string | null;
                    updated_at: string;
                };
                Insert: {
                    material_key: string;
                    week_start: string;
                    avg_price_usd?: number | null;
                    avg_price_zwg?: number | null;
                    median_price_usd?: number | null;
                    median_price_zwg?: number | null;
                    min_price_usd?: number | null;
                    max_price_usd?: number | null;
                    min_price_zwg?: number | null;
                    max_price_zwg?: number | null;
                    sample_count?: number;
                    last_scraped_at?: string | null;
                    updated_at?: string;
                };
                Update: {
                    material_key?: string;
                    week_start?: string;
                    avg_price_usd?: number | null;
                    avg_price_zwg?: number | null;
                    median_price_usd?: number | null;
                    median_price_zwg?: number | null;
                    min_price_usd?: number | null;
                    max_price_usd?: number | null;
                    min_price_zwg?: number | null;
                    max_price_zwg?: number | null;
                    sample_count?: number;
                    last_scraped_at?: string | null;
                    updated_at?: string;
                };
            };
            exchange_rates: {
                Row: {
                    id: string;
                    date: string;
                    usd_to_zwg: number;
                    source: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    date: string;
                    usd_to_zwg: number;
                    source: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    date?: string;
                    usd_to_zwg?: number;
                    source?: string;
                    created_at?: string;
                };
            };
            reminders: {
                Row: {
                    id: string;
                    user_id: string;
                    project_id: string;
                    item_id: string | null;
                    reminder_type: 'material' | 'savings' | 'deadline' | 'usage';
                    message: string;
                    scheduled_date: string;
                    is_sent: boolean;
                    phone_number: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    project_id: string;
                    item_id?: string | null;
                    reminder_type: 'material' | 'savings' | 'deadline' | 'usage';
                    message: string;
                    scheduled_date: string;
                    is_sent?: boolean;
                    phone_number: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    project_id?: string;
                    item_id?: string | null;
                    reminder_type?: 'material' | 'savings' | 'deadline' | 'usage';
                    message?: string;
                    scheduled_date?: string;
                    is_sent?: boolean;
                    phone_number?: string;
                    created_at?: string;
                };
            };
            project_recurring_reminders: {
                Row: {
                    id: string;
                    project_id: string;
                    user_id: string;
                    reminder_type: 'material' | 'savings' | 'deadline' | 'usage';
                    frequency: string;
                    channel: string;
                    amount_usd: number | null;
                    target_date: string | null;
                    next_run_at: string;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    user_id: string;
                    reminder_type: 'material' | 'savings' | 'deadline' | 'usage';
                    frequency: string;
                    channel: string;
                    amount_usd?: number | null;
                    target_date?: string | null;
                    next_run_at: string;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    user_id?: string;
                    reminder_type?: 'material' | 'savings' | 'deadline' | 'usage';
                    frequency?: string;
                    channel?: string;
                    amount_usd?: number | null;
                    target_date?: string | null;
                    next_run_at?: string;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            project_notifications: {
                Row: {
                    id: string;
                    project_id: string;
                    user_id: string;
                    type: string;
                    title: string;
                    message: string;
                    is_read: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    user_id: string;
                    type: string;
                    title: string;
                    message: string;
                    is_read?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    user_id?: string;
                    type?: string;
                    title?: string;
                    message?: string;
                    is_read?: boolean;
                    created_at?: string;
                };
            };
            procurement_requests: {
                Row: {
                    id: string;
                    project_id: string;
                    requested_by: string;
                    supplier_id: string | null;
                    supplier_name: string;
                    supplier_email: string | null;
                    supplier_phone: string | null;
                    status: string;
                    notes: string | null;
                    items: Json;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    requested_by: string;
                    supplier_id?: string | null;
                    supplier_name: string;
                    supplier_email?: string | null;
                    supplier_phone?: string | null;
                    status?: string;
                    notes?: string | null;
                    items: Json;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    requested_by?: string;
                    supplier_id?: string | null;
                    supplier_name?: string;
                    supplier_email?: string | null;
                    supplier_phone?: string | null;
                    status?: string;
                    notes?: string | null;
                    items?: Json;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            purchase_records: {
                Row: {
                    id: string;
                    project_id: string;
                    boq_item_id: string;
                    supplier_id: string | null;
                    supplier_name: string;
                    quantity: number;
                    unit_price_usd: number;
                    purchased_at: string;
                    notes: string | null;
                    created_by: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    boq_item_id: string;
                    supplier_id?: string | null;
                    supplier_name: string;
                    quantity: number;
                    unit_price_usd: number;
                    purchased_at?: string;
                    notes?: string | null;
                    created_by: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    boq_item_id?: string;
                    supplier_id?: string | null;
                    supplier_name?: string;
                    quantity?: number;
                    unit_price_usd?: number;
                    purchased_at?: string;
                    notes?: string | null;
                    created_by?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            project_documents: {
                Row: {
                    id: string;
                    project_id: string;
                    uploaded_by: string;
                    file_name: string;
                    file_type: string;
                    file_size: number;
                    storage_path: string;
                    category: DocumentCategory;
                    description: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    uploaded_by: string;
                    file_name: string;
                    file_type: string;
                    file_size: number;
                    storage_path: string;
                    category?: DocumentCategory;
                    description?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    uploaded_by?: string;
                    file_name?: string;
                    file_type?: string;
                    file_size?: number;
                    storage_path?: string;
                    category?: DocumentCategory;
                    description?: string | null;
                    created_at?: string;
                };
            };
            project_milestones: {
                Row: {
                    id: string;
                    project_id: string;
                    name: string;
                    description: string | null;
                    target_date: string | null;
                    completed_date: string | null;
                    sort_order: number;
                    status: MilestoneStatus;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    name: string;
                    description?: string | null;
                    target_date?: string | null;
                    completed_date?: string | null;
                    sort_order?: number;
                    status?: MilestoneStatus;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    name?: string;
                    description?: string | null;
                    target_date?: string | null;
                    completed_date?: string | null;
                    sort_order?: number;
                    status?: MilestoneStatus;
                    created_at?: string;
                };
            };
            milestone_tasks: {
                Row: {
                    id: string;
                    milestone_id: string;
                    title: string;
                    is_completed: boolean;
                    completed_at: string | null;
                    sort_order: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    milestone_id: string;
                    title: string;
                    is_completed?: boolean;
                    completed_at?: string | null;
                    sort_order?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    milestone_id?: string;
                    title?: string;
                    is_completed?: boolean;
                    completed_at?: string | null;
                    sort_order?: number;
                    created_at?: string;
                };
            };
            material_usage: {
                Row: {
                    id: string;
                    project_id: string;
                    boq_item_id: string;
                    recorded_by: string;
                    quantity_used: number;
                    usage_date: string;
                    notes: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    boq_item_id: string;
                    recorded_by: string;
                    quantity_used: number;
                    usage_date?: string;
                    notes?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    boq_item_id?: string;
                    recorded_by?: string;
                    quantity_used?: number;
                    usage_date?: string;
                    notes?: string | null;
                    created_at?: string;
                };
            };
            project_stages: {
                Row: {
                    id: string;
                    project_id: string;
                    boq_category: BOQCategory;
                    name: string;
                    description: string | null;
                    start_date: string | null;
                    end_date: string | null;
                    status: StageStatus;
                    sort_order: number;
                    is_applicable: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    boq_category: BOQCategory;
                    name: string;
                    description?: string | null;
                    start_date?: string | null;
                    end_date?: string | null;
                    status?: StageStatus;
                    sort_order?: number;
                    is_applicable?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    boq_category?: BOQCategory;
                    name?: string;
                    description?: string | null;
                    start_date?: string | null;
                    end_date?: string | null;
                    status?: StageStatus;
                    sort_order?: number;
                    is_applicable?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            stage_tasks: {
                Row: {
                    id: string;
                    stage_id: string;
                    title: string;
                    description: string | null;
                    assigned_to: string | null;
                    verification_note: string | null;
                    is_completed: boolean;
                    completed_at: string | null;
                    sort_order: number;
                    is_default: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    stage_id: string;
                    title: string;
                    description?: string | null;
                    assigned_to?: string | null;
                    verification_note?: string | null;
                    is_completed?: boolean;
                    completed_at?: string | null;
                    sort_order?: number;
                    is_default?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    stage_id?: string;
                    title?: string;
                    description?: string | null;
                    assigned_to?: string | null;
                    verification_note?: string | null;
                    is_completed?: boolean;
                    completed_at?: string | null;
                    sort_order?: number;
                    is_default?: boolean;
                    created_at?: string;
                };
            };
            scraper_configs: {
                Row: {
                    id: string;
                    site_name: string;
                    base_url: string;
                    price_selector: string;
                    item_name_selector: string;
                    cron_schedule: string;
                    category: string | null;
                    is_active: boolean;
                    last_successful_run_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    site_name: string;
                    base_url: string;
                    price_selector: string;
                    item_name_selector: string;
                    cron_schedule?: string;
                    category?: string | null;
                    is_active?: boolean;
                    last_successful_run_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    site_name?: string;
                    base_url?: string;
                    price_selector?: string;
                    item_name_selector?: string;
                    cron_schedule?: string;
                    category?: string | null;
                    is_active?: boolean;
                    last_successful_run_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            material_aliases: {
                Row: {
                    id: string;
                    material_id: string | null;
                    material_code: string | null;
                    alias_name: string;
                    confidence_score: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    material_id?: string | null;
                    material_code?: string | null;
                    alias_name: string;
                    confidence_score?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    material_id?: string | null;
                    material_code?: string | null;
                    alias_name?: string;
                    confidence_score?: number;
                    created_at?: string;
                };
            };
            weekly_prices: {
                Row: {
                    id: string;
                    item_name: string;
                    material_code: string | null;
                    average_price: number | null;
                    currency: string | null;
                    source_url: string | null;
                    last_updated: string;
                };
                Insert: {
                    id?: string;
                    item_name: string;
                    material_code?: string | null;
                    average_price?: number | null;
                    currency?: string | null;
                    source_url?: string | null;
                    last_updated?: string;
                };
                Update: {
                    id?: string;
                    item_name?: string;
                    material_code?: string | null;
                    average_price?: number | null;
                    currency?: string | null;
                    source_url?: string | null;
                    last_updated?: string;
                };
            };
            scraper_logs: {
                Row: {
                    id: string;
                    scraper_config_id: string | null;
                    status: 'success' | 'failure' | 'pending';
                    message: string | null;
                    scraped_data: Json | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    scraper_config_id?: string | null;
                    status: 'success' | 'failure' | 'pending';
                    message?: string | null;
                    scraped_data?: Json | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    scraper_config_id?: string | null;
                    status?: 'success' | 'failure' | 'pending';
                    message?: string | null;
                    scraped_data?: Json | null;
                    created_at?: string;
                };
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            user_tier: UserTier;
            project_status: ProjectStatus;
            project_scope: ProjectScope;
            labor_preference: LaborPreference;
            milestone_type: MilestoneType;
            access_level: AccessLevel;
            currency: Currency;
        };
    };
}

// Helper types for easier usage
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type BOQItem = Database['public']['Tables']['boq_items']['Row'];
export type ProjectShare = Database['public']['Tables']['project_shares']['Row'];
export type Material = Database['public']['Tables']['materials']['Row'];
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type ExchangeRate = Database['public']['Tables']['exchange_rates']['Row'];
export type Reminder = Database['public']['Tables']['reminders']['Row'];
export type ProjectRecurringReminder = Database['public']['Tables']['project_recurring_reminders']['Row'];
export type ProjectNotification = Database['public']['Tables']['project_notifications']['Row'];
export type ProcurementRequest = Database['public']['Tables']['procurement_requests']['Row'];
export type PurchaseRecord = Database['public']['Tables']['purchase_records']['Row'];
export type ProjectDocument = Database['public']['Tables']['project_documents']['Row'];
export type ProjectMilestone = Database['public']['Tables']['project_milestones']['Row'];
export type MilestoneTask = Database['public']['Tables']['milestone_tasks']['Row'];
export type MaterialUsage = Database['public']['Tables']['material_usage']['Row'];
export type MaterialAlias = Database['public']['Tables']['material_aliases']['Row'];
export type ScraperConfig = Database['public']['Tables']['scraper_configs']['Row'];
export type WeeklyPrice = Database['public']['Tables']['weekly_prices']['Row'];
export type ScraperLog = Database['public']['Tables']['scraper_logs']['Row'];
export type ProjectStage = Database['public']['Tables']['project_stages']['Row'];
export type StageTask = Database['public']['Tables']['stage_tasks']['Row'];

// Insert types
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type BOQItemInsert = Database['public']['Tables']['boq_items']['Insert'];
export type ReminderInsert = Database['public']['Tables']['reminders']['Insert'];
export type ProjectRecurringReminderInsert = Database['public']['Tables']['project_recurring_reminders']['Insert'];
export type ProjectNotificationInsert = Database['public']['Tables']['project_notifications']['Insert'];
export type ProcurementRequestInsert = Database['public']['Tables']['procurement_requests']['Insert'];
export type PurchaseRecordInsert = Database['public']['Tables']['purchase_records']['Insert'];
export type ProjectDocumentInsert = Database['public']['Tables']['project_documents']['Insert'];
export type ProjectMilestoneInsert = Database['public']['Tables']['project_milestones']['Insert'];
export type MilestoneTaskInsert = Database['public']['Tables']['milestone_tasks']['Insert'];
export type MaterialUsageInsert = Database['public']['Tables']['material_usage']['Insert'];
export type ProjectStageInsert = Database['public']['Tables']['project_stages']['Insert'];
export type StageTaskInsert = Database['public']['Tables']['stage_tasks']['Insert'];
export type SupplierInsert = Database['public']['Tables']['suppliers']['Insert'];

// Update types
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
export type BOQItemUpdate = Database['public']['Tables']['boq_items']['Update'];
export type ReminderUpdate = Database['public']['Tables']['reminders']['Update'];
export type ProjectRecurringReminderUpdate = Database['public']['Tables']['project_recurring_reminders']['Update'];
export type ProjectNotificationUpdate = Database['public']['Tables']['project_notifications']['Update'];
export type ProcurementRequestUpdate = Database['public']['Tables']['procurement_requests']['Update'];
export type PurchaseRecordUpdate = Database['public']['Tables']['purchase_records']['Update'];
export type ProjectMilestoneUpdate = Database['public']['Tables']['project_milestones']['Update'];
export type MilestoneTaskUpdate = Database['public']['Tables']['milestone_tasks']['Update'];
export type MaterialUsageUpdate = Database['public']['Tables']['material_usage']['Update'];
export type ProjectStageUpdate = Database['public']['Tables']['project_stages']['Update'];
export type StageTaskUpdate = Database['public']['Tables']['stage_tasks']['Update'];
export type SupplierUpdate = Database['public']['Tables']['suppliers']['Update'];

// Stage with tasks helper type
export type ProjectStageWithTasks = ProjectStage & { tasks: StageTask[] };
