
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ShhhhAudioPost from './ShhhhAudioPost';
import { Mic, Camera } from 'lucide-react';

const ProfileSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setUserProfile(data);
      };

      const fetchUserPosts = async () => {
        const { data: postsData } = await supabase
          .from('audio_posts')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        
        if (postsData) {
          // Buscar likes para cada post
          const postsWithData = [];
          for (const post of postsData) {
            const { data: likesData } = await supabase
              .from('likes')
              .select('user_id')
              .eq('audio_id', post.id);

            const postWithData = {
              ...post,
              profiles: userProfile,
              likes: likesData || [],
              likes_count: post.likes_count || 0,
              replies_count: post.replies_count || 0
            };
            postsWithData.push(postWithData);
          }
          setUserPosts(postsWithData);
        } else {
          setUserPosts([]);
        }
      };
      
      fetchProfile();
      fetchUserPosts();
    }
  }, [user, userProfile]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você deve selecionar uma imagem para upload.');
      }

      const file = event.target.files[0];
      
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        throw new Error('Por favor, selecione apenas arquivos de imagem.');
      }

      // Validar tamanho do arquivo (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('A imagem deve ter no máximo 2MB.');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload do arquivo
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Atualizar perfil com nova URL do avatar
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user!.id);

      if (updateError) {
        throw updateError;
      }

      // Atualizar estado local
      setUserProfile({ ...userProfile, avatar_url: publicUrl });

      toast({
        title: "Avatar atualizado",
        description: "Sua foto de perfil foi atualizada com sucesso",
      });

    } catch (error: any) {
      console.error('Erro ao fazer upload do avatar:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o avatar",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const displayName = userProfile?.display_name || userProfile?.username || 'Usuário';

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-4">
        <div className="relative w-24 h-24 mx-auto">
          <Avatar className="w-24 h-24">
            <AvatarImage src={userProfile?.avatar_url} />
            <AvatarFallback className="text-2xl">
              {displayName[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <Button
            variant="outline"
            size="icon"
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="w-4 h-4" />
          </Button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold">{displayName}</h2>
          <p className="text-muted-foreground">
            {userProfile?.bio || 'Compartilhando áudios temporários'}
          </p>
        </div>
        
        <div className="flex justify-center space-x-8 text-center">
          <div>
            <p className="font-semibold">{userPosts.length}</p>
            <p className="text-sm text-muted-foreground">áudios</p>
          </div>
          <div>
            <p className="font-semibold">{userProfile?.followers_count || 0}</p>
            <p className="text-sm text-muted-foreground">seguidores</p>
          </div>
          <div>
            <p className="font-semibold">{userProfile?.following_count || 0}</p>
            <p className="text-sm text-muted-foreground">seguindo</p>
          </div>
        </div>
      </div>

      {/* Posts do Usuário */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Meus Posts</h3>
        
        {userPosts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Mic className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhum áudio ainda</h3>
              <p className="text-muted-foreground">
                Você ainda não compartilhou nenhum áudio temporário!
              </p>
            </CardContent>
          </Card>
        ) : (
          userPosts.map((post) => (
            <ShhhhAudioPost key={post.id} post={post} />
          ))
        )}
      </div>
    </div>
  );
};

export default ProfileSection;
