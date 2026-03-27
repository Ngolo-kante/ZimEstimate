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
        .select('tier')
        .eq('id', user.id)
        .single();

      const p = profile as { tier: string } | null;
      if (!p || p.tier !== 'admin') {
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
