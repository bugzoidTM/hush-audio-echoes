
import React from "react";

const LandingFooter = () => {
  return (
    <footer className="bg-background border-t py-8" role="contentinfo">
      <div className="container mx-auto px-4 text-center">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <img 
            src="/lovable-uploads/a384c699-fcd9-4ac6-bcf9-612e01bab15d.png" 
            alt="Shhhh Logo" 
            className="w-6 h-6" 
            width="24" 
            height="24" 
          />
          <span className="font-bold text-primary">Shhhh - Sua voz, seu tempo</span>
        </div>
        <p className="text-muted-foreground">© 2025 Shhhh Audio Social Network. Conectando vozes autênticas através do tempo.</p>
      </div>
    </footer>
  );
};

export default LandingFooter;
