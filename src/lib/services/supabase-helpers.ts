type SupabaseError = { message: string } | null;

export function mapSupabaseError(error: SupabaseError): Error | null {
  return error ? new Error(error.message) : null;
}

export function buildResult<T>(data: T | null, error: SupabaseError) {
  return { data, error: mapSupabaseError(error) };
}
