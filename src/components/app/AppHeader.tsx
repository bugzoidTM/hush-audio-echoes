
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Mic, User, LogOut, Plus } from 'lucide-react';
import { useState } from 'react';
import RecordAudioModal from './RecordAudioModal';

const AppHeader = () => {
  const { user, signOut } = useAuth();
  const [showRecordModal, setShowRecordModal] = useState(false);

  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold gradient-text">Shhhh</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setShowRecordModal(true)}
              className="gradient-bg"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Gravar
            </Button>
            
            <div className="flex items-center space-x-2 text-sm">
              <User className="w-4 h-4" />
              <span>{user?.email}</span>
            </div>
            
            <Button
              onClick={signOut}
              variant="outline"
              size="sm"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <RecordAudioModal 
        open={showRecordModal} 
        onClose={() => setShowRecordModal(false)} 
      />
    </>
  );
};

export default AppHeader;
