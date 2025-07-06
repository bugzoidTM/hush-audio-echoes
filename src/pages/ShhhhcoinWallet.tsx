import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useShhhhcoin } from '@/hooks/useShhhhcoin';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatShhhhcoins, getTransactionTypeLabel, getTransactionIcon } from '@/utils/shhhhcoin';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Gift, 
  Copy, 
  Share2, 
  ExternalLink,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ShhhhcoinWallet = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const {
    wallet,
    transactions,
    invites,
    loading,
    error,
    createInvite,
    refreshData
  } = useShhhhcoin();

  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Carregando carteira...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Erro ao carregar carteira</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={refreshData}>Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateInvite = async () => {
    const code = await createInvite();
    if (code) {
      setInviteCode(code);
    }
  };

  const handleCopyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/auth?invite=${code}`);
      toast({
        title: "Link copiado!",
        description: "O link de convite foi copiado para a área de transferência",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link",
        variant: "destructive",
      });
    }
  };

  const handleShareInvite = async (code: string) => {
    const shareUrl = `${window.location.origin}/auth?invite=${code}`;
    const shareText = `Junte-se ao Shhhh e ganhe shhhhcoins! Use meu código de convite: ${code}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Convite para o Shhhh',
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        console.error('Erro ao compartilhar:', error);
      }
    } else {
      handleCopyInviteCode(code);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Concluído</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'expired':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const recentTransactions = transactions.slice(0, 5);
  const activeInvites = invites.filter(invite => invite.status === 'pending');
  const completedInvites = invites.filter(invite => invite.status === 'completed');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wallet className="w-8 h-8" />
              Minha Carteira
            </h1>
            <p className="text-muted-foreground">Gerencie seus shhhhcoins e convites</p>
          </div>
          <Button onClick={() => navigate('/shhhh')} variant="outline">
            Voltar ao Feed
          </Button>
        </div>

        {/* Saldo */}
        <Card className="mb-8 bg-gradient-to-r from-purple-500 to-blue-600 text-white">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="w-6 h-6" />
              Saldo Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-2">
              {formatShhhhcoins(wallet?.balance || 0)}
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {formatShhhhcoins(wallet?.total_earned || 0)}
                </div>
                <div className="text-sm opacity-80">Total Ganho</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {formatShhhhcoins(wallet?.total_spent || 0)}
                </div>
                <div className="text-sm opacity-80">Total Gasto</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {completedInvites.length}
                </div>
                <div className="text-sm opacity-80">Convites Aceitos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Abas principais */}
        <Tabs defaultValue="transactions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transactions">Transações</TabsTrigger>
            <TabsTrigger value="invites">Convites</TabsTrigger>
            <TabsTrigger value="earn">Ganhar Mais</TabsTrigger>
          </TabsList>

          {/* Aba de Transações */}
          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Transações</CardTitle>
                <CardDescription>Suas últimas movimentações de shhhhcoins</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma transação ainda</h3>
                    <p className="text-muted-foreground">
                      Convide amigos ou compre funcionalidades para ver suas transações aqui
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentTransactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">
                            {getTransactionIcon(transaction.transaction_type)}
                          </div>
                          <div>
                            <div className="font-medium">{transaction.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {getTransactionTypeLabel(transaction.transaction_type)} • {' '}
                              {format(new Date(transaction.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                        </div>
                        <div className={`font-bold ${
                          transaction.transaction_type === 'spent' ? 'text-red-500' : 'text-green-500'
                        }`}>
                          {transaction.transaction_type === 'spent' ? '-' : '+'}
                          {formatShhhhcoins(transaction.amount)}
                        </div>
                      </div>
                    ))}
                    {transactions.length > 5 && (
                      <Button variant="outline" className="w-full">
                        Ver todas as transações ({transactions.length})
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba de Convites */}
          <TabsContent value="invites" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Meus Convites</CardTitle>
                    <CardDescription>
                      Convide amigos e ganhe 100 shhhhcoins quando eles postarem seu primeiro áudio
                    </CardDescription>
                  </div>
                  <Dialog open={showCreateInvite} onOpenChange={setShowCreateInvite}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar Convite
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Novo Convite</DialogTitle>
                        <DialogDescription>
                          Gere um código de convite para compartilhar com seus amigos
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        {inviteCode ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg">
                              <Label className="text-sm font-medium">Código do Convite</Label>
                              <div className="flex items-center gap-2 mt-2">
                                <Input value={inviteCode} readOnly />
                                <Button size="sm" onClick={() => handleCopyInviteCode(inviteCode)}>
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => handleShareInvite(inviteCode)} 
                                className="flex-1"
                              >
                                <Share2 className="w-4 h-4 mr-2" />
                                Compartilhar
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  setInviteCode('');
                                  setShowCreateInvite(false);
                                }}
                              >
                                Fechar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="text-center">
                              <Gift className="w-12 h-12 mx-auto mb-4 text-primary" />
                              <p className="text-sm text-muted-foreground">
                                Clique no botão abaixo para gerar um novo código de convite
                              </p>
                            </div>
                            <Button onClick={handleCreateInvite} className="w-full">
                              Gerar Código
                            </Button>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {invites.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum convite criado</h3>
                    <p className="text-muted-foreground mb-4">
                      Convide amigos para ganhar shhhhcoins quando eles se juntarem à plataforma
                    </p>
                    <Button onClick={() => setShowCreateInvite(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Primeiro Convite
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {invites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">
                            {invite.status === 'completed' ? '🎉' : '📬'}
                          </div>
                          <div>
                            <div className="font-medium">Código: {invite.invite_code}</div>
                            <div className="text-sm text-muted-foreground">
                              Criado em {format(new Date(invite.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              {invite.status === 'pending' && (
                                <span> • Expira em {format(new Date(invite.expires_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(invite.status)}
                          {invite.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleCopyInviteCode(invite.invite_code)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleShareInvite(invite.invite_code)}
                              >
                                <Share2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                          {invite.status === 'completed' && (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              +{formatShhhhcoins(invite.reward_amount)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba de Ganhar Mais */}
          <TabsContent value="earn" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Convite de Amigos
                  </CardTitle>
                  <CardDescription>
                    Ganhe 100 shhhhcoins para cada amigo que se juntar e postar um áudio
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Convites ativos</span>
                      <Badge variant="secondary">{activeInvites.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Convites aceitos</span>
                      <Badge variant="default">{completedInvites.length}</Badge>
                    </div>
                    <Button onClick={() => setShowCreateInvite(true)} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Novo Convite
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Futuras Funcionalidades
                  </CardTitle>
                  <CardDescription>
                    Mais formas de ganhar shhhhcoins em breve
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      Posts diários (+10 shhhhcoins)
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      Participar em desafios (+50 shhhhcoins)
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      Receber likes (+5 shhhhcoins)
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      Compra direta com Stripe
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Visite a Loja</CardTitle>
                <CardDescription>
                  Use seus shhhhcoins para desbloquear funcionalidades incríveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate('/shhhhcoin-shop')} className="w-full" size="lg">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ir para a Loja
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ShhhhcoinWallet;
