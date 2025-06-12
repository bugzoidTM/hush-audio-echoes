
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AudioPost from './AudioPost';
import { Card, CardContent } from '@/components/ui/card';
import { Mic } from 'lucide-react';

const AudioFeed = () => {
  const { data: audioPosts, isLoading, error } = useQuery({
    queryKey: ['audio-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audio_posts')
        .select(`
          *,
          profiles:user_id (
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
      return data;
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
            Seja o primeiro a compartilhar um áudio efêmero!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {audioPosts.map((post) => (
        <AudioPost key={post.id} post={post} />
      ))}
    </div>
  );
};

export default AudioFeed;
