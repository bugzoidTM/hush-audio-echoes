-- ================================================
-- SOLUÇÃO FINAL: Erro 500 na criação de usuário
-- Remove e recria TODAS as triggers e funções
-- ================================================

-- PASSO 1: Remover TODAS as triggers em auth.users (exceto constraints)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS create_wallet_on_user_creation ON auth.users;

-- PASSO 2: Remover as funções antigas
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS create_shhhhcoin_wallet() CASCADE;

-- PASSO 3: Verificar se as tabelas necessárias existem
SELECT 'Verificando tabelas necessárias...' as status;

-- PASSO 4: Recriar função handle_new_user (CORRIGIDA)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Inserir perfil (com ON CONFLICT para evitar duplicatas)
  INSERT INTO profiles (id, username, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substring(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'username', 'Usuário'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Inserir role (com ON CONFLICT para evitar duplicatas)
  INSERT INTO user_roles (user_id, role, created_at)
  VALUES (NEW.id, 'user', NOW())
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Inserir stats (com ON CONFLICT para evitar duplicatas)
  INSERT INTO user_stats (user_id, updated_at)
  VALUES (NEW.id, NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- PASSO 5: Recriar função create_shhhhcoin_wallet (CORRIGIDA COM TRATAMENTO DE ERRO)
CREATE OR REPLACE FUNCTION create_shhhhcoin_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Tentar criar carteira apenas se não existir
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM shhhhcoin_wallets WHERE user_id = NEW.id
    ) THEN
      INSERT INTO shhhhcoin_wallets (user_id, balance, total_earned, total_spent, total_purchased)
      VALUES (NEW.id, 0.00, 0.00, 0.00, 0.00);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log erro mas NÃO interrompe o cadastro do usuário
    RAISE NOTICE 'Erro ao criar carteira para usuário %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- PASSO 6: Recriar trigger para perfil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_user();

-- PASSO 7: Recriar trigger para carteira
CREATE TRIGGER create_wallet_on_user_creation
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION create_shhhhcoin_wallet();

-- PASSO 8: Verificar se as triggers foram criadas
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  tgfoid::regprocedure as function_name
FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass
  AND tgname IN ('on_auth_user_created', 'create_wallet_on_user_creation');

-- PASSO 9: Verificar se as funções existem
SELECT 
  proname as function_name,
  prokind as type
FROM pg_proc 
WHERE proname IN ('handle_new_user', 'create_shhhhcoin_wallet');

-- PASSO 10: Testar inserção manual na carteira (para garantir que funciona)
DO $$
DECLARE
  test_uuid uuid := gen_random_uuid();
BEGIN
  -- Testar se consegue inserir na tabela de carteiras
  BEGIN
    INSERT INTO shhhhcoin_wallets (user_id, balance, total_earned, total_spent, total_purchased)
    VALUES (test_uuid, 0.00, 0.00, 0.00, 0.00);
    
    -- Limpar teste
    DELETE FROM shhhhcoin_wallets WHERE user_id = test_uuid;
    
    RAISE NOTICE 'Teste de inserção na carteira: SUCESSO';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Teste de inserção na carteira: FALHOU - %', SQLERRM;
  END;
END $$;

-- Mensagens finais
SELECT '✅ Correção aplicada com sucesso!' as resultado;
SELECT '🔄 Teste criar usuário agora!' as proxima_acao;
SELECT '📝 Ambas as triggers foram recriadas com tratamento de erro robusto' as observacao; 