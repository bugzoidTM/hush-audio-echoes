-- ================================================
-- CORREÇÃO: Problema de criação de usuário
-- Supabase Self-Hosted
-- ================================================

-- 1. Remover trigger problemático temporariamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Verificar se as tabelas necessárias existem
SELECT 'Verificando tabelas...' as status;

-- Verificar se profiles existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') 
    THEN 'Tabela profiles: ✅ Existe'
    ELSE 'Tabela profiles: ❌ Não existe'
  END as check_profiles;

-- Verificar se user_roles existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') 
    THEN 'Tabela user_roles: ✅ Existe'
    ELSE 'Tabela user_roles: ❌ Não existe'
  END as check_user_roles;

-- Verificar se user_stats existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_stats') 
    THEN 'Tabela user_stats: ✅ Existe'
    ELSE 'Tabela user_stats: ❌ Não existe'
  END as check_user_stats;

-- 3. Verificar se o ENUM app_role existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') 
    THEN 'ENUM app_role: ✅ Existe'
    ELSE 'ENUM app_role: ❌ Não existe - CRIANDO...'
  END as check_enum;

-- Criar ENUM se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END $$;

-- 4. Garantir que as tabelas tenham estrutura correta
-- Tabela profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela user_roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Tabela user_stats
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_posts INTEGER NOT NULL DEFAULT 0,
  total_likes_received INTEGER NOT NULL DEFAULT 0,
  total_likes_given INTEGER NOT NULL DEFAULT 0,
  total_replies INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. Recriar a função handle_new_user com tratamento de erros
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Tentar inserir na tabela profiles
  BEGIN
    INSERT INTO profiles (id, username, display_name)
    VALUES (
      NEW.id, 
      NEW.raw_user_meta_data ->> 'username',
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'username')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Erro ao inserir em profiles: %', SQLERRM;
  END;
  
  -- Tentar inserir na tabela user_roles
  BEGIN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Erro ao inserir em user_roles: %', SQLERRM;
  END;
  
  -- Tentar inserir na tabela user_stats
  BEGIN
    INSERT INTO user_stats (user_id)
    VALUES (NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Erro ao inserir em user_stats: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- 6. Recriar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 7. Habilitar RLS se não estiver habilitado
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- 8. Criar políticas básicas se não existirem
-- Políticas para profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id);

-- Políticas para user_stats
DROP POLICY IF EXISTS "Users can view all stats" ON user_stats;
CREATE POLICY "Users can view all stats" ON user_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own stats" ON user_stats;
CREATE POLICY "Users can update their own stats" ON user_stats FOR UPDATE USING (auth.uid() = user_id);

-- Mensagem de sucesso
SELECT '✅ Correção aplicada com sucesso!' as resultado;
SELECT '🔄 Agora teste criar um usuário novamente' as proxima_acao; 