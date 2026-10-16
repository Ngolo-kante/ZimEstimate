import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAdmin, requireAuth } from './auth';

const getUser = vi.fn();
const single = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}));

const request = () => new Request('https://zimestimate.com/api/admin/overview', {
  headers: { authorization: 'Bearer valid-session' },
});

describe('server authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('rejects a suspended account even with a valid access token', async () => {
    single.mockResolvedValue({ data: { user_type: 'admin', tier: 'admin', is_suspended: true }, error: null });
    const result = await requireAdmin(request());
    expect(result).toHaveProperty('status', 403);
    if (result instanceof Response) {
      expect(await result.json()).toEqual({ error: 'Account suspended.' });
    }
  });

  it('allows an active account and retains its server-side role check', async () => {
    single.mockResolvedValue({ data: { user_type: 'builder', tier: 'free', is_suspended: false }, error: null });
    expect(await requireAuth(request())).toEqual({
      userId: 'user-1',
      profile: { user_type: 'builder', tier: 'free', is_suspended: false },
    });
    expect(await requireAdmin(request())).toHaveProperty('status', 403);
  });
});
