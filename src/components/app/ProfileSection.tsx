
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ShhhhAudioPost from './ShhhhAudioPost';
import { Mic } from 'lucide-react';

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
        const { data: postsData } = await supabase
          .from('audio_posts')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        
        if (postsData) {
          // Buscar likes para cada post
          const postsWithData = [];
          for (const post of postsData) {
            const { data: likesData } = await supabase
              .from('likes')
              .select('user_id')
              .eq('audio_id', post.id);

            const postWithData = {
              ...post,
              profiles: userProfile,
              likes: likesData || []
            };
            postsWithData.push(postWithData);
          }
          setUserPosts(postsWithData);
        } else {
          setUserPosts([]);
        }
      };
      
      fetchProfile();
      fetchUserPosts();
    }
  }, [user, userProfile]);

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
            <p className="font-semibold">{userProfile?.followers_count || 0}</p>
            <p className="text-sm text-muted-foreground">seguidores</p>
          </div>
          <div>
            <p className="font-semibold">{userProfile?.following_count || 0}</p>
            <p className="text-sm text-muted-foreground">seguindo</p>
          </div>
        </div>
      </div>

      {/* Posts do Usuário */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Meus Posts</h3>
        
        {userPosts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Mic className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhum áudio ainda</h3>
              <p className="text-muted-foreground">
                Você ainda não compartilhou nenhum áudio temporário!
              </p>
            </CardContent>
          </Card>
        ) : (
          userPosts.map((post) => (
            <ShhhhAudioPost key={post.id} post={post} />
          ))
        )}
      </div>
    </div>
  );
};

export default ProfileSection;
