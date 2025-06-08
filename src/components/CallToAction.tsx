
import { Button } from "@/components/ui/button";
import { Mic, Download, Smartphone } from "lucide-react";

const CallToAction = () => {
  return (
    <section id="download" className="py-24 bg-gradient-to-br from-primary/10 via-accent/20 to-secondary/30 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 right-10 w-32 h-32 gradient-bg rounded-full opacity-10 animate-float"></div>
        <div className="absolute bottom-10 left-10 w-24 h-24 gradient-bg rounded-full opacity-10 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-6xl font-bold">
            Pronto para dar <span className="gradient-text">voz</span> às suas ideias?
          </h2>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Junte-se à revolução do áudio efêmero e descubra uma nova forma de se conectar
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button size="lg" className="gradient-bg hover:opacity-90 transition-all duration-300 text-lg px-8 py-6 animate-pulse-glow">
              <Mic className="w-5 h-5 mr-2" />
              Criar Conta Grátis
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-primary/30 hover:bg-primary/10">
              <Download className="w-5 h-5 mr-2" />
              Baixar App
            </Button>
          </div>

          <div className="pt-8 flex items-center justify-center space-x-8 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Grátis para sempre</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Sem anúncios</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Máxima privacidade</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
