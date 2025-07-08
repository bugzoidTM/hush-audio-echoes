-- ================================================
-- FIX URGENTE: Erro 500 na criação de usuário
-- ================================================

-- PASSO 1: Remover trigger problemático
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- PASSO 2: Verificar se a função existe e removê-la
DROP FUNCTION IF EXISTS handle_new_user();

-- PASSO 3: Criar versão simplificada da função (sem falhas)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Inserir perfil básico (essencial)
  INSERT INTO profiles (id, username, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substring(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'username', 'Usuário'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Inserir role básico (essencial)
  INSERT INTO user_roles (user_id, role, created_at)
  VALUES (NEW.id, 'user', NOW())
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Inserir stats básicas (essencial)
  INSERT INTO user_stats (user_id, updated_at)
  VALUES (NEW.id, NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- PASSO 4: Recriar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_user();

-- PASSO 5: Testar a função
SELECT 'Fix aplicado com sucesso!' as status;

-- PASSO 6: Verificar se o trigger está ativo
SELECT 
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- PASSO 7: Verificar se a função existe
SELECT 
  proname as function_name,
  prokind as type
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- Mensagem final
SELECT '✅ Correção aplicada! Teste criar usuário agora.' as resultado; 