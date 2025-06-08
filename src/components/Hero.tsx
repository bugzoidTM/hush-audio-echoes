
import { Button } from "@/components/ui/button";
import { Play, Mic, Clock, Sparkles } from "lucide-react";
import AudioWave from "./AudioWave";

const Hero = () => {
  return (
    <section className="pt-24 pb-16 bg-gradient-to-br from-background via-accent/20 to-secondary/30 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 gradient-bg rounded-full opacity-20 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 gradient-bg rounded-full opacity-20 animate-float" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center space-x-2 bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Rede Social de Áudio Efêmera</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold">
            <span className="gradient-text">Shhhh</span>
            <br />
            <span className="text-3xl md:text-4xl text-muted-foreground">
              Sua voz, sua história
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Compartilhe áudios autênticos que desaparecem em 24 horas. 
            Conecte-se através da voz, participe de desafios diários e 
            descubra uma nova forma de se expressar.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="gradient-bg hover:opacity-90 transition-all duration-300 animate-pulse-glow text-lg px-8 py-6">
              <Mic className="w-5 h-5 mr-2" />
              Gravar Primeiro Áudio
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-primary/30 hover:bg-primary/10">
              <Play className="w-5 h-5 mr-2" />
              Ver Como Funciona
            </Button>
          </div>

          <div className="flex items-center justify-center space-x-8 pt-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">24h</div>
              <div className="text-sm text-muted-foreground">Expiração</div>
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

        {/* Audio wave visualization */}
        <div className="mt-16 flex justify-center">
          <AudioWave />
        </div>
      </div>
    </section>
  );
};

export default Hero;
