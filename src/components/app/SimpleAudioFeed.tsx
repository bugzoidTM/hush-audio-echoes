
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
  expires_at: string;
  user_id: string;
  likes_count: number;
  replies_count: number;
  reposts_count: number;
  profiles?: {
    username?: string;
    avatar_url?: string;
  } | null;
  likes?: Array<{ user_id: string }>;
  reposts?: Array<{ user_id: string }>;
}

const SimpleAudioFeed = () => {
  const { data: audioPosts, isLoading, error, refetch } = useQuery({
    queryKey: ['audio-posts'],
    queryFn: async () => {
      console.log('🎵 [SimpleAudioFeed] Buscando posts de áudio...');
      
      try {
        // 1. Buscar posts básicos
        const { data: postsData, error: postsError } = await supabase
          .from('audio_posts')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (postsError) {
          console.error('❌ [SimpleAudioFeed] Erro ao buscar posts:', postsError);
          throw postsError;
        }

        if (!postsData || postsData.length === 0) {
          console.log('📭 [SimpleAudioFeed] Nenhum post encontrado');
          return [];
        }

        console.log('📝 [SimpleAudioFeed] Posts encontrados:', postsData.length);

        // 2. Buscar profiles dos usuários
        const userIds = [...new Set(postsData.map(post => post.user_id))];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        if (profilesError) {
          console.error('❌ [SimpleAudioFeed] Erro ao buscar profiles:', profilesError);
        }

        // 3. Buscar todos os likes de uma vez
        const postIds = postsData.map(post => post.id);
        const { data: likesData, error: likesError } = await supabase
          .from('likes')
          .select('user_id, audio_id')
          .in('audio_id', postIds);

        if (likesError) {
          console.error('❌ [SimpleAudioFeed] Erro ao buscar likes:', likesError);
        }

        // 4. Buscar reposts
        const { data: repostsData, error: repostsError } = await supabase
          .from('audio_reposts')
          .select('user_id, original_audio_id')
          .in('original_audio_id', postIds);

        if (repostsError) {
          console.error('❌ [SimpleAudioFeed] Erro ao buscar reposts:', repostsError);
        }

        // 5. Combinar todos os dados
        const enrichedPosts = postsData.map(post => {
          const profile = profilesData?.find(p => p.id === post.user_id);
          const postLikes = likesData?.filter(like => like.audio_id === post.id) || [];
          const postReposts = repostsData?.filter(repost => repost.original_audio_id === post.id) || [];
          
          // Usar contagem real dos likes, não a do cache
          const realLikesCount = postLikes.length;
          
          console.log(`📊 [SimpleAudioFeed] Post ${post.id} - Likes: ${realLikesCount}`, {
            dbCount: post.likes_count,
            realCount: realLikesCount,
            likesArray: postLikes.length
          });
          
          return {
            ...post,
            profiles: profile ? {
              username: profile.username,
              avatar_url: profile.avatar_url
            } : null,
            likes: postLikes,
            likes_count: realLikesCount, // SEMPRE usar contagem real
            reposts: postReposts,
            reposts_count: postReposts.length
          };
        });

        console.log('✅ [SimpleAudioFeed] Posts enriquecidos:', enrichedPosts.length);
        return enrichedPosts as AudioPost[];

      } catch (error) {
        console.error('💥 [SimpleAudioFeed] Erro geral:', error);
        throw error;
      }
    },
    staleTime: 1000 * 10, // 10 segundos - mais agressivo para atualizações
    gcTime: 1000 * 60 * 2, // 2 minutos - cache menor
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Reativar para garantir dados frescos
    refetchInterval: false,
  });

  if (isLoading) {
    console.log('⏳ [SimpleAudioFeed] Carregando posts...');
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
    console.error('❌ [SimpleAudioFeed] Erro no feed:', error);
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Erro ao carregar áudios</p>
          <p className="text-xs text-red-500 mb-4">
            {error instanceof Error ? error.message : 'Erro desconhecido'}
          </p>
          <button 
            onClick={() => {
              console.log('🔄 [SimpleAudioFeed] Tentando recarregar...');
              refetch();
            }}
            className="text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!audioPosts || audioPosts.length === 0) {
    console.log('📭 [SimpleAudioFeed] Nenhum post para exibir');
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

  console.log('🎉 [SimpleAudioFeed] Exibindo', audioPosts.length, 'posts');
  return (
    <div className="space-y-6">
      {audioPosts?.map((post) => (
        <SimpleAudioPost key={post.id} post={post} />
      ))}
    </div>
  );
};

export default SimpleAudioFeed;
