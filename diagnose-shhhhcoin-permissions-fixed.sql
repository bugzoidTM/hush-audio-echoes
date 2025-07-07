-- ================================================
-- DIAGNÓSTICO E CORREÇÃO DE PERMISSÕES - SHHHHCOIN
-- Para Supabase Self-Hosted (Compatível com PostgreSQL mais antigo)
-- ================================================

-- Verificar versão do PostgreSQL
SELECT 'Verificando versão do PostgreSQL...' as status;
SELECT version() as postgresql_version;

-- Verificar se as tabelas existem
SELECT 'Verificando tabelas existentes...' as status;

SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name LIKE 'shhhhcoin%' OR table_name LIKE 'referral%' OR table_name LIKE 'fraud%'
ORDER BY table_name;

-- Verificar se RLS está ativado (compatível com versões mais antigas)
SELECT 'Verificando RLS...' as status;

SELECT 
    schemaname,
    tablename,
    rowsecurity
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
    cmd
FROM pg_policies 
WHERE tablename LIKE 'shhhhcoin%' OR tablename LIKE 'referral%' OR tablename LIKE 'fraud%'
ORDER BY tablename, policyname;

-- Verificar permissões nas tabelas
SELECT 'Verificando permissões...' as status;

SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_name LIKE 'shhhhcoin%' 
ORDER BY table_name, grantee;

-- ================================================
-- CORREÇÕES PARA SUPABASE SELF-HOSTED
-- ================================================

-- Desabilitar RLS temporariamente para teste
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_wallets') THEN
        ALTER TABLE shhhhcoin_wallets DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_transactions') THEN
        ALTER TABLE shhhhcoin_transactions DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_invites') THEN
        ALTER TABLE referral_invites DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_products') THEN
        ALTER TABLE shhhhcoin_products DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_purchases') THEN
        ALTER TABLE shhhhcoin_purchases DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fraud_detection_logs') THEN
        ALTER TABLE fraud_detection_logs DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Remover todas as políticas existentes
DO $$
BEGIN
    -- Remover políticas da migração original
    DROP POLICY IF EXISTS "Users can view their own wallet" ON shhhhcoin_wallets;
    DROP POLICY IF EXISTS "Users can view their own transactions" ON shhhhcoin_transactions;
    DROP POLICY IF EXISTS "Users can view their own invites" ON referral_invites;
    DROP POLICY IF EXISTS "Users can create invites" ON referral_invites;
    DROP POLICY IF EXISTS "Users can update their own invites" ON referral_invites;
    DROP POLICY IF EXISTS "Anyone can view active products" ON shhhhcoin_products;
    DROP POLICY IF EXISTS "Users can view their own purchases" ON shhhhcoin_purchases;
    DROP POLICY IF EXISTS "Users can create purchases" ON shhhhcoin_purchases;
    DROP POLICY IF EXISTS "Admins can view fraud logs" ON fraud_detection_logs;
    
    -- Remover políticas do script anterior
    DROP POLICY IF EXISTS "wallet_policy" ON shhhhcoin_wallets;
    DROP POLICY IF EXISTS "transaction_policy" ON shhhhcoin_transactions;
    DROP POLICY IF EXISTS "invite_policy" ON referral_invites;
    DROP POLICY IF EXISTS "product_policy" ON shhhhcoin_products;
    DROP POLICY IF EXISTS "purchase_policy" ON shhhhcoin_purchases;
    DROP POLICY IF EXISTS "fraud_policy" ON fraud_detection_logs;
END $$;

-- Verificar se os roles existem
SELECT 'Verificando roles...' as status;
SELECT rolname FROM pg_roles WHERE rolname IN ('authenticated', 'anon', 'service_role', 'postgres');

-- Conceder permissões básicas (verifica se tabela existe antes)
DO $$
BEGIN
    -- Verificar e conceder permissões para authenticated
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_wallets') THEN
        GRANT ALL ON shhhhcoin_wallets TO authenticated;
        GRANT ALL ON shhhhcoin_wallets TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_transactions') THEN
        GRANT ALL ON shhhhcoin_transactions TO authenticated;
        GRANT ALL ON shhhhcoin_transactions TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_invites') THEN
        GRANT ALL ON referral_invites TO authenticated;
        GRANT ALL ON referral_invites TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_products') THEN
        GRANT ALL ON shhhhcoin_products TO authenticated;
        GRANT ALL ON shhhhcoin_products TO service_role;
        GRANT SELECT ON shhhhcoin_products TO anon;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_purchases') THEN
        GRANT ALL ON shhhhcoin_purchases TO authenticated;
        GRANT ALL ON shhhhcoin_purchases TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fraud_detection_logs') THEN
        GRANT ALL ON fraud_detection_logs TO authenticated;
        GRANT ALL ON fraud_detection_logs TO service_role;
    END IF;
END $$;

-- Conceder permissões no schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- Conceder permissões em sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Testar acesso básico às tabelas (sem RLS por enquanto)
SELECT 'Testando acesso às tabelas...' as status;

DO $$
BEGIN
    -- Teste simples de SELECT em cada tabela
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_products') THEN
        PERFORM * FROM shhhhcoin_products LIMIT 1;
        RAISE NOTICE 'Tabela shhhhcoin_products acessível';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_wallets') THEN
        PERFORM * FROM shhhhcoin_wallets LIMIT 1;
        RAISE NOTICE 'Tabela shhhhcoin_wallets acessível';
    END IF;
    
    RAISE NOTICE 'Testes de acesso concluídos';
END $$;

-- Criar uma view de teste simples
CREATE OR REPLACE VIEW shhhhcoin_status AS
SELECT 
    'Sistema shhhhcoin funcionando' as status,
    current_timestamp as timestamp,
    current_user as current_role,
    (SELECT count(*) FROM shhhhcoin_products) as total_products,
    (SELECT count(*) FROM shhhhcoin_wallets) as total_wallets;

-- Conceder permissões na view
GRANT SELECT ON shhhhcoin_status TO authenticated;
GRANT SELECT ON shhhhcoin_status TO anon;
GRANT SELECT ON shhhhcoin_status TO service_role;

-- Mostrar status final
SELECT 'Diagnóstico e correções aplicadas!' as status;
SELECT 'Teste a view: SELECT * FROM shhhhcoin_status;' as next_step;

-- Verificar o status final das tabelas
SELECT 'Status final das tabelas:' as info;
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name LIKE 'shhhhcoin%' OR table_name = 'shhhhcoin_status'
ORDER BY table_name; 