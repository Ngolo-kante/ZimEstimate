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
                    total_usd: number;
                    total_zwg: number;
                    target_date: string | null;
                    budget_target_usd: number | null;
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
                    total_usd?: number;
                    total_zwg?: number;
                    target_date?: string | null;
                    budget_target_usd?: number | null;
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
                    total_usd?: number;
                    total_zwg?: number;
                    target_date?: string | null;
                    budget_target_usd?: number | null;
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
                    reminder_type: 'material' | 'savings' | 'deadline';
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
                    reminder_type: 'material' | 'savings' | 'deadline';
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
                    reminder_type?: 'material' | 'savings' | 'deadline';
                    message?: string;
                    scheduled_date?: string;
                    is_sent?: boolean;
                    phone_number?: string;
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

// Insert types
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type BOQItemInsert = Database['public']['Tables']['boq_items']['Insert'];
export type ReminderInsert = Database['public']['Tables']['reminders']['Insert'];

// Update types
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
export type BOQItemUpdate = Database['public']['Tables']['boq_items']['Update'];
export type ReminderUpdate = Database['public']['Tables']['reminders']['Update'];
