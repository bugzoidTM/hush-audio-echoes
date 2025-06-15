
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

interface UseSecureAuthOptions {
  requireAuth?: boolean;
  redirectTo?: string;
  onUnauthorized?: () => void;
}

export const useSecureAuth = (options: UseSecureAuthOptions = {}) => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { requireAuth = true, redirectTo = '/auth', onUnauthorized } = options;

  useEffect(() => {
    if (!loading && requireAuth && !user) {
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        toast({
          title: "Acesso negado",
          description: "Você precisa estar logado para acessar esta página",
          variant: "destructive",
        });
        navigate(redirectTo);
      }
    }
  }, [user, loading, requireAuth, navigate, redirectTo, onUnauthorized, toast]);

  const isAuthenticated = !!user;
  const isAuthorized = !requireAuth || isAuthenticated;

  return {
    user,
    loading,
    isAuthenticated,
    isAuthorized,
  };
};
