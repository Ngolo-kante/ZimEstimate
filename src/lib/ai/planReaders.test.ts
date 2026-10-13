import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWithFirstAvailable } from './planReaders';
import { generateWithFailover } from './gemini';
import { visionChat } from './openaiCompatible';

vi.mock('./gemini', () => ({
  GeminiCallError: class extends Error {},
  generateWithFailover: vi.fn(),
}));
vi.mock('./openaiCompatible', () => ({ visionChat: vi.fn() }));

const request = {
  prompt: 'Read this plan',
  original: { mimeType: 'application/pdf', base64: 'pdf' },
  readingCopy: { mimeType: 'image/jpeg', base64: 'image' },
  maxOutputTokens: 100,
  deadlineMs: 8000,
  accept: (reply: string) => reply === '{"rooms":[{"name":"Kitchen"}]}',
};

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('plan reader fallback', () => {
  it('uses an image reader when Gemini is not configured', async () => {
    vi.stubEnv('GOOGLE_GEMINI_API_KEY', '');
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.mocked(visionChat).mockResolvedValue('{"rooms":[{"name":"Kitchen"}]}');

    const result = await readWithFirstAvailable(request);
    expect(result.provider).toBe('nvidia');
    expect(generateWithFailover).not.toHaveBeenCalled();
  });

  it('returns the first usable reply and cancels the slower reader', async () => {
    vi.stubEnv('GOOGLE_GEMINI_API_KEY', 'test-key');
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    let cancelled = false;
    vi.mocked(generateWithFailover).mockImplementation(async ({ signal }) => new Promise((_, reject) => {
      signal?.addEventListener('abort', () => { cancelled = true; reject(new Error('stopped')); }, { once: true });
    }));
    vi.mocked(visionChat).mockResolvedValue('{"rooms":[{"name":"Kitchen"}]}');

    const result = await readWithFirstAvailable(request);
    expect(result.provider).toBe('nvidia');
    expect(cancelled).toBe(true);
  });
});
