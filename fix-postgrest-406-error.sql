-- ================================================
-- CORREÇÃO PARA ERRO HTTP 406 - PostgREST
-- Para Supabase Self-Hosted
-- ================================================

-- O erro 406 geralmente ocorre quando o PostgREST não consegue
-- interpretar corretamente as consultas ou quando há problemas
-- com os tipos de dados/formatos

-- Verificar configuração do PostgREST
SELECT 'Verificando configuração do banco...' as status;

-- Verificar se as funções auth estão funcionando
SELECT 'Testando funções auth...' as status;
SELECT 
    CASE 
        WHEN auth.uid() IS NULL THEN 'auth.uid() retorna NULL - usuário não autenticado'
        ELSE 'auth.uid() funcionando: ' || auth.uid()::text
    END as auth_status;

-- Verificar se o role 'authenticated' existe
SELECT 'Verificando roles...' as status;
SELECT rolname FROM pg_roles WHERE rolname IN ('authenticated', 'anon', 'service_role');

-- Verificar se as tabelas estão no schema correto
SELECT 'Verificando schemas...' as status;
SELECT DISTINCT table_schema 
FROM information_schema.tables 
WHERE table_name LIKE 'shhhhcoin%';

-- Para corrigir problemas de HTTP 406, vamos garantir que
-- as tabelas tenham permissões corretas para o PostgREST

-- Conceder permissões específicas para o schema public
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- Conceder permissões em todas as sequences também
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Atualizar estatísticas das tabelas (pode ajudar com problemas de query)
ANALYZE shhhhcoin_wallets;
ANALYZE shhhhcoin_transactions;
ANALYZE referral_invites;
ANALYZE shhhhcoin_products;
ANALYZE shhhhcoin_purchases;
ANALYZE fraud_detection_logs;

-- Verificar se as tabelas são visíveis para o PostgREST
SELECT 'Verificando visibilidade das tabelas...' as status;
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'shhhhcoin%';

-- Criar uma view simplificada para testar conectividade
CREATE OR REPLACE VIEW shhhhcoin_test AS
SELECT 
    'Sistema shhhhcoin funcionando' as status,
    current_timestamp as timestamp,
    current_user as current_role;

-- Conceder permissões na view de teste
GRANT SELECT ON shhhhcoin_test TO authenticated;
GRANT SELECT ON shhhhcoin_test TO anon;
GRANT SELECT ON shhhhcoin_test TO service_role;

-- Verificar se há algum problema com os tipos de dados
SELECT 'Verificando tipos de dados...' as status;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'shhhhcoin_wallets'
ORDER BY ordinal_position;

-- Teste de inserção simples para verificar se funciona
DO $$
BEGIN
    -- Tentar inserir um registro de teste
    INSERT INTO shhhhcoin_wallets (user_id, balance, total_earned, total_spent, total_purchased)
    VALUES (
        'test-user-id', 
        0.00, 
        0.00, 
        0.00, 
        0.00
    );
    
    RAISE NOTICE 'Teste de inserção bem-sucedido';
    
    -- Limpar o teste
    DELETE FROM shhhhcoin_wallets WHERE user_id = 'test-user-id';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro no teste de inserção: %', SQLERRM;
END $$;

-- Verificar se o trigger de criação de carteira está funcionando
SELECT 'Verificando triggers...' as status;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%wallet%';

-- Mostrar resultado final
SELECT 'Correções para HTTP 406 aplicadas!' as status;
SELECT 'Agora teste acessar: /rest/v1/shhhhcoin_test' as next_step; 