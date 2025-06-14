
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const UserSuggestions = () => {
  const { user } = useAuth();
  const [followingUsers, setFollowingUsers] = useState<string[]>([]);

  const { data: suggestedUsers, isLoading } = useQuery({
    queryKey: ['suggested-users'],
    queryFn: async () => {
      // Buscar os 5 perfis mais ativos (com mais posts)
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          display_name,
          avatar_url,
          audio_posts!inner(id)
        `)
        .neq('id', user?.id)
        .limit(5);

      if (error) throw error;

      // Ordenar por número de posts (mais posts = mais seguido)
      const sortedUsers = data?.map(profile => ({
        ...profile,
        postsCount: profile.audio_posts?.length || 0
      })).sort((a, b) => b.postsCount - a.postsCount) || [];

      return sortedUsers;
    },
    enabled: !!user,
  });

  const handleFollow = async (userId: string) => {
    // Simular seguir usuário
    setFollowingUsers(prev => [...prev, userId]);
    
    // Aqui você poderia implementar a lógica real de seguir
    // Por exemplo, inserir na tabela de seguidores
  };

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
              <p className="text-sm font-medium truncate">
                {profile.display_name || profile.username || 'Usuário'}
              </p>
              <p className="text-xs text-muted-foreground">
                {profile.postsCount} {profile.postsCount === 1 ? 'áudio' : 'áudios'}
              </p>
            </div>
            
            <Button
              size="sm"
              variant={followingUsers.includes(profile.id) ? "outline" : "default"}
              className="text-xs px-3"
              onClick={() => handleFollow(profile.id)}
              disabled={followingUsers.includes(profile.id)}
            >
              {followingUsers.includes(profile.id) ? 'Seguindo' : 'Seguir'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserSuggestions;
