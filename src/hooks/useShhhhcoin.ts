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

  // Criar convite
  const createInvite = async (): Promise<string | null> => {
    if (!user) {
      toast.error('Você precisa estar logado para criar convites');
      return null;
    }
    
    try {
      const inviteCode = generateInviteCode();
      const { data, error } = await supabase
        .from('referral_invites')
        .insert({
          inviter_id: user.id,
          invite_code: inviteCode,
          reward_amount: 100
        })
        .select()
        .single();
      
      if (error) throw error;
      
      await fetchInvites();
      toast.success('Convite criado com sucesso!');
      
      return inviteCode;
    } catch (err: any) {
      console.error('Erro ao criar convite:', err);
      toast.error('Erro ao criar convite');
      return null;
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
      // Primeiro, debitar da carteira
      const { error: debitError } = await supabase.rpc('spend_shhhhcoins', {
        p_user_id: user.id,
        p_amount: product.price,
        p_description: Compra: ,
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
          amount_paid: product.price
        });
      
      if (purchaseError) throw purchaseError;
      
      // Atualizar dados
      await Promise.all([
        fetchWallet(),
        fetchTransactions(),
        fetchPurchases()
      ]);
      
      toast.success(${product.name} comprado com sucesso!);
      return true;
    } catch (err: any) {
      console.error('Erro ao comprar produto:', err);
      toast.error('Erro ao processar compra');
      return false;
    }
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
    purchaseProduct,
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
