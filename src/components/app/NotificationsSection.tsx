
const NotificationsSection = () => {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Notificações</h2>
      
      <div className="space-y-4">
        <div className="text-center text-muted-foreground">
          <p>Você não tem notificações no momento</p>
          <p className="text-sm mt-2">
            Aqui aparecerão curtidas, comentários e novos seguidores
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationsSection;
