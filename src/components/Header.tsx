
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header className="container mx-auto px-4 py-6 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <img 
          src="/lovable-uploads/52e262e1-3762-429d-99a2-081e0ac14f52.png" 
          alt="Shhhh Logo" 
          className="w-8 h-8"
        />
        <h1 className="text-2xl font-bold gradient-text">Shhhh</h1>
      </div>
      <div className="space-x-4">
        <Link to="/auth">
          <Button variant="outline">Entrar</Button>
        </Link>
        <Link to="/auth">
          <Button className="gradient-bg">Começar</Button>
        </Link>
      </div>
    </header>
  );
};

export default Header;
