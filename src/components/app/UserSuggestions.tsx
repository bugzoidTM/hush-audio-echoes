
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import UserProfileLink from './UserProfileLink';
import FollowButton from './FollowButton';

const UserSuggestions = () => {
  const { user } = useAuth();

  const { data: suggestedUsers, isLoading } = useQuery({
    queryKey: ['suggested-users'],
    queryFn: async () => {
      console.log('🔍 [UserSuggestions] Buscando usuários sugeridos...');
      
      try {
        // Buscar todos os profiles exceto o usuário atual e os que já segue
        let profilesQuery = supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, followers_count')
          .neq('id', user?.id);

        // Se o usuário está logado, excluir os que já segue
        if (user) {
          const { data: following } = await supabase
            .from('followers')
            .select('following_id')
            .eq('follower_id', user.id);

          const followingIds = following?.map(f => f.following_id) || [];
          if (followingIds.length > 0) {
            profilesQuery = profilesQuery.not('id', 'in', `(${followingIds.join(',')})`);
          }
        }

        const { data: profiles, error: profilesError } = await profilesQuery.limit(5);

        if (profilesError) {
          console.error('❌ [UserSuggestions] Erro ao buscar profiles:', profilesError);
          throw profilesError;
        }

        console.log('👤 [UserSuggestions] Profiles encontrados:', profiles?.length || 0);

        if (!profiles || profiles.length === 0) {
          return [];
        }

        // Buscar contagem de posts para cada usuário
        const userIds = profiles.map(p => p.id);
        const { data: posts, error: postsError } = await supabase
          .from('audio_posts')
          .select('user_id')
          .in('user_id', userIds)
          .eq('status', 'active');

        if (postsError) {
          console.error('❌ [UserSuggestions] Erro ao buscar posts:', postsError);
        }

        console.log('📊 [UserSuggestions] Posts encontrados:', posts?.length || 0);

        // Combinar dados e calcular contagem de posts
        const usersWithPostCount = profiles.map(profile => {
          const userPosts = posts?.filter(post => post.user_id === profile.id) || [];
          return {
            ...profile,
            postsCount: userPosts.length
          };
        });

        // Ordenar por número de seguidores primeiro, depois por posts
        const sortedUsers = usersWithPostCount
          .sort((a, b) => (b.followers_count || 0) - (a.followers_count || 0) || b.postsCount - a.postsCount);

        console.log('✅ [UserSuggestions] Usuários finais:', sortedUsers.length);
        return sortedUsers;

      } catch (error) {
        console.error('💥 [UserSuggestions] Erro geral:', error);
        throw error;
      }
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-muted-foreground">Sugestões para você</h3>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 animate-pulse">
              <div className="w-10 h-10 bg-muted rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-24 mb-1"></div>
                <div className="h-3 bg-muted rounded w-16"></div>
              </div>
              <div className="w-16 h-6 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!suggestedUsers || suggestedUsers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-muted-foreground">Sugestões para você</h3>
        <Button variant="ghost" size="sm" className="text-xs">
          Ver tudo
        </Button>
      </div>
      
      <div className="space-y-3">
        {suggestedUsers.map((profile) => (
          <div key={profile.id} className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={profile.avatar_url} />
              <AvatarFallback>
                {profile.display_name?.[0]?.toUpperCase() || 
                 profile.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <UserProfileLink 
                userId={profile.id} 
                username={profile.username}
                className="text-sm font-medium truncate block"
              >
                {profile.display_name || profile.username || 'Usuário'}
              </UserProfileLink>
              <p className="text-xs text-muted-foreground">
                {profile.followers_count || 0} {(profile.followers_count || 0) === 1 ? 'seguidor' : 'seguidores'} • {profile.postsCount} {profile.postsCount === 1 ? 'áudio' : 'áudios'}
              </p>
            </div>
            
            <FollowButton userId={profile.id} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserSuggestions;
