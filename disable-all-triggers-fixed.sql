-- 🔧 SCRIPT CORRIGIDO - Desabilitar todas as triggers
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

-- Verificar se conseguimos acessar auth.users
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
-- PASSO 3: TESTAR POLÍTICAS RLS (versão compatível)
-- =====================================================

-- Verificar políticas existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'shhhhcoin_wallets');

-- Verificar se as tabelas têm RLS ativado (método compatível)
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('profiles', 'shhhhcoin_wallets');

-- =====================================================
-- PASSO 4: VERIFICAR FUNÇÕES EXISTENTES
-- =====================================================

-- Listar funções que podem estar causando problema
SELECT 
  p.proname as function_name,
  n.nspname as schema_name,
  p.prosrc as function_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('handle_new_user', 'create_shhhhcoin_wallet')
  AND n.nspname = 'public';

-- =====================================================
-- MENSAGEM DE SUCESSO
-- =====================================================

SELECT 'Triggers desabilitadas com sucesso! Agora teste o cadastro.' as resultado; 