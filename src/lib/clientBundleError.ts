/** Errors raised by the module loader when an open tab has stale JS chunks. */
export function isClientBundleError(error: Pick<Error, 'name' | 'message'> | null | undefined): boolean {
  if (!error) return false;
  return error.name === 'ChunkLoadError'
    || /Loading chunk .* failed/i.test(error.message)
    || /Cannot read properties of undefined \(reading ['"]call['"]\)/i.test(error.message);
}
