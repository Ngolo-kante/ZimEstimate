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


export type StageStatus = 'planning' | 'pending_approval' | 'in_progress' | 'on_hold' | 'completed';

export type BOQCategory = 'substructure' | 'superstructure' | 'roofing' | 'finishing' | 'exterior';

export type DocumentCategory = 'plan' | 'permit' | 'receipt' | 'contract' | 'photo' | 'general';

export type SavingsFrequency = 'weekly' | 'monthly' | 'quarterly';

export type UserType = 'builder' | 'supplier' | 'admin';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'trusted' | 'premium';

export type SupplierApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';

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
                    notify_email: boolean;
                    notify_whatsapp: boolean;
                    notify_push: boolean;
                    notify_rfq: boolean;
                    notify_quote_updates: boolean;
                    notify_price_alerts: boolean;
                    notify_project_reminders: boolean;
                    user_type: UserType;
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
                    notify_email?: boolean;
                    notify_whatsapp?: boolean;
                    notify_push?: boolean;
                    notify_rfq?: boolean;
                    notify_quote_updates?: boolean;
                    notify_price_alerts?: boolean;
                    notify_project_reminders?: boolean;
                    user_type?: UserType;
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
                    notify_email?: boolean;
                    notify_whatsapp?: boolean;
                    notify_push?: boolean;
                    notify_rfq?: boolean;
                    notify_quote_updates?: boolean;
                    notify_price_alerts?: boolean;
                    notify_project_reminders?: boolean;
                    user_type?: UserType;
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
                    user_id: string | null;
                    name: string;
                    location: string | null;
                    contact_phone: string | null;
                    contact_email: string | null;
                    website: string | null;
                    registration_number: string | null;
                    business_license_url: string | null;
                    physical_address: string | null;
                    delivery_radius_km: number | null;
                    material_categories: string[] | null;
                    payment_terms: string | null;
                    verification_status: VerificationStatus;
                    verified_at: string | null;
                    is_trusted: boolean;
                    rating: number;
                    deleted_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id?: string | null;
                    name: string;
                    location?: string | null;
                    contact_phone?: string | null;
                    contact_email?: string | null;
                    website?: string | null;
                    registration_number?: string | null;
                    business_license_url?: string | null;
                    physical_address?: string | null;
                    delivery_radius_km?: number | null;
                    material_categories?: string[] | null;
                    payment_terms?: string | null;
                    verification_status?: VerificationStatus;
                    verified_at?: string | null;
                    is_trusted?: boolean;
                    rating?: number;
                    deleted_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string | null;
                    name?: string;
                    location?: string | null;
                    contact_phone?: string | null;
                    contact_email?: string | null;
                    website?: string | null;
                    registration_number?: string | null;
                    business_license_url?: string | null;
                    physical_address?: string | null;
                    delivery_radius_km?: number | null;
                    material_categories?: string[] | null;
                    payment_terms?: string | null;
                    verification_status?: VerificationStatus;
                    verified_at?: string | null;
                    is_trusted?: boolean;
                    rating?: number;
                    deleted_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            supplier_api_keys: {
                Row: {
                    id: string;
                    supplier_id: string;
                    key_prefix: string;
                    key_hash: string;
                    label: string | null;
                    created_at: string;
                    last_used_at: string | null;
                    revoked_at: string | null;
                };
                Insert: {
                    id?: string;
                    supplier_id: string;
                    key_prefix: string;
                    key_hash: string;
                    label?: string | null;
                    created_at?: string;
                    last_used_at?: string | null;
                    revoked_at?: string | null;
                };
                Update: {
                    id?: string;
                    supplier_id?: string;
                    key_prefix?: string;
                    key_hash?: string;
                    label?: string | null;
                    created_at?: string;
                    last_used_at?: string | null;
                    revoked_at?: string | null;
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
                    review_status: 'auto' | 'pending' | 'confirmed' | 'rejected';
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
                    review_status?: 'auto' | 'pending' | 'confirmed' | 'rejected';
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
                    review_status?: 'auto' | 'pending' | 'confirmed' | 'rejected';
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
            notification_deliveries: {
                Row: {
                    id: string;
                    user_id: string;
                    channel: string;
                    template_key: string;
                    payload: Json | null;
                    status: string;
                    attempt_count: number;
                    last_error: string | null;
                    created_at: string;
                    sent_at: string | null;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    channel: string;
                    template_key: string;
                    payload?: Json | null;
                    status?: string;
                    attempt_count?: number;
                    last_error?: string | null;
                    created_at?: string;
                    sent_at?: string | null;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    channel?: string;
                    template_key?: string;
                    payload?: Json | null;
                    status?: string;
                    attempt_count?: number;
                    last_error?: string | null;
                    created_at?: string;
                    sent_at?: string | null;
                };
            };
            push_subscriptions: {
                Row: {
                    id: string;
                    user_id: string;
                    endpoint: string;
                    p256dh: string | null;
                    auth: string | null;
                    user_agent: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    endpoint: string;
                    p256dh?: string | null;
                    auth?: string | null;
                    user_agent?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    endpoint?: string;
                    p256dh?: string | null;
                    auth?: string | null;
                    user_agent?: string | null;
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
            rfq_requests: {
                Row: {
                    id: string;
                    project_id: string;
                    user_id: string;
                    delivery_address: string | null;
                    required_by: string | null;
                    notes: string | null;
                    status: string;
                    created_at: string;
                    expires_at: string;
                    accepted_quote_id: string | null;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    user_id: string;
                    delivery_address?: string | null;
                    required_by?: string | null;
                    notes?: string | null;
                    status?: string;
                    created_at?: string;
                    expires_at?: string;
                    accepted_quote_id?: string | null;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    user_id?: string;
                    delivery_address?: string | null;
                    required_by?: string | null;
                    notes?: string | null;
                    status?: string;
                    created_at?: string;
                    expires_at?: string;
                    accepted_quote_id?: string | null;
                };
            };
            rfq_items: {
                Row: {
                    id: string;
                    rfq_id: string;
                    material_key: string;
                    material_name: string | null;
                    quantity: number;
                    unit: string | null;
                    specifications: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    rfq_id: string;
                    material_key: string;
                    material_name?: string | null;
                    quantity: number;
                    unit?: string | null;
                    specifications?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    rfq_id?: string;
                    material_key?: string;
                    material_name?: string | null;
                    quantity?: number;
                    unit?: string | null;
                    specifications?: string | null;
                    created_at?: string;
                };
            };
            rfq_recipients: {
                Row: {
                    id: string;
                    rfq_id: string;
                    supplier_id: string;
                    status: string;
                    notification_channels: string[];
                    notified_at: string;
                    last_viewed_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    rfq_id: string;
                    supplier_id: string;
                    status?: string;
                    notification_channels?: string[];
                    notified_at?: string;
                    last_viewed_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    rfq_id?: string;
                    supplier_id?: string;
                    status?: string;
                    notification_channels?: string[];
                    notified_at?: string;
                    last_viewed_at?: string | null;
                    created_at?: string;
                };
            };
            rfq_quotes: {
                Row: {
                    id: string;
                    rfq_id: string;
                    supplier_id: string;
                    total_usd: number | null;
                    total_zwg: number | null;
                    delivery_days: number | null;
                    valid_until: string | null;
                    notes: string | null;
                    status: string;
                    submitted_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    rfq_id: string;
                    supplier_id: string;
                    total_usd?: number | null;
                    total_zwg?: number | null;
                    delivery_days?: number | null;
                    valid_until?: string | null;
                    notes?: string | null;
                    status?: string;
                    submitted_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    rfq_id?: string;
                    supplier_id?: string;
                    total_usd?: number | null;
                    total_zwg?: number | null;
                    delivery_days?: number | null;
                    valid_until?: string | null;
                    notes?: string | null;
                    status?: string;
                    submitted_at?: string;
                    updated_at?: string;
                };
            };
            rfq_quote_items: {
                Row: {
                    id: string;
                    quote_id: string;
                    rfq_item_id: string;
                    unit_price_usd: number | null;
                    unit_price_zwg: number | null;
                    available_quantity: number | null;
                    notes: string | null;
                };
                Insert: {
                    id?: string;
                    quote_id: string;
                    rfq_item_id: string;
                    unit_price_usd?: number | null;
                    unit_price_zwg?: number | null;
                    available_quantity?: number | null;
                    notes?: string | null;
                };
                Update: {
                    id?: string;
                    quote_id?: string;
                    rfq_item_id?: string;
                    unit_price_usd?: number | null;
                    unit_price_zwg?: number | null;
                    available_quantity?: number | null;
                    notes?: string | null;
                };
            };
            rfq_notification_queue: {
                Row: {
                    id: string;
                    rfq_id: string;
                    supplier_id: string;
                    channel: string;
                    payload: Json | null;
                    status: string;
                    attempt_count: number;
                    last_error: string | null;
                    created_at: string;
                    sent_at: string | null;
                };
                Insert: {
                    id?: string;
                    rfq_id: string;
                    supplier_id: string;
                    channel: string;
                    payload?: Json | null;
                    status?: string;
                    attempt_count?: number;
                    last_error?: string | null;
                    created_at?: string;
                    sent_at?: string | null;
                };
                Update: {
                    id?: string;
                    rfq_id?: string;
                    supplier_id?: string;
                    channel?: string;
                    payload?: Json | null;
                    status?: string;
                    attempt_count?: number;
                    last_error?: string | null;
                    created_at?: string;
                    sent_at?: string | null;
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
                    // Category scraper fields
                    scrape_mode: 'single' | 'category' | null;
                    container_selector: string | null;
                    item_card_selector: string | null;
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
                    // Category scraper fields
                    scrape_mode?: 'single' | 'category' | null;
                    container_selector?: string | null;
                    item_card_selector?: string | null;
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
                    // Category scraper fields
                    scrape_mode?: 'single' | 'category' | null;
                    container_selector?: string | null;
                    item_card_selector?: string | null;
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
            supplier_applications: {
                Row: {
                    id: string;
                    user_id: string;
                    business_name: string;
                    registration_number: string | null;
                    business_license_url: string | null;
                    physical_address: string | null;
                    city: string | null;
                    contact_phone: string | null;
                    contact_email: string | null;
                    website: string | null;
                    delivery_radius_km: number;
                    material_categories: string[];
                    payment_terms: string | null;
                    years_in_business: number | null;
                    customer_references: string[] | null;
                    status: SupplierApplicationStatus;
                    reviewed_by: string | null;
                    reviewed_at: string | null;
                    rejection_reason: string | null;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    business_name: string;
                    registration_number?: string | null;
                    business_license_url?: string | null;
                    physical_address?: string | null;
                    city?: string | null;
                    contact_phone?: string | null;
                    contact_email?: string | null;
                    website?: string | null;
                    delivery_radius_km?: number;
                    material_categories?: string[];
                    payment_terms?: string | null;
                    years_in_business?: number | null;
                    customer_references?: string[] | null;
                    status?: SupplierApplicationStatus;
                    reviewed_by?: string | null;
                    reviewed_at?: string | null;
                    rejection_reason?: string | null;
                    notes?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    business_name?: string;
                    registration_number?: string | null;
                    business_license_url?: string | null;
                    physical_address?: string | null;
                    city?: string | null;
                    contact_phone?: string | null;
                    contact_email?: string | null;
                    website?: string | null;
                    delivery_radius_km?: number;
                    material_categories?: string[];
                    payment_terms?: string | null;
                    years_in_business?: number | null;
                    customer_references?: string[] | null;
                    status?: SupplierApplicationStatus;
                    reviewed_by?: string | null;
                    reviewed_at?: string | null;
                    rejection_reason?: string | null;
                    notes?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            supplier_products: {
                Row: {
                    id: string;
                    supplier_id: string;
                    material_key: string;
                    material_name: string | null;
                    price_usd: number | null;
                    price_zwg: number | null;
                    min_order_qty: number;
                    max_order_qty: number | null;
                    unit: string | null;
                    stock_status: StockStatus;
                    lead_time_days: number;
                    notes: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    supplier_id: string;
                    material_key: string;
                    material_name?: string | null;
                    price_usd?: number | null;
                    price_zwg?: number | null;
                    min_order_qty?: number;
                    max_order_qty?: number | null;
                    unit?: string | null;
                    stock_status?: StockStatus;
                    lead_time_days?: number;
                    notes?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    supplier_id?: string;
                    material_key?: string;
                    material_name?: string | null;
                    price_usd?: number | null;
                    price_zwg?: number | null;
                    min_order_qty?: number;
                    max_order_qty?: number | null;
                    unit?: string | null;
                    stock_status?: StockStatus;
                    lead_time_days?: number;
                    notes?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
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
export type SupplierApiKey = Database['public']['Tables']['supplier_api_keys']['Row'];
export type ExchangeRate = Database['public']['Tables']['exchange_rates']['Row'];
export type Reminder = Database['public']['Tables']['reminders']['Row'];
export type ProjectRecurringReminder = Database['public']['Tables']['project_recurring_reminders']['Row'];
export type ProjectNotification = Database['public']['Tables']['project_notifications']['Row'];
export type NotificationDelivery = Database['public']['Tables']['notification_deliveries']['Row'];
export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row'];
export type ProcurementRequest = Database['public']['Tables']['procurement_requests']['Row'];
export type RfqRequest = Database['public']['Tables']['rfq_requests']['Row'];
export type RfqItem = Database['public']['Tables']['rfq_items']['Row'];
export type RfqRecipient = Database['public']['Tables']['rfq_recipients']['Row'];
export type RfqQuote = Database['public']['Tables']['rfq_quotes']['Row'];
export type RfqQuoteItem = Database['public']['Tables']['rfq_quote_items']['Row'];
export type RfqNotification = Database['public']['Tables']['rfq_notification_queue']['Row'];
export type PurchaseRecord = Database['public']['Tables']['purchase_records']['Row'];
export type ProjectDocument = Database['public']['Tables']['project_documents']['Row'];
export type MaterialUsage = Database['public']['Tables']['material_usage']['Row'];
export type MaterialAlias = Database['public']['Tables']['material_aliases']['Row'];
export type ScraperConfig = Database['public']['Tables']['scraper_configs']['Row'];
export type WeeklyPrice = Database['public']['Tables']['weekly_prices']['Row'];
export type PriceWeekly = Database['public']['Tables']['price_weekly']['Row'];
export type ScraperLog = Database['public']['Tables']['scraper_logs']['Row'];
export type ProjectStage = Database['public']['Tables']['project_stages']['Row'];
export type StageTask = Database['public']['Tables']['stage_tasks']['Row'];
export type SupplierApplication = Database['public']['Tables']['supplier_applications']['Row'];
export type SupplierProduct = Database['public']['Tables']['supplier_products']['Row'];

// Insert types
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type BOQItemInsert = Database['public']['Tables']['boq_items']['Insert'];
export type ReminderInsert = Database['public']['Tables']['reminders']['Insert'];
export type ProjectRecurringReminderInsert = Database['public']['Tables']['project_recurring_reminders']['Insert'];
export type ProjectNotificationInsert = Database['public']['Tables']['project_notifications']['Insert'];
export type NotificationDeliveryInsert = Database['public']['Tables']['notification_deliveries']['Insert'];
export type PushSubscriptionInsert = Database['public']['Tables']['push_subscriptions']['Insert'];
export type ProcurementRequestInsert = Database['public']['Tables']['procurement_requests']['Insert'];
export type RfqRequestInsert = Database['public']['Tables']['rfq_requests']['Insert'];
export type RfqItemInsert = Database['public']['Tables']['rfq_items']['Insert'];
export type RfqRecipientInsert = Database['public']['Tables']['rfq_recipients']['Insert'];
export type RfqQuoteInsert = Database['public']['Tables']['rfq_quotes']['Insert'];
export type RfqQuoteItemInsert = Database['public']['Tables']['rfq_quote_items']['Insert'];
export type RfqNotificationInsert = Database['public']['Tables']['rfq_notification_queue']['Insert'];
export type PurchaseRecordInsert = Database['public']['Tables']['purchase_records']['Insert'];
export type ProjectDocumentInsert = Database['public']['Tables']['project_documents']['Insert'];
export type MaterialUsageInsert = Database['public']['Tables']['material_usage']['Insert'];
export type ProjectStageInsert = Database['public']['Tables']['project_stages']['Insert'];
export type StageTaskInsert = Database['public']['Tables']['stage_tasks']['Insert'];
export type SupplierInsert = Database['public']['Tables']['suppliers']['Insert'];
export type SupplierApiKeyInsert = Database['public']['Tables']['supplier_api_keys']['Insert'];
export type SupplierApplicationInsert = Database['public']['Tables']['supplier_applications']['Insert'];
export type SupplierProductInsert = Database['public']['Tables']['supplier_products']['Insert'];

// Update types
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
export type BOQItemUpdate = Database['public']['Tables']['boq_items']['Update'];
export type ReminderUpdate = Database['public']['Tables']['reminders']['Update'];
export type ProjectRecurringReminderUpdate = Database['public']['Tables']['project_recurring_reminders']['Update'];
export type ProjectNotificationUpdate = Database['public']['Tables']['project_notifications']['Update'];
export type NotificationDeliveryUpdate = Database['public']['Tables']['notification_deliveries']['Update'];
export type PushSubscriptionUpdate = Database['public']['Tables']['push_subscriptions']['Update'];
export type ProcurementRequestUpdate = Database['public']['Tables']['procurement_requests']['Update'];
export type RfqRequestUpdate = Database['public']['Tables']['rfq_requests']['Update'];
export type RfqItemUpdate = Database['public']['Tables']['rfq_items']['Update'];
export type RfqRecipientUpdate = Database['public']['Tables']['rfq_recipients']['Update'];
export type RfqQuoteUpdate = Database['public']['Tables']['rfq_quotes']['Update'];
export type RfqQuoteItemUpdate = Database['public']['Tables']['rfq_quote_items']['Update'];
export type RfqNotificationUpdate = Database['public']['Tables']['rfq_notification_queue']['Update'];
export type PurchaseRecordUpdate = Database['public']['Tables']['purchase_records']['Update'];
export type MaterialUsageUpdate = Database['public']['Tables']['material_usage']['Update'];
export type ProjectStageUpdate = Database['public']['Tables']['project_stages']['Update'];
export type StageTaskUpdate = Database['public']['Tables']['stage_tasks']['Update'];
export type SupplierUpdate = Database['public']['Tables']['suppliers']['Update'];
export type SupplierApiKeyUpdate = Database['public']['Tables']['supplier_api_keys']['Update'];
export type SupplierApplicationUpdate = Database['public']['Tables']['supplier_applications']['Update'];
export type SupplierProductUpdate = Database['public']['Tables']['supplier_products']['Update'];

// Stage with tasks helper type
export type ProjectStageWithTasks = ProjectStage & { tasks: StageTask[] };

// Alias for legacy/inconsistent usage
export type RequestForQuotation = RfqRequest;
