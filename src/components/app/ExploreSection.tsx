
const ExploreSection = () => {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Explorar</h2>
      
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-muted-foreground">
            Descubra novos áudios temporários da comunidade
          </p>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-muted-foreground">
            Tendências e áudios populares
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExploreSection;
