-- ================================================
-- DIAGNÓSTICO E CORREÇÃO DE PERMISSÕES - SHHHHCOIN
-- Para Supabase Self-Hosted
-- ================================================

-- Verificar se as tabelas existem
SELECT 'Verificando tabelas existentes...' as status;

SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name LIKE 'shhhhcoin%' OR table_name LIKE 'referral%' OR table_name LIKE 'fraud%'
ORDER BY table_name;

-- Verificar se RLS está ativado
SELECT 'Verificando RLS...' as status;

SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables 
WHERE tablename LIKE 'shhhhcoin%' OR tablename LIKE 'referral%' OR tablename LIKE 'fraud%';

-- Verificar políticas existentes
SELECT 'Verificando políticas...' as status;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename LIKE 'shhhhcoin%' OR tablename LIKE 'referral%' OR tablename LIKE 'fraud%'
ORDER BY tablename, policyname;

-- ================================================
-- CORREÇÕES PARA SUPABASE SELF-HOSTED
-- ================================================

-- Desabilitar RLS temporariamente para teste
ALTER TABLE shhhhcoin_wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE shhhhcoin_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE referral_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE shhhhcoin_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE shhhhcoin_purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_detection_logs DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "Users can view their own wallet" ON shhhhcoin_wallets;
DROP POLICY IF EXISTS "Users can view their own transactions" ON shhhhcoin_transactions;
DROP POLICY IF EXISTS "Users can view their own invites" ON referral_invites;
DROP POLICY IF EXISTS "Users can create invites" ON referral_invites;
DROP POLICY IF EXISTS "Users can update their own invites" ON referral_invites;
DROP POLICY IF EXISTS "Anyone can view active products" ON shhhhcoin_products;
DROP POLICY IF EXISTS "Users can view their own purchases" ON shhhhcoin_purchases;
DROP POLICY IF EXISTS "Users can create purchases" ON shhhhcoin_purchases;
DROP POLICY IF EXISTS "Admins can view fraud logs" ON fraud_detection_logs;

-- Conceder permissões básicas para authenticated users
GRANT ALL ON shhhhcoin_wallets TO authenticated;
GRANT ALL ON shhhhcoin_transactions TO authenticated;
GRANT ALL ON referral_invites TO authenticated;
GRANT ALL ON shhhhcoin_products TO authenticated;
GRANT ALL ON shhhhcoin_purchases TO authenticated;
GRANT ALL ON fraud_detection_logs TO authenticated;

-- Conceder permissões para anon users (para casos específicos)
GRANT SELECT ON shhhhcoin_products TO anon;

-- Conceder permissões para service_role
GRANT ALL ON shhhhcoin_wallets TO service_role;
GRANT ALL ON shhhhcoin_transactions TO service_role;
GRANT ALL ON referral_invites TO service_role;
GRANT ALL ON shhhhcoin_products TO service_role;
GRANT ALL ON shhhhcoin_purchases TO service_role;
GRANT ALL ON fraud_detection_logs TO service_role;

-- Reabilitar RLS e criar políticas mais simples
ALTER TABLE shhhhcoin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE shhhhcoin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE shhhhcoin_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shhhhcoin_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_detection_logs ENABLE ROW LEVEL SECURITY;

-- Políticas simplificadas para carteiras
CREATE POLICY "wallet_policy" ON shhhhcoin_wallets
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Políticas simplificadas para transações
CREATE POLICY "transaction_policy" ON shhhhcoin_transactions
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Políticas simplificadas para convites
CREATE POLICY "invite_policy" ON referral_invites
    FOR ALL TO authenticated
    USING (inviter_id = auth.uid() OR invited_user_id = auth.uid())
    WITH CHECK (inviter_id = auth.uid());

-- Políticas simplificadas para produtos (todos podem ver)
CREATE POLICY "product_policy" ON shhhhcoin_products
    FOR SELECT TO authenticated
    USING (true);

-- Políticas simplificadas para compras
CREATE POLICY "purchase_policy" ON shhhhcoin_purchases
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Políticas simplificadas para logs de fraude (apenas service_role)
CREATE POLICY "fraud_policy" ON fraud_detection_logs
    FOR ALL TO service_role
    USING (true);

-- Verificar se auth.uid() está funcionando
SELECT 'Testando auth.uid()...' as status;
SELECT auth.uid() as current_user_id;

-- Inserir dados de teste se necessário
INSERT INTO shhhhcoin_products (name, description, price, category, status) VALUES
('Produto Teste', 'Produto para testar o sistema', 10.00, 'test', 'active')
ON CONFLICT (name) DO NOTHING;

-- Mostrar resultado
SELECT 'Correções aplicadas!' as status;
SELECT 'Execute SELECT * FROM shhhhcoin_products; para testar' as next_step; 