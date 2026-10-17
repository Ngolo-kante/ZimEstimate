import { describe, expect, it } from 'vitest';
import { isClientBundleError } from './clientBundleError';

describe('client bundle error recovery', () => {
  it('recognises missing chunk and module-factory failures', () => {
    expect(isClientBundleError({ name: 'ChunkLoadError', message: 'missing' })).toBe(true);
    expect(isClientBundleError({ name: 'Error', message: 'Loading chunk 42 failed' })).toBe(true);
    expect(isClientBundleError({ name: 'TypeError', message: "Cannot read properties of undefined (reading 'call')" })).toBe(true);
  });

  it('leaves unrelated page errors alone', () => {
    expect(isClientBundleError({ name: 'TypeError', message: "Cannot read properties of undefined (reading 'map')" })).toBe(false);
    expect(isClientBundleError(null)).toBe(false);
  });
});
