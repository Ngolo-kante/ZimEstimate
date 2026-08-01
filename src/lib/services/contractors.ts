import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export type ContractorRow = {
  id: string;
  user_id: string;
  company_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  trades: string[] | null;
  service_areas: string[] | null;
  years_experience: number | null;
  about: string | null;
  default_markup_pct: number | null;
  is_listed: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ContractorUpdate = Partial<{
  company_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  trades: string[];
  service_areas: string[];
  years_experience: number | null;
  about: string | null;
  default_markup_pct: number;
  is_listed: boolean;
  updated_at: string;
}>;

export type ContractorFilters = {
  trade?: string;
  serviceArea?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

type ContractorListResult = {
  data: ContractorRow[] | null;
  error: { message: string } | null;
  count?: number | null;
};

type ContractorSingleResult = {
  data: ContractorRow | null;
  error: { message: string; code?: string } | null;
};

type ContractorQuery = PromiseLike<ContractorListResult> & {
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): ContractorQuery;
  eq(column: string, value: string | boolean | number): ContractorQuery;
  is(column: string, value: null): ContractorQuery;
  contains(column: string, value: string[]): ContractorQuery;
  order(column: string, options?: { ascending?: boolean }): ContractorQuery;
  range(from: number, to: number): ContractorQuery;
  limit(count: number): ContractorQuery;
  single(): Promise<ContractorSingleResult>;
  update(values: ContractorUpdate): ContractorQuery;
};

type ContractorSupabase = {
  from(table: 'contractors'): ContractorQuery;
};

const contractorsTable = () =>
  (supabase as unknown as ContractorSupabase).from('contractors');

const PUBLIC_CONTRACTOR_COLUMNS =
  'id, company_name, contact_phone, contact_email, trades, service_areas, years_experience, about, is_listed, is_verified, created_at, updated_at, deleted_at, user_id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getMyContractorProfile(userId: string): Promise<ContractorRow | null> {
  const { data, error } = await contractorsTable()
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Fetch contractor profile failed', { error });
  }

  return data;
}

export async function getMyContractor(): Promise<{ contractor: ContractorRow | null; error?: Error }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  if (authError || !userId) {
    return { contractor: null, error: new Error(authError?.message || 'Not authenticated') };
  }

  const contractor = await getMyContractorProfile(userId);
  return { contractor };
}

export async function updateContractorProfile(
  contractorId: string,
  updates: ContractorUpdate
): Promise<{ success: boolean; error?: string }> {
  const { error } = await contractorsTable()
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', contractorId)
    .is('deleted_at', null);

  if (error) {
    logger.error('Update contractor profile failed', { error });
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function listListedContractors({
  trade,
  serviceArea,
  limit = 24,
  offset = 0,
}: ContractorFilters = {}): Promise<{ contractors: ContractorRow[]; count: number; error?: string }> {
  let query = contractorsTable()
    .select(PUBLIC_CONTRACTOR_COLUMNS, { count: 'exact' })
    .eq('is_listed', true)
    .is('deleted_at', null);

  if (trade && trade !== 'all') {
    query = query.contains('trades', [trade]);
  }

  if (serviceArea && serviceArea !== 'all') {
    query = query.contains('service_areas', [serviceArea]);
  }

  const { data, error, count } = await query
    .order('company_name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('Fetch listed contractors failed', { error });
    return { contractors: [], count: 0, error: error.message };
  }

  return { contractors: data || [], count: count || 0 };
}

export async function getListedContractor(contractorId: string): Promise<ContractorRow | null> {
  if (!UUID_PATTERN.test(contractorId)) {
    return null;
  }

  const { data, error } = await contractorsTable()
    .select(PUBLIC_CONTRACTOR_COLUMNS)
    .eq('id', contractorId)
    .eq('is_listed', true)
    .is('deleted_at', null)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Fetch listed contractor failed', { error });
  }

  return data;
}

// Self-serve registration is owned by the contractor-account flow. It lives in
// this shared module so the registration page and profile tools agree on the
// same RPC contract.
export type ContractorRegistrationInput = {
  companyName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  trades?: string[];
  serviceAreas?: string[];
  yearsExperience?: number | null;
  about?: string | null;
};

export async function registerAsContractor(
  input: ContractorRegistrationInput
): Promise<{ contractorId: string | null; error: Error | null }> {
  const companyName = input.companyName?.trim();
  if (!companyName) {
    return { contractorId: null, error: new Error('Company name is required.') };
  }

  const { data, error } = await supabase.rpc('register_as_contractor', {
    p_company_name: companyName,
    p_contact_phone: input.contactPhone?.trim() || null,
    p_contact_email: input.contactEmail?.trim() || null,
    p_trades: input.trades ?? [],
    p_service_areas: input.serviceAreas ?? [],
    p_years_experience: input.yearsExperience ?? null,
    p_about: input.about?.trim() || null,
  } as never);

  if (error) {
    logger.error('Contractor registration failed', { error: error.message });
    return { contractorId: null, error: new Error(error.message) };
  }

  return { contractorId: data as unknown as string, error: null };
}
