import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { User, LogOut, Plus, Shield } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import EnhancedRecordModal from './EnhancedRecordModal';

const UpdatedAppHeader = () => {
  const { user, signOut } = useAuth();
  const [showRecordModal, setShowRecordModal] = useState(false);

  // Verificar se o usuário é admin/moderador
  const { data: userRole } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

  const isAdminOrModerator = userRole?.role === 'admin' || userRole?.role === 'moderator';

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

            {isAdminOrModerator && (
              <Link to="/admin">
                <Button variant="outline" size="sm">
                  <Shield className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              </Link>
            )}
            
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

      <EnhancedRecordModal 
        open={showRecordModal} 
        onClose={() => setShowRecordModal(false)} 
      />
    </>
  );
};

export default UpdatedAppHeader;
