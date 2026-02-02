'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile, UserTier, TIER_LIMITS } from '@/lib/database.types';

interface AuthState {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
    // Auth methods
    signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signInWithGoogle: () => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;

    // Profile methods
    refreshProfile: () => Promise<void>;
    updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;

    // Tier helpers
    canCreateProject: () => boolean;
    canUseAIFeatures: () => boolean;
    canUseAdvancedExport: () => boolean;
    projectCount: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [projectCount, setProjectCount] = useState(0);

    // Fetch user profile from database
    const fetchProfile = useCallback(async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }

        return data as Profile;
    }, []);

    // Fetch user's project count
    const fetchProjectCount = useCallback(async (userId: string) => {
        const { count, error } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('owner_id', userId)
            .neq('status', 'archived');

        if (error) {
            console.error('Error fetching project count:', error);
            return 0;
        }

        return count || 0;
    }, []);

    // Initialize auth state
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Get current session
                const { data: { session: currentSession } } = await supabase.auth.getSession();

                if (currentSession?.user) {
                    setSession(currentSession);
                    setUser(currentSession.user);

                    const userProfile = await fetchProfile(currentSession.user.id);
                    setProfile(userProfile);

                    const count = await fetchProjectCount(currentSession.user.id);
                    setProjectCount(count);
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                setSession(newSession);
                setUser(newSession?.user ?? null);

                if (newSession?.user) {
                    // Small delay to allow profile trigger to complete
                    setTimeout(async () => {
                        const userProfile = await fetchProfile(newSession.user.id);
                        setProfile(userProfile);

                        const count = await fetchProjectCount(newSession.user.id);
                        setProjectCount(count);
                    }, 100);
                } else {
                    setProfile(null);
                    setProjectCount(0);
                }

                setIsLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchProfile, fetchProjectCount]);

    // Sign up with email and password
    const signUp = async (email: string, password: string, fullName?: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        });

        return { error };
    };

    // Sign in with email and password
    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        return { error };
    };

    // Sign in with Google OAuth
    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        return { error };
    };

    // Sign out
    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setSession(null);
        setProjectCount(0);
    };

    // Refresh profile data
    const refreshProfile = async () => {
        if (!user) return;

        const userProfile = await fetchProfile(user.id);
        setProfile(userProfile);

        const count = await fetchProjectCount(user.id);
        setProjectCount(count);
    };

    // Update profile
    const updateProfile = async (updates: Partial<Profile>) => {
        if (!user) {
            return { error: new Error('Not authenticated') };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (!error) {
            await refreshProfile();
        }

        return { error: error ? new Error(error.message) : null };
    };

    // Tier check helpers
    const canCreateProject = () => {
        if (!profile) return false;
        const limits = TIER_LIMITS[profile.tier];
        return projectCount < limits.maxProjects;
    };

    const canUseAIFeatures = () => {
        if (!profile) return false;
        return TIER_LIMITS[profile.tier].aiFeatures;
    };

    const canUseAdvancedExport = () => {
        if (!profile) return false;
        return TIER_LIMITS[profile.tier].advancedExport;
    };

    const value: AuthContextType = {
        user,
        profile,
        session,
        isLoading,
        isAuthenticated: !!user,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        refreshProfile,
        updateProfile,
        canCreateProject,
        canUseAIFeatures,
        canUseAdvancedExport,
        projectCount,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
