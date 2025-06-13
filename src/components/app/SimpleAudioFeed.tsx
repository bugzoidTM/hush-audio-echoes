
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import SimpleAudioPost from './SimpleAudioPost';
import { Card, CardContent } from '@/components/ui/card';
import { Mic } from 'lucide-react';

interface AudioPost {
  id: string;
  description: string;
  audio_url: string;
  duration: number;
  created_at: string;
  user_id: string;
  likes_count: number;
  profiles?: {
    username?: string;
    avatar_url?: string;
  } | null;
  likes?: Array<{ user_id: string }>;
}

const SimpleAudioFeed = () => {
  const { data: audioPosts, isLoading, error, refetch } = useQuery({
    queryKey: ['audio-posts'],
    queryFn: async () => {
      console.log('Buscando posts de áudio...');
      
      const { data, error } = await supabase
        .from('audio_posts')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          ),
          likes (
            user_id
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar posts:', error);
        throw error;
      }
      
      console.log('Posts encontrados:', data);
      return data as AudioPost[];
    },
    refetchInterval: 30000,
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
    console.error('Erro no feed:', error);
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Erro ao carregar áudios</p>
          <button 
            onClick={() => refetch()}
            className="text-primary hover:underline"
          >
            Tentar novamente
          </button>
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
            Seja o primeiro a compartilhar um áudio efêmero!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {audioPosts?.map((post) => (
        <SimpleAudioPost key={post.id} post={post} />
      ))}
    </div>
  );
};

export default SimpleAudioFeed;
