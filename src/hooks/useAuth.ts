import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

type AppRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'client';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isLoading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  canManageAdmins: boolean;
  canManageContent: boolean;
  canUpload: boolean;
  canDelete: boolean;
}

// Role-based permissions
const ROLE_PERMISSIONS = {
  owner: { manageAdmins: true, manageContent: true, upload: true, delete: true },
  admin: { manageAdmins: false, manageContent: true, upload: true, delete: true },
  editor: { manageAdmins: false, manageContent: true, upload: true, delete: false },
  viewer: { manageAdmins: false, manageContent: false, upload: false, delete: false },
  client: { manageAdmins: false, manageContent: false, upload: false, delete: false },
};

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    isLoading: true,
    isAdmin: false,
    isOwner: false,
    canManageAdmins: false,
    canManageContent: false,
    canUpload: false,
    canDelete: false,
  });

  const fetchUserRole = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    return (data?.role as AppRole) || null;
  }, []);

  const getAuthState = useCallback((user: User | null, session: Session | null, role: AppRole | null): AuthState => {
    const permissions = role ? ROLE_PERMISSIONS[role] : null;
    const isAdminRole = role === 'owner' || role === 'admin' || role === 'editor' || role === 'viewer';
    
    return {
      user,
      session,
      role,
      isLoading: false,
      isAdmin: isAdminRole,
      isOwner: role === 'owner',
      canManageAdmins: permissions?.manageAdmins ?? false,
      canManageContent: permissions?.manageContent ?? false,
      canUpload: permissions?.upload ?? false,
      canDelete: permissions?.delete ?? false,
    };
  }, []);

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const role = await fetchUserRole(session.user.id);
        setState(getAuthState(session.user, session, role));
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          // Defer the role fetch to avoid deadlock
          setTimeout(async () => {
            const role = await fetchUserRole(session.user.id);
            setState(getAuthState(session.user, session, role));
          }, 0);
        } else {
          setState({
            user: null,
            session: null,
            role: null,
            isLoading: false,
            isAdmin: false,
            isOwner: false,
            canManageAdmins: false,
            canManageContent: false,
            canUpload: false,
            canDelete: false,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserRole, getAuthState]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    ...state,
    signIn,
    signOut,
  };
};
