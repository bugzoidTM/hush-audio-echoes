
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Wand2, Share2, Clock } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      icon: Mic,
      title: "Grave",
      description: "Toque no botão de gravação e compartilhe sua voz com o mundo",
      color: "bg-blue-500"
    },
    {
      icon: Wand2,
      title: "Personalize",
      description: "Adicione filtros divertidos e deixe sua criatividade fluir",
      color: "bg-purple-500"
    },
    {
      icon: Share2,
      title: "Compartilhe",
      description: "Publique para todos ou apenas para seus amigos especiais",
      color: "bg-pink-500"
    },
    {
      icon: Clock,
      title: "Desaparece",
      description: "Relaxe sabendo que tudo expira em 24 horas automaticamente",
      color: "bg-green-500"
    }
  ];

  return (
    <section id="how-it-works" className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">
            Como <span className="gradient-text">Funciona</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Em poucos passos simples, você já estará compartilhando sua voz de forma única
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-primary to-transparent z-0"></div>
              )}
              
              <Card className="relative z-10 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-8 space-y-4">
                  <div className="relative mx-auto w-16 h-16">
                    <div className={`absolute inset-0 ${step.color} rounded-full opacity-20 animate-pulse`}></div>
                    <div className={`relative w-16 h-16 ${step.color} rounded-full flex items-center justify-center`}>
                      <step.icon className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  
                  <div className="text-sm font-medium text-primary">
                    Passo {index + 1}
                  </div>
                  
                  <h3 className="text-xl font-bold">{step.title}</h3>
                  
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button size="lg" className="gradient-bg hover:opacity-90 transition-opacity text-lg px-8 py-6">
            <Mic className="w-5 h-5 mr-2" />
            Começar Agora
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
