
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SimpleAudioPost from '@/components/app/SimpleAudioPost';

const HashtagPage = () => {
  const { hashtag } = useParams<{ hashtag: string }>();
  const navigate = useNavigate();

  const { data: audiosByHashtag, isLoading, error } = useQuery({
    queryKey: ['hashtag-audios', hashtag],
    queryFn: async () => {
      if (!hashtag) throw new Error('Hashtag is required');

      // Buscar por hashtag no título ou descrição
      const { data: posts, error: postsError } = await supabase
        .from('audio_posts')
        .select('*')
        .eq('status', 'active')
        .or(`title.ilike.%#${hashtag}%,description.ilike.%#${hashtag}%`)
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
    enabled: !!hashtag,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center space-x-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-2">
              <Hash className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold">{hashtag}</h1>
            </div>
          </div>
          
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-24 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center space-x-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-2">
              <Hash className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold">{hashtag}</h1>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Erro ao carregar áudios</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center space-x-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center space-x-2">
            <Hash className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold">{hashtag}</h1>
          </div>
        </div>

        {!audiosByHashtag || audiosByHashtag.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                Nenhum áudio encontrado
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Não foram encontrados áudios com a hashtag #{hashtag}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Hash className="w-5 h-5" />
                  <span>#{hashtag}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {audiosByHashtag.length} áudio{audiosByHashtag.length !== 1 ? 's' : ''} encontrado{audiosByHashtag.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            {audiosByHashtag.map((post) => (
              <SimpleAudioPost key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HashtagPage;
