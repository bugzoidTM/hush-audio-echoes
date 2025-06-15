
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import ShhhhAudioPost from './ShhhhAudioPost';
import { Card, CardContent } from '@/components/ui/card';
import { Mic } from 'lucide-react';
import { useSecureAuth } from '@/hooks/useSecureAuth';

const ShhhhFeed = () => {
  const { user, isAuthenticated } = useSecureAuth({ requireAuth: false });
  const queryClient = useQueryClient();
  
  const { data: audioPosts, isLoading, error } = useQuery({
    queryKey: ['audio-posts', user?.id],
    queryFn: async () => {
      console.log('🔍 [ShhhhFeed] Buscando posts de áudio...');
      
      try {
        // Build the query with proper authorization checks
        let query = supabase
          .from('audio_posts')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        // If user is authenticated, exclude their own posts
        if (isAuthenticated && user) {
          query = query.neq('user_id', user.id);
        }

        const { data: posts, error: postsError } = await query;

        if (postsError) {
          console.error('❌ [ShhhhFeed] Erro ao buscar posts:', postsError);
          throw postsError;
        }

        if (!posts || posts.length === 0) {
          console.log('📭 [ShhhhFeed] Nenhum post encontrado');
          return [];
        }

        // Get unique user IDs
        const userIds = [...new Set(posts.map(post => post.user_id).filter(Boolean))];
        
        // Fetch profiles for all users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        if (profilesError) {
          console.error('❌ [ShhhhFeed] Erro ao buscar profiles:', profilesError);
          throw profilesError;
        }

        // Fetch likes for all posts (only if user is authenticated)
        let likes: any[] = [];
        if (isAuthenticated) {
          const { data: likesData, error: likesError } = await supabase
            .from('likes')
            .select('user_id, audio_id')
            .in('audio_id', posts.map(post => post.id));

          if (likesError) {
            console.error('❌ [ShhhhFeed] Erro ao buscar likes:', likesError);
          } else {
            likes = likesData || [];
          }
        }

        // Combine data and calculate likes_count
        const enrichedPosts = posts.map(post => {
          const postLikes = likes.filter(like => like.audio_id === post.id);
          return {
            ...post,
            profiles: profiles?.find(profile => profile.id === post.user_id) || null,
            likes: postLikes,
            likes_count: post.likes_count || 0, // Use the database likes_count
            replies_count: post.replies_count || 0
          };
        });

        console.log('✅ [ShhhhFeed] Posts carregados:', enrichedPosts.length);
        return enrichedPosts;

      } catch (error) {
        console.error('💥 [ShhhhFeed] Erro geral:', error);
        throw error;
      }
    },
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.code === '42501' || error?.code === 'PGRST301') {
        return false;
      }
      return failureCount < 3;
    },
  });

  const handlePostDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ['audio-posts', user?.id] });
  };

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
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">
            {errorMessage.includes('42501') 
              ? 'Você precisa estar logado para ver os posts' 
              : 'Erro ao carregar áudios'
            }
          </p>
          {!isAuthenticated && (
            <p className="text-sm text-blue-600 mt-2">
              <a href="/auth">Faça login para continuar</a>
            </p>
          )}
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
            {isAuthenticated 
              ? 'Seja o primeiro a compartilhar um áudio temporário!' 
              : 'Faça login para ver e compartilhar áudios!'
            }
          </p>
          {!isAuthenticated && (
            <p className="text-sm text-blue-600 mt-2">
              <a href="/auth">Entrar agora</a>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {audioPosts.map((post) => (
        <ShhhhAudioPost 
          key={post.id} 
          post={post} 
          onPostDeleted={handlePostDeleted}
        />
      ))}
    </div>
  );
};

export default ShhhhFeed;
