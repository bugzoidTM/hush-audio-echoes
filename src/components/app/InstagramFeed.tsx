
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import InstagramAudioPost from './InstagramAudioPost';
import { Card, CardContent } from '@/components/ui/card';
import { Mic } from 'lucide-react';

const InstagramFeed = () => {
  const { data: audioPosts, isLoading, error } = useQuery({
    queryKey: ['instagram-audio-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audio_posts')
        .select(`
          *,
          profiles:profiles!audio_posts_user_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          likes (
            user_id
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Mapear os dados para garantir que tenham todas as propriedades necessárias
      return data?.map(post => ({
        ...post,
        replies_count: post.replies_count || 0,
        reposts_count: post.reposts_count || 0,
        profiles: post.profiles || { username: null, display_name: null, avatar_url: null }
      })) || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-muted rounded-full"></div>
                <div className="h-4 bg-muted rounded w-24"></div>
              </div>
              <div className="h-32 bg-muted rounded mb-4"></div>
              <div className="flex space-x-4">
                <div className="h-8 bg-muted rounded w-16"></div>
                <div className="h-8 bg-muted rounded w-16"></div>
                <div className="h-8 bg-muted rounded w-16"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Erro ao carregar áudios</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {!audioPosts || audioPosts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Mic className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum áudio ainda</h3>
            <p className="text-muted-foreground">
              Seja o primeiro a compartilhar um áudio temporário!
            </p>
          </CardContent>
        </Card>
      ) : (
        audioPosts.map((post) => (
          <InstagramAudioPost key={post.id} post={post} />
        ))
      )}
    </div>
  );
};

export default InstagramFeed;
