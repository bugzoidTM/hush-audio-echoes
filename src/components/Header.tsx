
import { Button } from "@/components/ui/button";
import { Mic, Menu } from "lucide-react";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img 
            src="/lovable-uploads/205b5735-3f33-453a-a025-eaffc0a2fba6.png" 
            alt="Shhhh Logo" 
            className="w-8 h-8"
          />
          <span className="text-2xl font-bold gradient-text">Shhhh</span>
        </div>
        
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-muted-foreground hover:text-primary transition-colors">
            Funcionalidades
          </a>
          <a href="#how-it-works" className="text-muted-foreground hover:text-primary transition-colors">
            Como Funciona
          </a>
          <a href="#download" className="text-muted-foreground hover:text-primary transition-colors">
            Download
          </a>
        </nav>

        <div className="flex items-center space-x-4">
          <Button variant="ghost" className="hidden md:flex">
            Entrar
          </Button>
          <Button className="gradient-bg hover:opacity-90 transition-opacity">
            Começar Agora
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
