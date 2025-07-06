import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  ShhhhcoinWallet, 
  ShhhhcoinTransaction, 
  ReferralInvite, 
  ShhhhcoinProduct,
  ShhhhcoinPurchase,
  generateInviteCode 
} from '@/utils/shhhhcoin';
import { toast } from 'sonner';

// Função para obter informações de IP/localização do usuário
const getUserInfo = async () => {
  try {
    // Obter IP do usuário (usando um serviço público)
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    
    // Obter informações de localização básicas
    const locationResponse = await fetch(`https://ipapi.co/${ipData.ip}/json/`);
    const locationData = await locationResponse.json();
    
    return {
      ip_address: ipData.ip,
      user_agent: navigator.userAgent,
      country_code: locationData.country_code || null,
      city: locationData.city || null,
    };
  } catch (error) {
    console.warn('Não foi possível obter informações de IP:', error);
    return {
      ip_address: null,
      user_agent: navigator.userAgent,
      country_code: null,
      city: null,
    };
  }
};

export const useShhhhcoin = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<ShhhhcoinWallet | null>(null);
  const [transactions, setTransactions] = useState<ShhhhcoinTransaction[]>([]);
  const [invites, setInvites] = useState<ReferralInvite[]>([]);
  const [products, setProducts] = useState<ShhhhcoinProduct[]>([]);
  const [purchases, setPurchases] = useState<ShhhhcoinPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar carteira do usuário
  const fetchWallet = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('shhhhcoin_wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (!data) {
        // Criar carteira se não existir
        const { data: newWallet, error: createError } = await supabase
          .from('shhhhcoin_wallets')
          .insert({
            user_id: user.id,
            balance: 0,
            total_earned: 0,
            total_spent: 0
          })
          .select()
          .single();
        
        if (createError) throw createError;
        setWallet(newWallet);
      } else {
        setWallet(data);
      }
    } catch (err: any) {
      console.error('Erro ao buscar carteira:', err);
      setError(err.message);
    }
  };

  // Buscar transações
  const fetchTransactions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('shhhhcoin_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setTransactions(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar transações:', err);
    }
  };

  // Buscar convites
  const fetchInvites = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('referral_invites')
        .select('*')
        .eq('inviter_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setInvites(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar convites:', err);
    }
  };

  // Buscar produtos
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('shhhhcoin_products')
        .select('*')
        .eq('status', 'active')
        .order('price', { ascending: true });
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar produtos:', err);
    }
  };

  // Buscar compras
  const fetchPurchases = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('shhhhcoin_purchases')
        .select('*, product:shhhhcoin_products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPurchases(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar compras:', err);
    }
  };

  // Verificar se usuário pode criar convites (anti-spam)
  const canCreateInvite = async (): Promise<{ can: boolean; reason?: string }> => {
    if (!user) return { can: false, reason: 'Usuário não logado' };

    try {
      // Verificar quantos convites foram criados nas últimas 24 horas
      const { data: recentInvites, error } = await supabase
        .from('referral_invites')
        .select('id')
        .eq('inviter_id', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      // Limite de 5 convites por dia
      if (recentInvites && recentInvites.length >= 5) {
        return { can: false, reason: 'Limite de 5 convites por dia atingido' };
      }

      // Verificar convites nas últimas 2 horas (anti-spam)
      const { data: veryRecentInvites } = await supabase
        .from('referral_invites')
        .select('id')
        .eq('inviter_id', user.id)
        .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

      if (veryRecentInvites && veryRecentInvites.length >= 3) {
        return { can: false, reason: 'Muitos convites criados recentemente. Aguarde 2 horas.' };
      }

      return { can: true };
    } catch (err: any) {
      console.error('Erro ao verificar limites de convite:', err);
      return { can: false, reason: 'Erro interno' };
    }
  };

  // Criar convite com verificações de segurança
  const createInvite = async (): Promise<string | null> => {
    if (!user) {
      toast.error('Você precisa estar logado para criar convites');
      return null;
    }

    // Verificar se pode criar convite
    const { can, reason } = await canCreateInvite();
    if (!can) {
      toast.error(reason || 'Não é possível criar convite no momento');
      return null;
    }
    
    try {
      // Obter informações do usuário para detecção de fraude
      const userInfo = await getUserInfo();
      
      const inviteCode = generateInviteCode();
      const { data, error } = await supabase
        .from('referral_invites')
        .insert({
          inviter_id: user.id,
          invite_code: inviteCode,
          reward_amount: 100,
          ip_address: userInfo.ip_address,
          user_agent: userInfo.user_agent,
          country_code: userInfo.country_code,
          city: userInfo.city,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      await fetchInvites();
      toast.success('Convite criado com sucesso!');
      
      return inviteCode;
    } catch (err: any) {
      console.error('Erro ao criar convite:', err);
      if (err.message.includes('duplicate key')) {
        toast.error('Código já existe, tente novamente');
      } else {
        toast.error('Erro ao criar convite');
      }
      return null;
    }
  };

  // Validar e processar uso de convite
  const validateInviteCode = async (inviteCode: string): Promise<{ valid: boolean; invite?: any; reason?: string }> => {
    try {
      const { data: invite, error } = await supabase
        .from('referral_invites')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .eq('status', 'pending')
        .single();
      
      if (error || !invite) {
        return { valid: false, reason: 'Código de convite inválido ou expirado' };
      }

      // Verificar se não expirou
      if (new Date(invite.expires_at) < new Date()) {
        return { valid: false, reason: 'Código de convite expirado' };
      }

      // Verificar se o usuário não está tentando usar seu próprio convite
      if (user && invite.inviter_id === user.id) {
        return { valid: false, reason: 'Você não pode usar seu próprio convite' };
      }

      return { valid: true, invite };
    } catch (err: any) {
      console.error('Erro ao validar convite:', err);
      return { valid: false, reason: 'Erro ao validar convite' };
    }
  };

  // Aplicar convite durante o registro
  const applyInviteCode = async (inviteCode: string, newUserId: string): Promise<boolean> => {
    try {
      const { valid, invite, reason } = await validateInviteCode(inviteCode);
      
      if (!valid) {
        toast.error(reason || 'Convite inválido');
        return false;
      }

      // Obter informações do usuário para log de segurança
      const userInfo = await getUserInfo();

      // Marcar convite como usado
      const { error: updateError } = await supabase
        .from('referral_invites')
        .update({ 
          invited_user_id: newUserId,
          // Note: status ainda será 'pending' até o primeiro post
        })
        .eq('id', invite.id);

      if (updateError) throw updateError;

      // Log de segurança
      await supabase
        .from('fraud_detection_logs')
        .insert({
          user_id: newUserId,
          invite_id: invite.id,
          ip_address: userInfo.ip_address,
          user_agent: userInfo.user_agent,
          event_type: 'invite_applied',
          risk_score: 0,
          is_blocked: false,
          metadata: {
            country_code: userInfo.country_code,
            city: userInfo.city,
            inviter_id: invite.inviter_id
          }
        });

      toast.success('Convite aplicado! Você receberá os pontos quando postar seu primeiro áudio.');
      return true;
    } catch (err: any) {
      console.error('Erro ao aplicar convite:', err);
      toast.error('Erro ao processar convite');
      return false;
    }
  };

  // Comprar produto
  const purchaseProduct = async (productId: string): Promise<boolean> => {
    if (!user || !wallet) {
      toast.error('Você precisa estar logado');
      return false;
    }
    
    const product = products.find(p => p.id === productId);
    if (!product) {
      toast.error('Produto não encontrado');
      return false;
    }
    
    if (wallet.balance < product.price) {
      toast.error('Saldo insuficiente');
      return false;
    }
    
    try {
      // Primeiro, debitar da carteira usando a função SQL
      const { error: debitError } = await supabase.rpc('spend_shhhhcoins', {
        p_user_id: user.id,
        p_amount: product.price,
        p_description: `Compra: ${product.name}`,
        p_reference_id: productId,
        p_reference_type: 'purchase'
      });
      
      if (debitError) throw debitError;
      
      // Criar registro de compra
      const { error: purchaseError } = await supabase
        .from('shhhhcoin_purchases')
        .insert({
          user_id: user.id,
          product_id: productId,
          amount_paid: product.price,
          expires_at: product.duration_days ? 
            new Date(Date.now() + product.duration_days * 24 * 60 * 60 * 1000).toISOString() :
            null
        });
      
      if (purchaseError) throw purchaseError;
      
      // Atualizar dados
      await Promise.all([
        fetchWallet(),
        fetchTransactions(),
        fetchPurchases()
      ]);
      
      toast.success(`${product.name} comprado com sucesso!`);
      return true;
    } catch (err: any) {
      console.error('Erro ao comprar produto:', err);
      
      if (err.message.includes('Insufficient balance')) {
        toast.error('Saldo insuficiente');
      } else {
        toast.error('Erro ao processar compra');
      }
      return false;
    }
  };

  // Verificar se usuário tem produto ativo
  const hasActiveProduct = (productId: string): boolean => {
    return purchases.some(purchase => 
      purchase.product_id === productId && 
      purchase.status === 'completed' &&
      (!purchase.expires_at || new Date(purchase.expires_at) > new Date())
    );
  };

  // Obter estatísticas do usuário
  const getStats = () => {
    const activeInvites = invites.filter(invite => invite.status === 'pending').length;
    const completedInvites = invites.filter(invite => invite.status === 'completed').length;
    const totalEarned = wallet?.total_earned || 0;
    const totalSpent = wallet?.total_spent || 0;
    
    return {
      activeInvites,
      completedInvites,
      totalEarned,
      totalSpent,
      totalPurchases: purchases.length
    };
  };

  // Inicializar dados
  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([
        fetchWallet(),
        fetchTransactions(),
        fetchInvites(),
        fetchProducts(),
        fetchPurchases()
      ]).finally(() => {
        setLoading(false);
      });
    } else {
      setWallet(null);
      setTransactions([]);
      setInvites([]);
      setPurchases([]);
      setLoading(false);
    }
  }, [user]);

  return {
    wallet,
    transactions,
    invites,
    products,
    purchases,
    loading,
    error,
    createInvite,
    validateInviteCode,
    applyInviteCode,
    purchaseProduct,
    hasActiveProduct,
    getStats,
    refreshData: () => {
      if (user) {
        Promise.all([
          fetchWallet(),
          fetchTransactions(),
          fetchInvites(),
          fetchProducts(),
          fetchPurchases()
        ]);
      }
    }
  };
};
