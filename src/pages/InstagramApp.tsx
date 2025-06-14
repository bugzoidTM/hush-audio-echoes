
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import InstagramLayout from '@/components/app/InstagramLayout';
import InstagramFeed from '@/components/app/InstagramFeed';
import SearchSection from '@/components/app/SearchSection';
import ExploreSection from '@/components/app/ExploreSection';
import NotificationsSection from '@/components/app/NotificationsSection';
import ProfileSection from '@/components/app/ProfileSection';
import { Toaster } from '@/components/ui/toaster';

const InstagramApp = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('home');

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

  const renderContent = () => {
    switch (activeSection) {
      case 'search':
        return <SearchSection />;
      case 'explore':
        return <ExploreSection />;
      case 'notifications':
        return <NotificationsSection />;
      case 'profile':
        return <ProfileSection />;
      default:
        return <InstagramFeed />;
    }
  };

  return (
    <>
      <InstagramLayout onSectionChange={setActiveSection}>
        {renderContent()}
      </InstagramLayout>
      <Toaster />
    </>
  );
};

export default InstagramApp;
