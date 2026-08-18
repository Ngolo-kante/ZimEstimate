import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function useAdminAuth() {
  const router = useRouter();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type, tier')
        .eq('id', user.id)
        .single();

      const p = profile as { user_type: string; tier: string } | null;
      const isAdmin = p?.user_type === 'admin' || p?.tier === 'admin';
      if (!isAdmin) {
        router.push('/');
        return;
      }

      setAdminId(user.id);
      setChecking(false);
    };

    check();
  }, [router]);

  return { adminId, checking };
}
