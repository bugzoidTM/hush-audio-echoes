
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const LandingHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="border-b bg-background/95 backdrop-blur" role="banner">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img 
            src="/lovable-uploads/a384c699-fcd9-4ac6-bcf9-612e01bab15d.png" 
            alt="Shhhh - Rede Social de Áudio Temporário" 
            className="w-8 h-8" 
            width="32" 
            height="32" 
          />
          <h1 className="text-2xl font-bold text-primary">Shhhh</h1>
        </div>
        <Button onClick={() => navigate('/auth')} variant="outline">
          Entrar
        </Button>
      </div>
    </header>
  );
};

export default LandingHeader;
