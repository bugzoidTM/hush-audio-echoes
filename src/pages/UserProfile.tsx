
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import FollowButton from '@/components/app/FollowButton';
import InstagramAudioPost from '@/components/app/InstagramAudioPost';

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) return;

      try {
        // Buscar perfil do usuário
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        // Buscar posts do usuário
        const { data: postsData, error: postsError } = await supabase
          .from('audio_posts')
          .select(`
            *,
            profiles (username, avatar_url),
            likes (user_id)
          `)
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (postsError) throw postsError;
        setPosts(postsData || []);

      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Usuário não encontrado</h2>
          <Button onClick={() => navigate('/instagram')}>Voltar</Button>
        </div>
      </div>
    );
  }

  const isOwnProfile = user?.id === userId;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center space-x-4 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/instagram')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-semibold">{profile.username || 'Usuário'}</h1>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Informações do Perfil */}
        <div className="flex items-start space-x-6 mb-8">
          <Avatar className="w-24 h-24">
            <AvatarImage src={profile.avatar_url} />
            <AvatarFallback className="text-2xl">
              {profile.display_name?.[0]?.toUpperCase() || 
               profile.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-4">
              <h2 className="text-2xl font-semibold">
                {profile.display_name || profile.username || 'Usuário'}
              </h2>
              
              {!isOwnProfile && user && (
                <FollowButton
                  userId={profile.id}
                  username={profile.username}
                />
              )}
            </div>
            
            {profile.bio && (
              <p className="text-muted-foreground mb-4">{profile.bio}</p>
            )}
            
            <div className="flex items-center space-x-6 text-sm">
              <div>
                <span className="font-semibold">{posts.length}</span>
                <span className="text-muted-foreground ml-1">
                  {posts.length === 1 ? 'post' : 'posts'}
                </span>
              </div>
              
              <div>
                <span className="font-semibold">{profile.followers_count || 0}</span>
                <span className="text-muted-foreground ml-1">
                  {profile.followers_count === 1 ? 'seguidor' : 'seguidores'}
                </span>
              </div>
              
              <div>
                <span className="font-semibold">{profile.following_count || 0}</span>
                <span className="text-muted-foreground ml-1">seguindo</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 mt-2 text-xs text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                Membro desde {formatDistanceToNow(new Date(profile.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Posts do Usuário */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Posts</h3>
          
          {posts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  {isOwnProfile ? 'Você ainda não fez nenhum post.' : 'Este usuário ainda não fez nenhum post.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => (
              <InstagramAudioPost key={post.id} post={post} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
