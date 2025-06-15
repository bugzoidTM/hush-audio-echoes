
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
      console.log('🎵 Iniciando busca por posts de áudio...');
      
      try {
        // Buscar posts básicos
        const { data: postsData, error: postsError } = await supabase
          .from('audio_posts')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (postsError) {
          console.error('❌ Erro ao buscar posts básicos:', postsError);
          throw postsError;
        }

        console.log('📝 Posts básicos encontrados:', postsData?.length || 0);

        if (!postsData || postsData.length === 0) {
          console.log('📭 Nenhum post encontrado');
          return [];
        }

        // Buscar profiles
        const userIds = [...new Set(postsData.map(post => post.user_id))];
        console.log('👥 Buscando profiles para usuários:', userIds);

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        if (profilesError) {
          console.error('❌ Erro ao buscar profiles:', profilesError);
        }

        console.log('👤 Profiles encontrados:', profilesData?.length || 0);

        // Buscar likes
        const postIds = postsData.map(post => post.id);
        const { data: likesData, error: likesError } = await supabase
          .from('likes')
          .select('user_id, audio_id')
          .in('audio_id', postIds);

        if (likesError) {
          console.error('❌ Erro ao buscar likes:', likesError);
        }

        console.log('❤️ Likes encontrados:', likesData?.length || 0);

        // Buscar reposts
        const { data: repostsData, error: repostsError } = await supabase
          .from('audio_reposts')
          .select('user_id, original_audio_id')
          .in('original_audio_id', postIds);

        if (repostsError) {
          console.error('❌ Erro ao buscar reposts:', repostsError);
        }

        console.log('🔄 Reposts encontrados:', repostsData?.length || 0);

        // Combinar os dados
        const combinedData = postsData.map(post => {
          const profile = profilesData?.find(p => p.id === post.user_id);
          const postLikes = likesData?.filter(like => like.audio_id === post.id) || [];
          const postReposts = repostsData?.filter(repost => repost.original_audio_id === post.id) || [];
          
          return {
            ...post,
            profiles: profile ? {
              username: profile.username,
              avatar_url: profile.avatar_url
            } : null,
            likes: postLikes,
            likes_count: postLikes.length,
            reposts: postReposts,
            reposts_count: postReposts.length
          };
        });

        console.log('✅ Dados combinados finais:', combinedData.length, 'posts');
        return combinedData as AudioPost[];

      } catch (error) {
        console.error('💥 Erro geral na busca:', error);
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    console.log('⏳ Carregando posts...');
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
    console.error('❌ Erro no feed:', error);
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Erro ao carregar áudios</p>
          <p className="text-xs text-red-500 mb-4">
            {error instanceof Error ? error.message : 'Erro desconhecido'}
          </p>
          <button 
            onClick={() => {
              console.log('🔄 Tentando recarregar...');
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
    console.log('📭 Nenhum post para exibir');
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

  console.log('🎉 Exibindo', audioPosts.length, 'posts');
  return (
    <div className="space-y-6">
      {audioPosts?.map((post) => (
        <SimpleAudioPost key={post.id} post={post} />
      ))}
    </div>
  );
};

export default SimpleAudioFeed;
