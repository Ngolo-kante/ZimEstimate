// Supplier service for ZimEstimate
// Handles supplier registration, profile management, and product catalog

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { mapSupabaseError } from '@/lib/services/supabase-helpers';
import type {
  SupplierApplication,
  SupplierApplicationInsert,
  Supplier,
  SupplierApiKey,
  SupplierApiKeyInsert,
  SupplierProduct,
  SupplierProductInsert,
  SupplierApplicationStatus,
} from '@/lib/database.types';

export interface SupplierRegistrationData {
  businessName: string;
  registrationNumber?: string;
  businessLicenseUrl?: string;
  physicalAddress: string;
  city: string;
  contactPhone: string;
  contactEmail: string;
  website?: string;
  deliveryRadiusKm: number;
  materialCategories: string[];
  paymentTerms?: string;
  yearsInBusiness?: number;
  customerReferences?: string[];
}

/**
 * Submit a new supplier application
 */
/** Submit a new supplier application for review. */
export async function submitSupplierApplication(
  userId: string,
  data: SupplierRegistrationData
): Promise<{ success: boolean; applicationId?: string; error?: string }> {
  const applicationData: SupplierApplicationInsert = {
    user_id: userId,
    business_name: data.businessName,
    registration_number: data.registrationNumber || null,
    business_license_url: data.businessLicenseUrl || null,
    physical_address: data.physicalAddress,
    city: data.city,
    contact_phone: data.contactPhone,
    contact_email: data.contactEmail,
    website: data.website || null,
    delivery_radius_km: data.deliveryRadiusKm,
    material_categories: data.materialCategories,
    payment_terms: data.paymentTerms || null,
    years_in_business: data.yearsInBusiness || null,
    customer_references: data.customerReferences || null,
    status: 'pending' as SupplierApplicationStatus,
  };

  const { data: result, error } = await supabase
    .from('supplier_applications')
    .insert(applicationData as never)
    .select('id')
    .single();

  if (error) {
    logger.error('Supplier application submission failed', { error });
    return { success: false, error: error.message };
  }

  return { success: true, applicationId: (result as { id: string }).id };
}

/**
 * Get current user's supplier application status
 */
/** Fetch the most recent supplier application for a user. */
export async function getUserSupplierApplication(
  userId: string
): Promise<SupplierApplication | null> {
  const { data, error } = await supabase
    .from('supplier_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Fetch supplier application failed', { error });
  }

  return data as SupplierApplication | null;
}

/**
 * Get user's supplier profile (if approved)
 */
/** Fetch the approved supplier profile for a user. */
export async function getUserSupplierProfile(
  userId: string
): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Fetch supplier profile failed', { error });
  }

  return data as Supplier | null;
}

/**
 * Update supplier profile
 */
/** Update a supplier's business profile. */
export async function updateSupplierProfile(
  supplierId: string,
  updates: Partial<{
    name: string;
    location: string;
    contact_phone: string;
    contact_email: string;
    website: string;
    physical_address: string;
    delivery_radius_km: number;
    material_categories: string[];
    payment_terms: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('suppliers')
    .update(updates as never)
    .eq('id', supplierId)
    .is('deleted_at', null);

  if (error) {
    logger.error('Update supplier profile failed', { error });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get supplier's products
 */
/** Fetch products for a supplier. */
export async function getSupplierProducts(
  supplierId: string
): Promise<SupplierProduct[]> {
  const { data, error } = await supabase
    .from('supplier_products')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('material_name', { ascending: true });

  if (error) {
    logger.error('Fetch supplier products failed', { error });
    return [];
  }

  return data as SupplierProduct[];
}

/**
 * Add or update a supplier product
 */
/** Create or update a supplier product. */
export async function upsertSupplierProduct(
  supplierId: string,
  product: Omit<SupplierProductInsert, 'supplier_id'>
): Promise<{ success: boolean; productId?: string; error?: string }> {
  const productData: SupplierProductInsert = {
    ...product,
    supplier_id: supplierId,
  };

  const { data, error } = await supabase
    .from('supplier_products')
    .upsert(productData as never, {
      onConflict: 'supplier_id,material_key',
    })
    .select('id')
    .single();

  if (error) {
    logger.error('Upsert supplier product failed', { error });
    return { success: false, error: error.message };
  }

  return { success: true, productId: (data as { id: string }).id };
}

/**
 * Delete a supplier product
 */
/** Delete a supplier product by id. */
export async function deleteSupplierProduct(
  productId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('supplier_products')
    .delete()
    .eq('id', productId);

  if (error) {
    logger.error('Delete supplier product failed', { error });
    return { success: false, error: error.message };
  }

  return { success: true };
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return bufferToHex(data);
}

async function hashKey(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bufferToHex(digest);
}

/** List API keys for a supplier. */
export async function listSupplierApiKeys(
  supplierId: string
): Promise<SupplierApiKey[]> {
  const { data, error } = await supabase
    .from('supplier_api_keys')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false });

  const mappedError = mapSupabaseError(error);
  if (mappedError) {
    logger.error('Fetch supplier API keys failed', { error: mappedError });
    return [];
  }

  return data as SupplierApiKey[];
}

/** Create a new API key for a supplier. */
export async function createSupplierApiKey(options: {
  supplierId: string;
  label?: string;
}): Promise<{ success: boolean; apiKey?: string; key?: SupplierApiKey; error?: string }> {
  const apiKey = `zm_live_${randomToken(24)}`;
  const keyHash = await hashKey(apiKey);
  const keyPrefix = apiKey.slice(0, 12);

  const payload: SupplierApiKeyInsert = {
    supplier_id: options.supplierId,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    label: options.label || null,
  };

  const { data, error } = await supabase
    .from('supplier_api_keys')
    .insert(payload as never)
    .select('*')
    .single();

  const mappedError = mapSupabaseError(error);
  if (mappedError) {
    logger.error('Create supplier API key failed', { error: mappedError });
    return { success: false, error: mappedError.message };
  }

  return { success: true, apiKey, key: data as SupplierApiKey };
}

/** Revoke a supplier API key by id. */
export async function revokeSupplierApiKey(
  keyId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('supplier_api_keys')
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq('id', keyId);

  const mappedError = mapSupabaseError(error);
  if (mappedError) {
    logger.error('Revoke supplier API key failed', { error: mappedError });
    return { success: false, error: mappedError.message };
  }

  return { success: true };
}

/**
 * Upload business license file
 */
/** Upload a supplier business license document. */
export async function uploadBusinessLicense(
  userId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/business-license-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('supplier-documents')
    .upload(fileName, file);

  if (uploadError) {
    logger.error('Upload business license failed', { error: uploadError });
    return { success: false, error: uploadError.message };
  }

  const { data: urlData } = supabase.storage
    .from('supplier-documents')
    .getPublicUrl(fileName);

  return { success: true, url: urlData.publicUrl };
}

// Material categories available for suppliers
export const MATERIAL_CATEGORIES = [
  'Cement & Concrete',
  'Bricks & Blocks',
  'Roofing Materials',
  'Steel & Metal',
  'Timber & Wood',
  'Plumbing Supplies',
  'Electrical Supplies',
  'Paint & Finishes',
  'Tiles & Flooring',
  'Windows & Doors',
  'Hardware & Fasteners',
  'Aggregates & Sand',
  'Insulation',
  'Waterproofing',
  'Tools & Equipment',
] as const;

// Payment terms options
export const PAYMENT_TERMS_OPTIONS = [
  'Cash on Delivery',
  'Prepayment Required',
  '7 Days Net',
  '14 Days Net',
  '30 Days Net',
  'Installment Plans Available',
] as const;

// Zimbabwe cities for location dropdown
export const ZIMBABWE_CITIES = [
  'Harare',
  'Bulawayo',
  'Chitungwiza',
  'Mutare',
  'Gweru',
  'Epworth',
  'Kwekwe',
  'Kadoma',
  'Masvingo',
  'Chinhoyi',
  'Norton',
  'Marondera',
  'Ruwa',
  'Chegutu',
  'Zvishavane',
  'Bindura',
  'Beitbridge',
  'Redcliff',
  'Victoria Falls',
  'Hwange',
  'Kariba',
  'Karoi',
] as const;
