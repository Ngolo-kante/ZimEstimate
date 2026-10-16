import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('readiness response', () => {
  it('does not disclose environment variable names to the public', async () => {
    const response = await GET();
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['service', 'status']);
  });
});
