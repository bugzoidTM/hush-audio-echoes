
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import SimpleAppHeader from '@/components/app/SimpleAppHeader';
import SimpleAudioFeed from '@/components/app/SimpleAudioFeed';
import { Toaster } from '@/components/ui/toaster';

const SimpleApp = () => {
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
    <div className="min-h-screen bg-background">
      <SimpleAppHeader />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <SimpleAudioFeed />
      </main>
      <Toaster />
    </div>
  );
};

export default SimpleApp;
