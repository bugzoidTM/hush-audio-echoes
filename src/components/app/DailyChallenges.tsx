
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DailyChallenges = () => {
  const { data: challenges, isLoading } = useQuery({
    queryKey: ['daily-challenges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

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

  if (!challenges || challenges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="w-5 h-5" />
            <span>Desafios Diários</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Nenhum desafio ativo no momento
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center space-x-2">
        <Trophy className="w-5 h-5" />
        <span>Desafios Diários</span>
      </h2>
      
      {challenges.map((challenge) => (
        <Card key={challenge.id} className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{challenge.title}</CardTitle>
                <Badge variant="secondary" className="w-fit">
                  {challenge.hashtag}
                </Badge>
              </div>
              <Badge variant="outline">
                <Calendar className="w-3 h-3 mr-1" />
                {format(new Date(challenge.end_date), 'dd/MM', { locale: ptBR })}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">{challenge.description}</p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <span className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span>Participar</span>
                </span>
              </div>
              
              <Button size="sm" className="gradient-bg">
                Aceitar Desafio
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DailyChallenges;
