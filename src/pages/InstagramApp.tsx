
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import InstagramLayout from '@/components/app/InstagramLayout';
import InstagramFeed from '@/components/app/InstagramFeed';
import { Toaster } from '@/components/ui/toaster';

const InstagramApp = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <InstagramLayout>
        <InstagramFeed />
      </InstagramLayout>
      <Toaster />
    </>
  );
};

export default InstagramApp;
