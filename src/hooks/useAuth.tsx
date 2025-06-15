
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useSecurityLogger } from './useSecurityLogger';
import { useContentSecurityPolicy } from './useContentSecurityPolicy';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Enhanced cleanup function with security logging
const cleanupAuthState = () => {
  console.log('🔒 Cleaning up authentication state');
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { logLoginAttempt, logSuspiciousActivity } = useSecurityLogger();
  
  // Apply CSP and security headers
  useContentSecurityPolicy();

  useEffect(() => {
    let mounted = true;

    // Enhanced auth state change listener with security logging
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event, session?.user?.email);
        
        // Log authentication events
        if (event === 'SIGNED_IN' && session?.user) {
          logLoginAttempt(session.user.email || 'unknown', true);
        } else if (event === 'SIGNED_OUT') {
          console.log('🔒 User signed out, cleaning up state');
          cleanupAuthState();
        }
        
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_OUT') {
          cleanupAuthState();
        }
        
        // Detect potential session hijacking
        if (session && event === 'TOKEN_REFRESHED') {
          const currentFingerprint = navigator.userAgent + screen.width + screen.height;
          const storedFingerprint = localStorage.getItem('user_fingerprint');
          
          if (storedFingerprint && storedFingerprint !== currentFingerprint) {
            logSuspiciousActivity('potential_session_hijacking', {
              currentFingerprint,
              storedFingerprint,
              userId: session.user.id
            });
          } else if (!storedFingerprint) {
            localStorage.setItem('user_fingerprint', currentFingerprint);
          }
        }
        
        setLoading(false);
      }
    );

    // Get initial session with enhanced error handling
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
          logSuspiciousActivity('session_retrieval_error', {
            error: error.message
          });
          cleanupAuthState();
        }
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          
          // Set user fingerprint for session security
          if (session) {
            const fingerprint = navigator.userAgent + screen.width + screen.height;
            localStorage.setItem('user_fingerprint', fingerprint);
          }
        }
      } catch (error) {
        console.error('💥 Erro na inicialização da auth:', error);
        logSuspiciousActivity('auth_initialization_error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [logLoginAttempt, logSuspiciousActivity]);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting sign in for:', email);
      cleanupAuthState();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logLoginAttempt(email, false, error.message);
        throw error;
      }

      if (data.user) {
        logLoginAttempt(email, true);
        // Set security fingerprint
        const fingerprint = navigator.userAgent + screen.width + screen.height;
        localStorage.setItem('user_fingerprint', fingerprint);
        
        // Force page refresh for clean state
        setTimeout(() => {
          window.location.href = '/shhhh';
        }, 100);
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    try {
      cleanupAuthState();
      
      const redirectUrl = `${window.location.origin}/shhhh`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username,
          }
        }
      });

      if (data.user && !error) {
        logLoginAttempt(email, true);
      } else if (error) {
        logLoginAttempt(email, false, error.message);
      }

      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log('🔐 Signing out user');
      cleanupAuthState();
      localStorage.removeItem('user_fingerprint');
      await supabase.auth.signOut({ scope: 'global' });
      window.location.href = '/';
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      logSuspiciousActivity('logout_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
