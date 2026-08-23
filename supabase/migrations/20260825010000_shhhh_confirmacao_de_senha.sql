-- Reconfirmação de senha sem passar pelo login.
--
-- A exclusão de conta reconfirmava a senha com `signInWithPassword`. Quando o
-- Turnstile foi ligado, o GoTrue passou a exigir captcha também no login — e a
-- exclusão de conta quebrou junto, silenciosamente, num fluxo que é obrigação
-- legal. Este é o tipo de acoplamento que só aparece quando se testa o produto
-- inteiro depois de mexer em autenticação.
--
-- Aqui a senha é conferida direto contra o hash que o GoTrue guarda, com o
-- mesmo bcrypt. Além de não depender de captcha, não cria sessão nova nem
-- registra um login que não aconteceu.
CREATE OR REPLACE FUNCTION public.verify_my_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE hash_atual text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;
  IF p_password IS NULL OR p_password = '' THEN
    RETURN false;
  END IF;

  SELECT encrypted_password INTO hash_atual FROM auth.users WHERE id = auth.uid();
  IF hash_atual IS NULL OR hash_atual = '' THEN
    -- Conta sem senha (login social, por exemplo) não tem o que reconfirmar.
    RETURN false;
  END IF;

  RETURN extensions.crypt(p_password, hash_atual) = hash_atual;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_my_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_my_password(text) TO authenticated, service_role;
