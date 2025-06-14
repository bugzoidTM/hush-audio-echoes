
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ProfileSection = () => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState([]);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setUserProfile(data);
      };

      const fetchUserPosts = async () => {
        const { data } = await supabase
          .from('audio_posts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        setUserPosts(data || []);
      };
      
      fetchProfile();
      fetchUserPosts();
    }
  }, [user]);

  const displayName = userProfile?.display_name || userProfile?.username || 'Usuário';

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-4">
        <Avatar className="w-24 h-24 mx-auto">
          <AvatarImage src={userProfile?.avatar_url} />
          <AvatarFallback className="text-2xl">
            {displayName[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        
        <div>
          <h2 className="text-xl font-semibold">{displayName}</h2>
          <p className="text-muted-foreground">
            {userProfile?.bio || 'Compartilhando áudios temporários'}
          </p>
        </div>
        
        <div className="flex justify-center space-x-8 text-center">
          <div>
            <p className="font-semibold">{userPosts.length}</p>
            <p className="text-sm text-muted-foreground">áudios</p>
          </div>
          <div>
            <p className="font-semibold">0</p>
            <p className="text-sm text-muted-foreground">seguidores</p>
          </div>
          <div>
            <p className="font-semibold">0</p>
            <p className="text-sm text-muted-foreground">seguindo</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSection;
