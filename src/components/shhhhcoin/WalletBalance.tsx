import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShhhhcoin } from '@/hooks/useShhhhcoin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  ShoppingBag, 
  TrendingUp, 
  Gift,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react';
import { formatShhhhcoins } from '@/utils/shhhhcoin';

interface WalletBalanceProps {
  compact?: boolean;
  showActions?: boolean;
}

const WalletBalance = ({ compact = false, showActions = true }: WalletBalanceProps) => {
  const navigate = useNavigate();
  const { wallet, invites, loading, error } = useShhhhcoin();
  const [showBalance, setShowBalance] = useState(true);

  if (loading) {
    return (
      <Card className={compact ? "px-3 py-2" : "p-4"}>
        <CardContent className="p-0">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground animate-pulse" />
            <div className="h-4 w-16 bg-muted animate-pulse rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={compact ? "px-3 py-2" : "p-4"}>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 text-destructive">
            <Wallet className="w-4 h-4" />
            <span className="text-sm">Erro</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const balance = wallet?.balance || 0;
  const activeInvites = invites.filter(invite => invite.status === 'pending').length;
  const completedInvites = invites.filter(invite => invite.status === 'completed').length;

  if (compact) {
    return (
      <Card className="px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/shhhhcoin-wallet')}>
        <CardContent className="p-0">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">
              {showBalance ? formatShhhhcoins(balance) : '••• shhhhcoins'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1"
              onClick={(e) => {
                e.stopPropagation();
                setShowBalance(!showBalance);
              }}
            >
              {showBalance ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-200">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header com saldo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <span className="font-semibold text-lg">Minha Carteira</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBalance(!showBalance)}
            >
              {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>

          {/* Saldo atual */}
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">
              {showBalance ? formatShhhhcoins(balance) : '••• shhhhcoins'}
            </div>
            <p className="text-sm text-muted-foreground">Saldo disponível</p>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-background/50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Gift className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-green-600">{completedInvites}</span>
              </div>
              <p className="text-xs text-muted-foreground">Convites aceitos</p>
            </div>
            <div className="text-center p-2 bg-background/50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-blue-600">{activeInvites}</span>
              </div>
              <p className="text-xs text-muted-foreground">Convites pendentes</p>
            </div>
          </div>

          {/* Ações */}
          {showActions && (
            <div className="space-y-2">
              <Button 
                onClick={() => navigate('/shhhhcoin-wallet')} 
                className="w-full" 
                size="sm"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Ver Carteira
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => navigate('/shhhhcoin-shop')} 
                  variant="outline" 
                  size="sm"
                >
                  <ShoppingBag className="w-4 h-4 mr-1" />
                  Loja
                </Button>
                <Button 
                  onClick={() => navigate('/shhhhcoin-wallet?tab=invites')} 
                  variant="outline" 
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Convidar
                </Button>
              </div>
            </div>
          )}

          {/* Dica para novos usuários */}
          {balance === 0 && completedInvites === 0 && (
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 mb-2">
                💡 Convide amigos para ganhar seus primeiros shhhhcoins!
              </p>
              <Button 
                size="sm" 
                onClick={() => navigate('/shhhhcoin-wallet?tab=invites')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Criar Convite
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletBalance;
