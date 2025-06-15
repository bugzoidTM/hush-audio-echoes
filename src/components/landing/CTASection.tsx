
import React from "react";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-16" role="call-to-action">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">
          Pronto para compartilhar sua voz no seu tempo?
        </h2>
        <p className="text-xl mb-8 opacity-90">
          Junte-se à revolução do áudio temporário e comece a gravar seus primeiros áudios agora.
        </p>
        <Button 
          onClick={() => navigate('/auth')} 
          variant="secondary" 
          size="lg" 
          className="text-lg px-8 py-6 bg-white text-purple-600 hover:bg-gray-100"
          aria-label="Criar conta grátis na rede social de áudio temporário Shhhh"
        >
          <Mic className="w-5 h-5 mr-2" />
          Criar Conta Grátis
        </Button>
      </div>
    </section>
  );
};

export default CTASection;
