
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Settings, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PrivateGroups = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');

  const { data: groups, isLoading, refetch } = useQuery({
    queryKey: ['private-groups', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          *,
          private_groups!inner (
            id,
            name,
            description,
            created_by,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      // Get creator profiles separately
      const creatorIds = data.map(item => item.private_groups.created_by);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', creatorIds);

      // Merge profile data
      return data.map(item => ({
        ...item,
        private_groups: {
          ...item.private_groups,
          creator_profile: profiles?.find(p => p.id === item.private_groups.created_by)
        }
      }));
    },
    enabled: !!user,
  });

  const createGroup = async () => {
    if (!user || !newGroupName.trim()) return;

    setIsCreating(true);
    try {
      const { data: group, error: groupError } = await supabase
        .from('private_groups')
        .insert({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Adicionar o criador como admin do grupo
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          is_admin: true,
        });

      if (memberError) throw memberError;

      toast({
        title: "Sucesso!",
        description: "Grupo criado com sucesso",
      });

      setNewGroupName('');
      setNewGroupDescription('');
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível criar o grupo",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center space-x-2">
          <Users className="w-5 h-5" />
          <span>Grupos Privados</span>
        </h2>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="gradient-bg">
              <Plus className="w-4 h-4 mr-2" />
              Criar Grupo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Grupo Privado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome do Grupo</label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Digite o nome do grupo"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição (opcional)</label>
                <Textarea
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="Descreva o propósito do grupo"
                  rows={3}
                />
              </div>
              <Button 
                onClick={createGroup} 
                disabled={isCreating || !newGroupName.trim()}
                className="w-full gradient-bg"
              >
                {isCreating ? "Criando..." : "Criar Grupo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!groups || groups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum grupo ainda</h3>
            <p className="text-muted-foreground">
              Crie ou participe de grupos privados para compartilhar áudios com pessoas específicas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groups.map((membership) => (
            <Card key={membership.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{membership.private_groups.name}</CardTitle>
                    {membership.private_groups.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {membership.private_groups.description}
                      </p>
                    )}
                  </div>
                  {membership.is_admin && (
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Criado por: {membership.private_groups.creator_profile?.display_name || 'Usuário'}
                  </div>
                  {membership.is_admin && (
                    <Button variant="outline" size="sm">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Convidar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrivateGroups;
