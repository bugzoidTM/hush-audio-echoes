import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Clock, Users, Heart, Sparkles, Play } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
const Index = () => {
  const navigate = useNavigate();
  const {
    user,
    loading
  } = useAuth();
  useEffect(() => {
    if (!loading && user) {
      navigate('/app');
    }
  }, [user, loading, navigate]);
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>;
  }
  return <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur" role="banner">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/lovable-uploads/a384c699-fcd9-4ac6-bcf9-612e01bab15d.png" alt="Shhhh - Rede Social de Áudio Temporário" className="w-8 h-8" width="32" height="32" />
            <h1 className="text-2xl font-bold text-primary">Shhhh</h1>
          </div>
          <Button onClick={() => navigate('/auth')} variant="outline">
            Entrar
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="container mx-auto px-4 py-16 text-center" role="main">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center space-x-2 bg-primary/10 px-4 py-2 rounded-full border border-primary/20 mb-8">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Rede Social de Áudio Temporário</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              <span className="text-primary">Shhhh</span> - Sua voz,
              <span className="text-primary"> seu tempo</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Compartilhe áudios autênticos que desaparecem em 24 horas. 
              Conecte-se através da voz, participe de desafios diários e 
              descubra uma nova forma de se expressar no tempo certo.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button onClick={() => navigate('/auth')} size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                <Mic className="w-5 h-5 mr-2" />
                Gravar Primeiro Áudio
              </Button>
              <Button onClick={() => navigate('/auth')} variant="outline" size="lg" className="text-lg px-8 py-6">
                <Play className="w-5 h-5 mr-2" />
                Ver Como Funciona
              </Button>
            </div>

            {/* Stats Preview */}
            <div className="flex items-center justify-center space-x-8 pt-8 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">24h</div>
                <div className="text-sm text-muted-foreground">Duração</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">∞</div>
                <div className="text-sm text-muted-foreground">Possibilidades</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">100%</div>
                <div className="text-sm text-muted-foreground">Autêntico</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16 bg-white" aria-labelledby="features-title">
          <h2 id="features-title" className="text-3xl font-bold text-center mb-12">
            Por que escolher o Shhhh?
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Mic className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Grave com Filtros Únicos</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Aplique filtros de voz exclusivos: robô, grave, agudo ou eco. 
                  Transforme sua mensagem e torne cada áudio especial e divertido.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Conteúdo Temporário</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Seus áudios desaparecem automaticamente em 24 horas, 
                  mantendo o feed sempre fresco, atual e livre de acúmulo desnecessário.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Comunidade Autêntica</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Conecte-se com pessoas reais através de hashtags, 
                  descubra conteúdos interessantes e participe de desafios diários.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="container mx-auto px-4 py-16 bg-primary/5" aria-labelledby="benefits-title">
          <h2 id="benefits-title" className="text-3xl font-bold text-center mb-12">
            A revolução do áudio temporário
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Autêntico
                </div>
                <div className="text-lg font-semibold text-foreground">
                  Expressão Real
                </div>
                <div className="text-sm text-muted-foreground">
                  Voz sem filtros sociais
                </div>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  24h
                </div>
                <div className="text-lg font-semibold text-foreground">
                  Temporário
                </div>
                <div className="text-sm text-muted-foreground">
                  Liberdade que expira
                </div>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Social
                </div>
                <div className="text-lg font-semibold text-foreground">
                  Conecte-se
                </div>
                <div className="text-sm text-muted-foreground">
                  Comunidade vocal
                </div>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Criativo
                </div>
                <div className="text-lg font-semibold text-foreground">
                  Filtros Únicos
                </div>
                <div className="text-sm text-muted-foreground">
                  Voz transformada
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Pronto para compartilhar sua voz no seu tempo?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Junte-se à revolução do áudio temporário e comece a gravar seus primeiros áudios agora.
            </p>
            <Button onClick={() => navigate('/auth')} variant="secondary" size="lg" className="text-lg px-8 py-6 bg-white text-purple-600 hover:bg-gray-100">
              <Mic className="w-5 h-5 mr-2" />
              Criar Conta Grátis
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background border-t py-8" role="contentinfo">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <img src="/lovable-uploads/a384c699-fcd9-4ac6-bcf9-612e01bab15d.png" alt="Shhhh Logo" className="w-6 h-6" width="24" height="24" />
            <span className="font-bold text-primary">Shhhh - Sua voz, seu tempo</span>
          </div>
          <p className="text-muted-foreground">© 2025 Shhhh Audio Social Network. Conectando vozes autênticas através do tempo.</p>
        </div>
      </footer>
    </div>;
};
export default Index;