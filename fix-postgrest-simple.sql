-- ================================================
-- CORREÇÃO SIMPLES PARA ERROS HTTP 406/403
-- Para Supabase Self-Hosted (Compatível)
-- ================================================

-- Verificar se as funções auth existem
SELECT 'Verificando funções auth...' as status;

DO $$
BEGIN
    -- Verificar se auth.uid() existe
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uid' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
        RAISE NOTICE 'Função auth.uid() existe';
    ELSE
        RAISE NOTICE 'ATENÇÃO: Função auth.uid() não encontrada!';
    END IF;
END $$;

-- Verificar roles básicos
SELECT 'Verificando roles...' as status;
SELECT rolname FROM pg_roles WHERE rolname IN ('authenticated', 'anon', 'service_role', 'postgres');

-- Conceder permissões básicas no schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- Garantir que as tabelas existam antes de conceder permissões
DO $$
DECLARE
    table_exists boolean;
BEGIN
    -- Verificar shhhhcoin_products
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'shhhhcoin_products'
    ) INTO table_exists;
    
    IF table_exists THEN
        GRANT SELECT ON shhhhcoin_products TO authenticated;
        GRANT SELECT ON shhhhcoin_products TO anon;
        GRANT ALL ON shhhhcoin_products TO service_role;
        RAISE NOTICE 'Permissões concedidas para shhhhcoin_products';
    ELSE
        RAISE NOTICE 'Tabela shhhhcoin_products não encontrada';
    END IF;
    
    -- Verificar shhhhcoin_wallets
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'shhhhcoin_wallets'
    ) INTO table_exists;
    
    IF table_exists THEN
        GRANT ALL ON shhhhcoin_wallets TO authenticated;
        GRANT ALL ON shhhhcoin_wallets TO service_role;
        RAISE NOTICE 'Permissões concedidas para shhhhcoin_wallets';
    ELSE
        RAISE NOTICE 'Tabela shhhhcoin_wallets não encontrada';
    END IF;
END $$;

-- Desabilitar RLS temporariamente para teste
DO $$
DECLARE
    table_exists boolean;
BEGIN
    -- shhhhcoin_products
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'shhhhcoin_products'
    ) INTO table_exists;
    
    IF table_exists THEN
        ALTER TABLE shhhhcoin_products DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS desabilitado para shhhhcoin_products';
    END IF;
    
    -- shhhhcoin_wallets
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'shhhhcoin_wallets'
    ) INTO table_exists;
    
    IF table_exists THEN
        ALTER TABLE shhhhcoin_wallets DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS desabilitado para shhhhcoin_wallets';
    END IF;
    
    -- Outras tabelas
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'shhhhcoin_transactions'
    ) INTO table_exists;
    
    IF table_exists THEN
        ALTER TABLE shhhhcoin_transactions DISABLE ROW LEVEL SECURITY;
        GRANT ALL ON shhhhcoin_transactions TO authenticated;
        GRANT ALL ON shhhhcoin_transactions TO service_role;
        RAISE NOTICE 'RLS desabilitado para shhhhcoin_transactions';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'referral_invites'
    ) INTO table_exists;
    
    IF table_exists THEN
        ALTER TABLE referral_invites DISABLE ROW LEVEL SECURITY;
        GRANT ALL ON referral_invites TO authenticated;
        GRANT ALL ON referral_invites TO service_role;
        RAISE NOTICE 'RLS desabilitado para referral_invites';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'shhhhcoin_purchases'
    ) INTO table_exists;
    
    IF table_exists THEN
        ALTER TABLE shhhhcoin_purchases DISABLE ROW LEVEL SECURITY;
        GRANT ALL ON shhhhcoin_purchases TO authenticated;
        GRANT ALL ON shhhhcoin_purchases TO service_role;
        RAISE NOTICE 'RLS desabilitado para shhhhcoin_purchases';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'fraud_detection_logs'
    ) INTO table_exists;
    
    IF table_exists THEN
        ALTER TABLE fraud_detection_logs DISABLE ROW LEVEL SECURITY;
        GRANT ALL ON fraud_detection_logs TO service_role;
        RAISE NOTICE 'RLS desabilitado para fraud_detection_logs';
    END IF;
END $$;

-- Criar tabela de teste simples se não existir
CREATE TABLE IF NOT EXISTS shhhhcoin_test (
    id SERIAL PRIMARY KEY,
    message TEXT DEFAULT 'Sistema funcionando',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Inserir dados de teste
INSERT INTO shhhhcoin_test (message) VALUES ('Teste de conectividade') ON CONFLICT DO NOTHING;

-- Conceder permissões na tabela de teste
GRANT ALL ON shhhhcoin_test TO authenticated;
GRANT ALL ON shhhhcoin_test TO anon;
GRANT ALL ON shhhhcoin_test TO service_role;

-- Conceder permissões na sequence da tabela de teste
GRANT ALL ON shhhhcoin_test_id_seq TO authenticated;
GRANT ALL ON shhhhcoin_test_id_seq TO service_role;

-- Atualizar estatísticas
DO $$
BEGIN
    -- Só executa ANALYZE se a tabela existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_products') THEN
        ANALYZE shhhhcoin_products;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shhhhcoin_wallets') THEN
        ANALYZE shhhhcoin_wallets;
    END IF;
    
    ANALYZE shhhhcoin_test;
END $$;

-- Teste de SELECT simples
SELECT 'Teste de SELECT básico...' as status;
SELECT * FROM shhhhcoin_test LIMIT 1;

-- Mostrar resultado
SELECT 'Correções aplicadas com sucesso!' as status;
SELECT 'Agora teste acessar via API: /rest/v1/shhhhcoin_test' as next_step;
SELECT 'Se der erro 406, verifique os logs do PostgREST' as tip; 