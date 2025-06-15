
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface FollowButtonProps {
  userId: string;
  initialFollowing?: boolean;
}

const FollowButton = ({ userId, initialFollowing = false }: FollowButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const { data: isFollowing } = useQuery({
    queryKey: ['is-following', user?.id, userId],
    queryFn: async () => {
      if (!user || user.id === userId) return false;

      console.log('🔍 [FollowButton] Checking follow status for:', { follower: user.id, following: userId });

      const { data, error } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ [FollowButton] Error checking follow status:', error);
        throw error;
      }

      console.log('✅ [FollowButton] Follow status result:', !!data);
      return !!data;
    },
    enabled: !!user && user.id !== userId,
    initialData: initialFollowing,
  });

  const handleFollow = async () => {
    if (!user || user.id === userId) return;

    setIsLoading(true);
    try {
      if (isFollowing) {
        console.log('🔄 [FollowButton] Unfollowing user:', userId);
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        if (error) throw error;

        toast({
          title: "Usuário deixado de seguir",
          description: "Você parou de seguir este usuário",
        });
      } else {
        console.log('🔄 [FollowButton] Following user:', userId);
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: user.id,
            following_id: userId,
          });

        if (error) throw error;

        toast({
          title: "Usuário seguido",
          description: "Você agora está seguindo este usuário",
        });
      }

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['is-following'] });
      queryClient.invalidateQueries({ queryKey: ['suggested-users'] });
      queryClient.invalidateQueries({ queryKey: ['following-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });

    } catch (error: any) {
      console.error('❌ [FollowButton] Error in follow action:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar a ação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || user.id === userId) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant={isFollowing ? "outline" : "default"}
      className="text-xs px-3"
      onClick={handleFollow}
      disabled={isLoading}
    >
      {isLoading ? '...' : isFollowing ? 'Seguindo' : 'Seguir'}
    </Button>
  );
};

export default FollowButton;
