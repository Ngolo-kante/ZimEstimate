import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isInstalledApp } from './appMode';

describe('isInstalledApp', () => {
  let storage: Map<string, string>;
  let matchMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = new Map();
    matchMedia = vi.fn(() => ({ matches: false }));
    vi.stubGlobal('document', { referrer: '' });
    vi.stubGlobal('window', {
      matchMedia,
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('is safe during server rendering', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    expect(isInstalledApp()).toBe(false);
  });

  it('does not detect a regular browser visit', () => {
    expect(isInstalledApp()).toBe(false);
    expect(storage.size).toBe(0);
  });

  it.each([
    'android-app://com.zimestimate.app',
    'android-app://com.zimestimate.app/https/zimestimate.com',
  ])('remembers an Android launch from %s across page loads', (referrer) => {
    vi.stubGlobal('document', { referrer });
    expect(isInstalledApp()).toBe(true);
    vi.stubGlobal('document', { referrer: 'https://zimestimate.com/home' });
    expect(isInstalledApp()).toBe(true);
    storage.clear();
    expect(isInstalledApp()).toBe(false);
  });

  it.each(['https://example.com', 'android-app://com.other.app'])('ignores unrelated referrers: %s', (referrer) => {
    vi.stubGlobal('document', { referrer });
    expect(isInstalledApp()).toBe(false);
  });

  it('detects standalone display mode without persisting it', () => {
    matchMedia.mockReturnValue({ matches: true });
    expect(isInstalledApp()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(display-mode: standalone)');
    expect(storage.size).toBe(0);
  });

  it('handles unavailable matchMedia', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    expect(isInstalledApp()).toBe(false);
  });

  it('still detects an Android launch when sessionStorage throws', () => {
    Object.defineProperty(window, 'sessionStorage', {
      get: () => { throw new Error('Storage blocked'); },
    });
    vi.stubGlobal('document', { referrer: 'android-app://com.zimestimate.app' });
    expect(isInstalledApp()).toBe(true);
    vi.stubGlobal('document', { referrer: '' });
    expect(isInstalledApp()).toBe(false);
    matchMedia.mockReturnValue({ matches: true });
    expect(isInstalledApp()).toBe(true);
  });

  it('handles storage write failures', () => {
    window.sessionStorage.setItem = () => { throw new Error('Quota exceeded'); };
    vi.stubGlobal('document', { referrer: 'android-app://com.zimestimate.app' });
    expect(isInstalledApp()).toBe(true);
  });
});
