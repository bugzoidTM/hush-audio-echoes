
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Hash } from 'lucide-react';
import SimpleAudioPost from '@/components/app/SimpleAudioPost';

const HashtagPage = () => {
  const { hashtag } = useParams();
  const navigate = useNavigate();

  const { data: audioPosts, isLoading, error } = useQuery({
    queryKey: ['hashtag-posts', hashtag],
    queryFn: async () => {
      if (!hashtag) return [];

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
        .ilike('description', `%#${hashtag}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!hashtag,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
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
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Erro ao carregar áudios da hashtag</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/app')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <div className="flex items-center space-x-2">
            <Hash className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">#{hashtag}</h1>
          </div>
          
          <p className="text-muted-foreground mt-2">
            {audioPosts?.length || 0} áudios encontrados
          </p>
        </div>

        {/* Posts */}
        {!audioPosts || audioPosts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Hash className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhum áudio encontrado</h3>
              <p className="text-muted-foreground">
                Seja o primeiro a usar a hashtag #{hashtag}!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {audioPosts.map((post) => (
              <SimpleAudioPost key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HashtagPage;
