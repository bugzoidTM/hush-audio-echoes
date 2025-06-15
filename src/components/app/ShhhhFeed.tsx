
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import ShhhhAudioPost from './ShhhhAudioPost';
import { Card, CardContent } from '@/components/ui/card';
import { Mic } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const ShhhhFeed = () => {
  const { user } = useAuth();
  
  const { data: audioPosts, isLoading, error } = useQuery({
    queryKey: ['audio-posts', user?.id],
    queryFn: async () => {
      const { data: posts, error: postsError } = await supabase
        .from('audio_posts')
        .select('*')
        .eq('status', 'active')
        .neq('user_id', user?.id || '') // Excluir posts do usuário logado
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      if (!posts || posts.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(posts.map(post => post.user_id).filter(Boolean))];
      
      // Fetch profiles for all users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Fetch likes for all posts
      const { data: likes, error: likesError } = await supabase
        .from('likes')
        .select('user_id, audio_id')
        .in('audio_id', posts.map(post => post.id));

      if (likesError) throw likesError;

      // Combine data
      return posts.map(post => ({
        ...post,
        profiles: profiles?.find(profile => profile.id === post.user_id) || null,
        likes: likes?.filter(like => like.audio_id === post.id) || []
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-24 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Erro ao carregar áudios</p>
        </CardContent>
      </Card>
    );
  }

  if (!audioPosts || audioPosts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Mic className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Nenhum áudio ainda</h3>
          <p className="text-muted-foreground">
            Seja o primeiro a compartilhar um áudio temporário!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {audioPosts.map((post) => (
        <ShhhhAudioPost key={post.id} post={post} />
      ))}
    </div>
  );
};

export default ShhhhFeed;
