import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

type AuthResult = {
  userId: string;
  profile: Pick<Profile, 'user_type' | 'tier'>;
};

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function requireAuth(request: Request): Promise<AuthResult | NextResponse> {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
  }

  const supabase = createServerClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_type, tier')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 403 });
  }

  return { userId: userData.user.id, profile };
}

export async function requireAdmin(request: Request): Promise<AuthResult | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const isAdmin = authResult.profile.user_type === 'admin' || authResult.profile.tier === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  return authResult;
}
