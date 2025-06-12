import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import UpdatedAppHeader from '@/components/app/UpdatedAppHeader';
import UpdatedAudioFeed from '@/components/app/UpdatedAudioFeed';
import { Toaster } from '@/components/ui/toaster';

const UpdatedApp = () => {
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
      <UpdatedAppHeader />
      <main className="container mx-auto px-4 py-6">
        <UpdatedAudioFeed />
      </main>
      <Toaster />
    </div>
  );
};

export default UpdatedApp;
