// ─── Vision models behind the common "chat completions" API ──────────────────
// NVIDIA (build.nvidia.com) and OpenRouter both accept the same request shape,
// so one small caller serves both. Used as free backup plan readers alongside
// Gemini (lib/ai/planReaders.ts).

import { GeminiCallError } from './gemini';

export type VisionChatRequest = {
  url: string;
  apiKey: string;
  model: string;
  prompt: string;
  image: { mimeType: string; base64: string };
  maxTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
};

export async function visionChat(request: VisionChatRequest): Promise<string> {
  const doFetch = request.fetchImpl ?? fetch;
  const timeout = AbortSignal.timeout(request.timeoutMs);
  let response: Response;
  try {
    response = await doFetch(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${request.apiKey}`, ...(request.headers ?? {}) },
      body: JSON.stringify({
        model: request.model,
        temperature: 0.1,
        max_tokens: request.maxTokens,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: request.prompt },
            { type: 'image_url', image_url: { url: `data:${request.image.mimeType};base64,${request.image.base64}` } },
          ],
        }],
      }),
      signal: request.signal ? AbortSignal.any([timeout, request.signal]) : timeout,
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new GeminiCallError(`${request.model} ${timedOut ? 'timed out' : String(error)}`, undefined, timedOut ? 'AbortError' : 'GeminiCallError');
  }
  if (!response.ok) {
    const message = await response.text().then((t) => t.replace(/\s+/g, ' ').slice(0, 200)).catch(() => '');
    throw new GeminiCallError(`${request.model} answered ${response.status}: ${message}`, response.status);
  }
  const body = await response.json().catch(() => null) as { choices?: { message?: { content?: string | null } }[] } | null;
  const text = body?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new GeminiCallError(`${request.model} returned an empty reply`, 502);
  return text;
}
