
import { Users, Clock, Mic, Heart } from "lucide-react";

const Stats = () => {
  const stats = [
    {
      icon: Users,
      value: "10K+",
      label: "Usuários Ativos",
      description: "Pessoas compartilhando suas vozes"
    },
    {
      icon: Mic,
      value: "1M+",
      label: "Áudios Gravados",
      description: "Momentos capturados em voz"
    },
    {
      icon: Heart,
      value: "5M+",
      label: "Curtidas",
      description: "Conexões reais criadas"
    },
    {
      icon: Clock,
      value: "24h",
      label: "Tempo de Vida",
      description: "Temporariedade que liberta"
    }
  ];

  return (
    <section className="py-16 bg-primary/5">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto gradient-bg rounded-full flex items-center justify-center">
                <stat.icon className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold gradient-text">
                  {stat.value}
                </div>
                <div className="text-lg font-semibold text-foreground">
                  {stat.label}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
