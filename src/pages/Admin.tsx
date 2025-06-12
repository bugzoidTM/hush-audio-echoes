
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Users, 
  Flag, 
  Trophy, 
  BarChart3, 
  Shield,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);

  // Verificar se o usuário é admin
  const { data: userRole } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    
    if (userRole) {
      const hasAdminRole = userRole.role === 'admin' || userRole.role === 'moderator';
      setIsAdmin(hasAdminRole);
      
      if (!hasAdminRole) {
        navigate('/app');
        toast({
          title: "Acesso Negado",
          description: "Você não tem permissão para acessar o painel administrativo",
          variant: "destructive",
        });
      }
    }
  }, [user, loading, userRole, navigate, toast]);

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Verificando permissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Shield className="w-6 h-6" />
            <span>Painel Administrativo</span>
          </h1>
          <Button variant="outline" onClick={() => navigate('/app')}>
            Voltar ao App
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="challenges">
              <Trophy className="w-4 h-4 mr-2" />
              Desafios
            </TabsTrigger>
            <TabsTrigger value="reports">
              <Flag className="w-4 h-4 mr-2" />
              Denúncias
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="content">
              <Eye className="w-4 h-4 mr-2" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <AdminDashboard />
          </TabsContent>

          <TabsContent value="challenges">
            <ChallengeManagement />
          </TabsContent>

          <TabsContent value="reports">
            <ReportManagement />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="content">
            <ContentModeration />
          </TabsContent>

          <TabsContent value="settings">
            <SystemSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const AdminDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [usersResult, postsResult, reportsResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('audio_posts').select('id', { count: 'exact' }),
        supabase.from('reports').select('id', { count: 'exact' })
      ]);

      return {
        totalUsers: usersResult.count || 0,
        totalPosts: postsResult.count || 0,
        totalReports: reportsResult.count || 0,
      };
    },
  });

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Total de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Posts de Áudio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalPosts || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Denúncias Pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-500">{stats?.totalReports || 0}</div>
        </CardContent>
      </Card>
    </div>
  );
};

const ChallengeManagement = () => {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtag, setHashtag] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: challenges, refetch } = useQuery({
    queryKey: ['admin-challenges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createChallenge = async () => {
    try {
      const { error } = await supabase
        .from('daily_challenges')
        .insert({
          title,
          description,
          hashtag: hashtag.startsWith('#') ? hashtag : `#${hashtag}`,
          start_date: startDate,
          end_date: endDate,
          status: 'active',
        });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Desafio criado com sucesso",
      });

      setTitle('');
      setDescription('');
      setHashtag('');
      setStartDate('');
      setEndDate('');
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível criar o desafio",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Criar Novo Desafio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Conte uma história engraçada"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hashtag</label>
              <Input
                value={hashtag}
                onChange={(e) => setHashtag(e.target.value)}
                placeholder="Ex: #historiaengraçada"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o desafio em detalhes..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Data de Início</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Data de Fim</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={createChallenge}
            disabled={!title || !description || !hashtag || !startDate || !endDate}
            className="gradient-bg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Criar Desafio
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Desafios Existentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {challenges?.map((challenge) => (
              <div key={challenge.id} className="flex items-center justify-between p-4 border rounded">
                <div>
                  <h3 className="font-medium">{challenge.title}</h3>
                  <p className="text-sm text-muted-foreground">{challenge.hashtag}</p>
                  <Badge variant={challenge.status === 'active' ? 'default' : 'secondary'}>
                    {challenge.status}
                  </Badge>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {challenge.start_date} - {challenge.end_date}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ReportManagement = () => {
  const { data: reports } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          audio_posts (title, audio_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get reporter profiles separately
      const reporterIds = data.filter(r => r.reporter_id).map(r => r.reporter_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', reporterIds);

      // Merge profile data
      return data.map(report => ({
        ...report,
        reporter_profile: profiles?.find(p => p.id === report.reporter_id)
      }));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Denúncias</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reports?.map((report) => (
            <div key={report.id} className="flex items-center justify-between p-4 border rounded">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span className="font-medium">{report.reason}</span>
                  <Badge variant="outline">{report.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Por: {report.reporter_profile?.display_name || 'Usuário anônimo'}
                </p>
                {report.description && (
                  <p className="text-sm">{report.description}</p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <CheckCircle className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const UserManagement = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Usuários</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Funcionalidade em desenvolvimento...</p>
      </CardContent>
    </Card>
  );
};

const ContentModeration = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Moderação de Conteúdo</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Funcionalidade em desenvolvimento...</p>
      </CardContent>
    </Card>
  );
};

const SystemSettings = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações do Sistema</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Configurações de IA</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Configure a chave da API OpenAI para transcrição automática
            </p>
            <div className="p-3 bg-muted rounded">
              <p className="text-sm">
                Para configurar a chave da API, acesse as configurações de Edge Functions no Supabase
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Admin;
