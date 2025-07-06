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
      toast.error('Usuário não logado');
      return null;
    }

    try {
      // Verificar se pode criar convite
      const { can, reason } = await canCreateInvite();
      if (!can) {
        toast.error(reason || 'Não é possível criar convite');
        return null;
      }

      // Obter informações do usuário para detecção de fraude
      const userInfo = await getUserInfo();
      
      // Gerar código único
      const inviteCode = generateInviteCode();
      
      // Criar convite
      const { data, error } = await supabase
        .from('referral_invites')
        .insert({
          inviter_id: user.id,
          invite_code: inviteCode,
          reward_amount: 100,
          ip_address: userInfo.ip_address,
          user_agent: userInfo.user_agent,
          country_code: userInfo.country_code,
          city: userInfo.city
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Código de convite criado com sucesso!');
      await fetchInvites(); // Atualizar lista
      return inviteCode;
    } catch (err: any) {
      console.error('Erro ao criar convite:', err);
      toast.error('Erro ao criar convite');
      return null;
    }
  };

  // Validar código de convite
  const validateInviteCode = async (inviteCode: string): Promise<{ valid: boolean; invite?: any; reason?: string }> => {
    try {
      const { data, error } = await supabase
        .from('referral_invites')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { valid: false, reason: 'Código de convite não encontrado ou expirado' };
        }
        throw error;
      }

      return { valid: true, invite: data };
    } catch (err: any) {
      console.error('Erro ao validar convite:', err);
      return { valid: false, reason: 'Erro ao validar convite' };
    }
  };

  // Aplicar código de convite
  const applyInviteCode = async (inviteCode: string, newUserId: string): Promise<boolean> => {
    try {
      const { valid, invite } = await validateInviteCode(inviteCode);
      
      if (!valid) return false;

      // Verificar se o usuário não está tentando usar seu próprio convite
      if (invite.inviter_id === newUserId) {
        toast.error('Não é possível usar seu próprio código de convite');
        return false;
      }

      // Atualizar convite com o novo usuário
      const { error } = await supabase
        .from('referral_invites')
        .update({
          invited_user_id: newUserId,
          used_at: new Date().toISOString()
        })
        .eq('id', invite.id);

      if (error) throw error;

      toast.success('Código de convite aplicado! Você receberá a recompensa quando postar seu primeiro áudio.');
      return true;
    } catch (err: any) {
      console.error('Erro ao aplicar convite:', err);
      toast.error('Erro ao aplicar código de convite');
      return false;
    }
  };

  // Comprar produto
  const purchaseProduct = async (productId: string): Promise<boolean> => {
    if (!user || !wallet) {
      toast.error('Usuário não logado ou carteira não encontrada');
      return false;
    }

    try {
      const product = products.find(p => p.id === productId);
      if (!product) {
        toast.error('Produto não encontrado');
        return false;
      }

      if (wallet.balance < product.price) {
        toast.error('Saldo insuficiente');
        return false;
      }

      // Verificar se produto já foi comprado (para produtos permanentes)
      const existingPurchase = purchases.find(p => 
        p.product_id === productId && 
        p.status === 'completed' &&
        (!p.expires_at || new Date(p.expires_at) > new Date())
      );

      if (existingPurchase) {
        toast.error('Você já possui este produto');
        return false;
      }

      // Usar a função spend_shhhhcoins do banco
      const { data, error } = await supabase.rpc('spend_shhhhcoins', {
        p_user_id: user.id,
        p_amount: product.price,
        p_description: `Compra: ${product.name}`,
        p_reference_id: productId,
        p_reference_type: 'product_purchase'
      });

      if (error) throw error;

      // Criar registro de compra
      const expiresAt = product.duration_days 
        ? new Date(Date.now() + product.duration_days * 24 * 60 * 60 * 1000)
        : null;

      const { error: purchaseError } = await supabase
        .from('shhhhcoin_purchases')
        .insert({
          user_id: user.id,
          product_id: productId,
          transaction_id: data,
          amount_paid: product.price,
          expires_at: expiresAt
        });

      if (purchaseError) throw purchaseError;

      toast.success(`${product.name} comprado com sucesso!`);
      
      // Atualizar dados
      await Promise.all([
        fetchWallet(),
        fetchTransactions(),
        fetchPurchases()
      ]);

      return true;
    } catch (err: any) {
      console.error('Erro ao comprar produto:', err);
      toast.error('Erro ao processar compra');
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