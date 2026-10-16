import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reactivateUser, suspendUser } from './admin-analytics';

const { updateUserById, updateProfile, logAuditEvent } = vi.hoisted(() => ({
  updateUserById: vi.fn(),
  updateProfile: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createServiceRoleClient: () => ({
    auth: { admin: { updateUserById } },
    from: () => ({ update: () => ({ eq: updateProfile }) }),
  }),
}));
vi.mock('@/lib/services/audit', () => ({ logAuditEvent }));

describe('admin suspension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateUserById.mockResolvedValue({ error: null });
    updateProfile.mockResolvedValue({ error: null });
    logAuditEvent.mockResolvedValue(undefined);
  });

  it('bans the Auth identity before marking the profile suspended', async () => {
    expect(await suspendUser('member-1', 'admin-1')).toEqual({ success: true });
    expect(updateUserById).toHaveBeenCalledWith('member-1', { ban_duration: '876000h' });
    expect(updateUserById.mock.invocationCallOrder[0]).toBeLessThan(updateProfile.mock.invocationCallOrder[0]);
  });

  it('does not mark a profile suspended if the Auth ban fails', async () => {
    updateUserById.mockResolvedValueOnce({ error: new Error('Auth unavailable') });
    expect(await suspendUser('member-1', 'admin-1')).toEqual({ success: false, error: 'Could not suspend this account.' });
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('unbans the Auth identity when an admin reactivates the account', async () => {
    expect(await reactivateUser('member-1', 'admin-1')).toEqual({ success: true });
    expect(updateUserById).toHaveBeenCalledWith('member-1', { ban_duration: 'none' });
    expect(updateUserById.mock.invocationCallOrder[0]).toBeLessThan(updateProfile.mock.invocationCallOrder[0]);
  });
});
