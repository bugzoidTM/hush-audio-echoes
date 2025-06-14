
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Clock, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/app');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img 
              src="/lovable-uploads/52e262e1-3762-429d-99a2-081e0ac14f52.png" 
              alt="Shhhh Logo" 
              className="w-8 h-8"
            />
            <h1 className="text-2xl font-bold text-primary">Shhhh</h1>
          </div>
          <Button onClick={() => navigate('/auth')} variant="outline">
            Entrar
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Compartilhe sua voz,
            <span className="text-primary"> sem pressa</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Publique áudios efêmeros que desaparecem em 24 horas. 
            Sua voz, suas ideias, no momento certo.
          </p>
          <Button 
            onClick={() => navigate('/auth')} 
            size="lg"
            className="text-lg px-8 py-6"
          >
            Começar Agora
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Mic className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Grave com Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Aplique filtros de voz únicos: robô, grave, agudo ou eco. 
                Torne sua mensagem ainda mais especial.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>24 Horas</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Seus áudios são efêmeros - desaparecem automaticamente 
                em 24 horas, mantendo tudo fresco e atual.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Comunidade</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Conecte-se com outros usuários através de hashtags 
                e descubra conteúdos interessantes.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Pronto para compartilhar sua voz?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Junte-se à comunidade e comece a gravar seus primeiros áudios.
          </p>
          <Button 
            onClick={() => navigate('/auth')} 
            variant="secondary"
            size="lg"
            className="text-lg px-8 py-6"
          >
            Criar Conta Grátis
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <img 
              src="/lovable-uploads/52e262e1-3762-429d-99a2-081e0ac14f52.png" 
              alt="Shhhh Logo" 
              className="w-6 h-6"
            />
            <span className="font-bold text-primary">Shhhh</span>
          </div>
          <p className="text-muted-foreground">&copy; 2024 Shhhh. Sua voz, sua história.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
