
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { User, LogOut, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SimpleRecordModal from './SimpleRecordModal';

const SimpleAppHeader = () => {
  const { user, signOut } = useAuth();
  const [showRecordModal, setShowRecordModal] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <>
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-primary">Shhhh</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setShowRecordModal(true)}
              className="bg-primary hover:bg-primary/90"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Gravar
            </Button>
            
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{user?.email}</span>
            </div>
            
            <Button
              onClick={handleSignOut}
              variant="outline"
              size="sm"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <SimpleRecordModal 
        open={showRecordModal} 
        onClose={() => setShowRecordModal(false)} 
      />
    </>
  );
};

export default SimpleAppHeader;
