-- 🔧 REATIVAR TRIGGERS CORRIGIDAS
-- Execute isso no SQL Editor do Supabase após confirmar que o cadastro funciona sem triggers
-- https://supabase.nutef.com (SQL Editor)

-- =====================================================
-- PASSO 1: RECRIAR FUNÇÃO handle_new_user CORRIGIDA
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Inserir perfil com ON CONFLICT DO NOTHING para evitar duplicatas
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

  -- Inserir stats com ON CONFLICT DO NOTHING
  INSERT INTO public.user_stats (
    user_id, 
    posts_count, 
    followers_count, 
    following_count, 
    created_at, 
    updated_at
  ) 
  VALUES (
    NEW.id, 
    0, 
    0, 
    0, 
    NOW(), 
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =====================================================
-- PASSO 2: RECRIAR FUNÇÃO create_shhhhcoin_wallet CORRIGIDA
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_shhhhcoin_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se a carteira já existe antes de tentar inserir
  IF NOT EXISTS (
    SELECT 1 FROM public.shhhhcoin_wallets 
    WHERE user_id = NEW.id
  ) THEN
    -- Tentar inserir a carteira com tratamento de erro
    BEGIN
      INSERT INTO public.shhhhcoin_wallets (
        user_id, 
        balance, 
        created_at, 
        updated_at
      ) 
      VALUES (
        NEW.id, 
        100.0, 
        NOW(), 
        NOW()
      );
    EXCEPTION
      WHEN unique_violation THEN
        -- Se houver violação de unicidade, apenas registrar (não quebrar o cadastro)
        RAISE NOTICE 'Carteira já existe para o usuário %', NEW.id;
      WHEN OTHERS THEN
        -- Para outros erros, registrar mas não quebrar o cadastro
        RAISE NOTICE 'Erro ao criar carteira para usuário %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- PASSO 3: RECRIAR TRIGGERS CORRIGIDAS
-- =====================================================

-- Remover triggers antigas (se existirem)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS create_wallet_on_user_creation ON auth.users;

-- Criar trigger para perfil, roles e stats
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Criar trigger para carteira
CREATE TRIGGER create_wallet_on_user_creation
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_shhhhcoin_wallet();

-- =====================================================
-- PASSO 4: VERIFICAR TRIGGERS CRIADAS
-- =====================================================

-- Listar triggers ativas
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  event_object_table
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
  AND event_object_schema = 'auth'
ORDER BY trigger_name;

-- =====================================================
-- PASSO 5: TESTE DE INTEGRIDADE
-- =====================================================

-- Verificar se as funções foram criadas
SELECT 
  p.proname as function_name,
  n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('handle_new_user', 'create_shhhhcoin_wallet')
  AND n.nspname = 'public';

-- =====================================================
-- MENSAGEM DE SUCESSO
-- =====================================================

SELECT 'Triggers corrigidas reativadas com sucesso! Agora teste o cadastro completo.' as resultado; 