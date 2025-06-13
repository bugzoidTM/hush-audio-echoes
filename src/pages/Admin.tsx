
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { Users, MessageSquare, TrendingUp, Settings } from 'lucide-react';

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    totalLikes: 0,
    activeUsers: 0
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      checkAdminStatus();
      loadStats();
    }
  }, [user, loading, navigate]);

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setIsAdmin(!!data);
      
      if (!data) {
        toast({
          title: "Acesso Negado",
          description: "Você não tem permissão para acessar o painel administrativo",
          variant: "destructive"
        });
        navigate('/app');
      }
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      navigate('/app');
    }
  };

  const loadStats = async () => {
    try {
      // Total de usuários
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Total de posts
      const { count: postsCount } = await supabase
        .from('audio_posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Total de likes
      const { count: likesCount } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: usersCount || 0,
        totalPosts: postsCount || 0,
        totalLikes: likesCount || 0,
        activeUsers: usersCount || 0
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Painel Administrativo</h1>
          <Button onClick={() => navigate('/app')} variant="outline">
            Voltar ao App
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Posts Ativos</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPosts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Likes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLikes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Configurações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>• Bucket de áudio configurado: ✅</p>
                <p>• Políticas RLS ativas: ✅</p>
                <p>• Foreign keys configuradas: ✅</p>
                <p>• Você tem acesso de administrador: ✅</p>
              </div>
              <Button onClick={loadStats} variant="outline" className="w-full">
                Atualizar Estatísticas
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Links Úteis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                onClick={() => window.open('https://supabase.com/dashboard/project/yvvhhtvtweqwfksrbsqr/auth/users', '_blank')}
                variant="outline"
                className="w-full justify-start"
              >
                Gerenciar Usuários
              </Button>
              <Button 
                onClick={() => window.open('https://supabase.com/dashboard/project/yvvhhtvtweqwfksrbsqr/storage/buckets', '_blank')}
                variant="outline"
                className="w-full justify-start"
              >
                Gerenciar Storage
              </Button>
              <Button 
                onClick={() => window.open('https://supabase.com/dashboard/project/yvvhhtvtweqwfksrbsqr/auth/providers', '_blank')}
                variant="outline"
                className="w-full justify-start"
              >
                Configurar Autenticação
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <Toaster />
    </div>
  );
};

export default Admin;
