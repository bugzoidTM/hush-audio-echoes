
import { Check, Star, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RoadmapSection = () => {
  const betaFeatures = [
    "Gravação de áudios de até 20 segundos",
    "Feed temporal (24h)",
    "Reprodução de áudios",
    "Sistema de curtidas",
    "Perfis de usuário",
    "Busca por hashtags",
    "Stories de seguidores",
    "Notificações básicas"
  ];

  const premiumFeatures = [
    "Transcrições automáticas dos áudios",
    "Filtros de voz avançados",
    "Criação de grupos privados",
    "Analytics detalhadas",
    "Backup na nuvem",
    "Temas personalizados"
  ];

  const futureFeatures = [
    "Tradução automática de áudios",
    "Integração com IA para respostas",
    "Lives de áudio",
    "Monetização para criadores",
    "App mobile nativo",
    "Integração com outras redes sociais"
  ];

  return (
    <section className="container mx-auto px-4 py-16" id="roadmap">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Roadmap do <span className="text-primary">Shhhh</span>
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Acompanhe nossa jornada de evolução e veja o que está por vir na plataforma de áudio temporário
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* Fase Beta - Atual */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center space-x-2 mb-2">
              <Check className="w-6 h-6 text-green-600" />
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                Fase Beta
              </span>
            </div>
            <CardTitle className="text-green-800">Funcionalidades Atuais</CardTitle>
            <CardDescription className="text-green-600">
              Recursos já disponíveis na versão beta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {betaFeatures.map((feature, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-green-700">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Features Premium */}
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <div className="flex items-center space-x-2 mb-2">
              <Star className="w-6 h-6 text-purple-600" />
              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                Premium
              </span>
            </div>
            <CardTitle className="text-purple-800">Features Premium</CardTitle>
            <CardDescription className="text-purple-600">
              Recursos avançados para usuários premium
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {premiumFeatures.map((feature, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <Star className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-purple-700">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Funcionalidades Futuras */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-6 h-6 text-blue-600" />
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                Em Breve
              </span>
            </div>
            <CardTitle className="text-blue-800">Próximas Funcionalidades</CardTitle>
            <CardDescription className="text-blue-600">
              Recursos em desenvolvimento para o futuro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {futureFeatures.map((feature, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-blue-700">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default RoadmapSection;
