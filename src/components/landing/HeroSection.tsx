
import { Button } from "@/components/ui/button";
import { Mic, Sparkles, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
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
  );
};

export default HeroSection;
