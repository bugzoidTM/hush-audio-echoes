
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
      const { data, error } = await supabase
        .from('audio_posts')
        .select(`
          *,
          profiles!audio_posts_user_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          likes (
            user_id
          )
        `)
        .eq('status', 'active')
        .or(`title.ilike.%#${hashtag}%,description.ilike.%#${hashtag}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Mapear os dados para o formato esperado
      return data?.map(post => ({
        ...post,
        profiles: post.profiles ? {
          username: post.profiles.username || null,
          display_name: post.profiles.display_name || null,
          avatar_url: post.profiles.avatar_url || null
        } : null
      })) || [];
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
