-- 🔧 SCRIPT PARA DESABILITAR RLS TEMPORARIAMENTE
-- Execute isso no SQL Editor do Supabase para teste
-- https://supabase.nutef.com (SQL Editor)

-- IMPORTANTE: Isso é apenas para TESTE! Não use em produção!

-- =====================================================
-- PASSO 1: DESABILITAR RLS TEMPORARIAMENTE
-- =====================================================

-- Desabilitar RLS em todas as tabelas problemáticas
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE shhhhcoin_wallets DISABLE ROW LEVEL SECURITY;

-- Verificar se RLS foi desabilitado
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('profiles', 'user_roles', 'user_stats', 'shhhhcoin_wallets');

-- =====================================================
-- PASSO 2: VERIFICAR ESTRUTURA DA TABELA user_stats
-- =====================================================

-- Verificar colunas da tabela user_stats
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_stats'
ORDER BY ordinal_position;

-- =====================================================
-- PASSO 3: CORRIGIR FUNÇÃO handle_new_user SE NECESSÁRIO
-- =====================================================

-- Recriar função com estrutura correta para user_stats
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Inserir perfil com ON CONFLICT DO NOTHING
  INSERT INTO public.profiles (
    id, 
    username, 
    display_name, 
    created_at, 
    updated_at
  ) 
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Usuário'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Inserir role com ON CONFLICT DO NOTHING
  INSERT INTO public.user_roles (
    user_id, 
    role, 
    created_at
  ) 
  VALUES (
    NEW.id, 
    'user', 
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Inserir stats com estrutura correta (sem created_at se não existir)
  INSERT INTO public.user_stats (
    user_id, 
    posts_count, 
    followers_count, 
    following_count, 
    updated_at
  ) 
  VALUES (
    NEW.id, 
    0, 
    0, 
    0, 
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =====================================================
-- MENSAGEM DE TESTE
-- =====================================================

SELECT 'RLS desabilitado temporariamente para teste. Teste o cadastro agora!' as resultado; 