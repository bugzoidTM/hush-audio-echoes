
import { Card, CardContent } from "@/components/ui/card";
import { 
  Mic, 
  Clock, 
  Volume2, 
  Bot, 
  Eye, 
  Users, 
  Hash, 
  Trophy,
  Shield
} from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: Mic,
      title: "Gravação Intuitiva",
      description: "Grave áudios curtos diretamente pelo app com interface simples e intuitiva."
    },
    {
      icon: Clock,
      title: "Expiração em 24h",
      description: "Todos os áudios desaparecem automaticamente, promovendo espontaneidade."
    },
    {
      icon: Volume2,
      title: "Filtros de Voz",
      description: "Transforme sua voz com filtros divertidos: robô, eco, helium e muito mais."
    },
    {
      icon: Bot,
      title: "IA Inteligente",
      description: "Melhoria automática de qualidade e transcrição powered by OpenAI."
    },
    {
      icon: Eye,
      title: "Modo Confessionário",
      description: "Compartilhe de forma totalmente anônima para desabafos e confissões."
    },
    {
      icon: Users,
      title: "Áudios Colaborativos",
      description: "Responda e crie threads de conversas em áudio com outros usuários."
    },
    {
      icon: Hash,
      title: "Hashtags e Exploração",
      description: "Descubra conteúdos por temas, emoções e tendências do momento."
    },
    {
      icon: Trophy,
      title: "Desafios Diários",
      description: "Participe de temas criativos e concorra ao Hall da Fama."
    },
    {
      icon: Shield,
      title: "Privacidade Total",
      description: "Moderação por IA e proteção anti-screenshot para máxima segurança."
    }
  ];

  return (
    <section id="features" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">
            Funcionalidades <span className="gradient-text">Únicas</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Descubra as características que tornam o Shhhh uma experiência completamente nova
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-border/50 hover:border-primary/30 bg-card/50 backdrop-blur-sm"
            >
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 gradient-bg rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
