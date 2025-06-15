
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Clock, Users } from "lucide-react";

const FeaturesSection = () => {
  return (
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
  );
};

export default FeaturesSection;
