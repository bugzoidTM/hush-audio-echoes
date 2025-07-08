-- 🔧 SCRIPT PARA DESABILITAR TODAS AS TRIGGERS
-- Execute isso no SQL Editor do Supabase
-- https://supabase.nutef.com (SQL Editor)

-- =====================================================
-- PASSO 1: DESABILITAR TODAS AS TRIGGERS
-- =====================================================

-- Listar todas as triggers existentes em auth.users
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
  AND event_object_schema = 'auth';

-- Desabilitar/remover todas as triggers conhecidas
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS create_wallet_on_user_creation ON auth.users;

-- Verificar se existem outras triggers
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
  AND event_object_schema = 'auth';

-- =====================================================
-- PASSO 2: VERIFICAR CONFIGURAÇÃO BÁSICA
-- =====================================================

-- Verificar se conseguimos inserir em auth.users diretamente
-- (NUNCA faça isso em produção - é apenas para teste)
SELECT 
  COUNT(*) as total_users
FROM auth.users;

-- Verificar se as tabelas dependentes estão OK
SELECT 
  COUNT(*) as profiles_count
FROM profiles;

SELECT 
  COUNT(*) as wallets_count
FROM shhhhcoin_wallets;

-- =====================================================
-- PASSO 3: TESTAR POLÍTICAS RLS
-- =====================================================

-- Verificar se RLS está causando problema
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  relhasrls
FROM pg_tables
LEFT JOIN pg_class ON pg_class.relname = pg_tables.tablename
WHERE tablename IN ('profiles', 'shhhhcoin_wallets');

-- Verificar políticas existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('profiles', 'shhhhcoin_wallets');

-- =====================================================
-- MENSAGEM DE SUCESSO
-- =====================================================

SELECT 'Triggers desabilitadas com sucesso! Agora teste o cadastro.' as resultado; 