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

  const fetchUserRole = useCallback(async (userId: string): Promise<AppRole | null> => {
    try {
      // Use limit(1) — avoids PGRST116 if duplicate rows ever exist
      const { data: rows, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .limit(1);

      if (roleError) {
        console.error('useAuth: user_roles fetch failed', roleError);
      }

      const fromRole = rows?.[0]?.role;
      if (fromRole) {
        return fromRole as AppRole;
      }

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (clientError) {
        console.error('useAuth: clients lookup failed', clientError);
      }

      if (clientData?.id) {
        return 'client';
      }

      return null;
    } catch (e) {
      console.error('useAuth: fetchUserRole error', e);
      return null;
    }
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
    let cancelled = false;

    const initAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('useAuth: getSession', sessionError);
        }

        if (cancelled) return;

        if (session?.user) {
          const role = await fetchUserRole(session.user.id);
          if (cancelled) return;
          setState(getAuthState(session.user, session, role));
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (e) {
        console.error('useAuth: initAuth', e);
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    void initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setTimeout(() => {
            void (async () => {
              try {
                const role = await fetchUserRole(session.user.id);
                if (cancelled) return;
                setState(getAuthState(session.user, session, role));
              } catch (e) {
                console.error('useAuth: onAuthStateChange role fetch', e);
                if (!cancelled) {
                  setState(getAuthState(session.user, session, null));
                }
              }
            })();
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

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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
