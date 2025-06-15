
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';

const FollowersStories = () => {
  const { user } = useAuth();

  const { data: followingUsers, isLoading } = useQuery({
    queryKey: ['following-users', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Primeiro, buscar os IDs dos usuários que estou seguindo
      const { data: followingData, error: followingError } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followingError) throw followingError;
      if (!followingData || followingData.length === 0) return [];

      // Extrair os IDs dos usuários seguidos
      const followingIds = followingData.map(f => f.following_id);

      // Buscar os perfis desses usuários
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', followingIds);

      if (profilesError) throw profilesError;

      return profiles || [];
    },
    enabled: !!user,
  });

  if (isLoading || !followingUsers || followingUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex space-x-4 p-4 overflow-x-auto bg-background border-b">
      {followingUsers.map((profile) => (
        <div key={profile.id} className="flex flex-col items-center space-y-1 min-w-fit">
          <div className="relative">
            <Avatar className="w-14 h-14 border-2 border-gradient-to-r from-pink-500 to-orange-500 p-0.5">
              <AvatarImage src={profile.avatar_url} className="rounded-full" />
              <AvatarFallback>
                {profile.display_name?.[0]?.toUpperCase() || 
                 profile.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
          <span className="text-xs text-center max-w-16 truncate">
            {profile.display_name || profile.username || 'Usuário'}
          </span>
        </div>
      ))}
    </div>
  );
};

export default FollowersStories;
