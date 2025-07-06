-- ================================================
-- MIGRAÇÃO SHHHHCOIN - VERSÃO CORRIGIDA PARA SUPABASE
-- Sistema: Hush Audio Echoes
-- Funcionalidades: Sistema de pontos, convites, loja
-- ================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- TYPES / ENUMS (SEM IF NOT EXISTS)
-- ================================================

-- Remover tipos existentes se necessário (para re-execução)
DROP TYPE IF EXISTS shhhhcoin_transaction_type CASCADE;
DROP TYPE IF EXISTS referral_status CASCADE;
DROP TYPE IF EXISTS product_status CASCADE;
DROP TYPE IF EXISTS purchase_status CASCADE;

-- Criar tipos novamente
CREATE TYPE shhhhcoin_transaction_type AS ENUM ('earned', 'spent', 'purchased', 'refunded', 'bonus');
CREATE TYPE referral_status AS ENUM ('pending', 'completed', 'expired', 'cancelled');
CREATE TYPE product_status AS ENUM ('active', 'inactive', 'sold_out', 'discontinued');
CREATE TYPE purchase_status AS ENUM ('pending', 'completed', 'cancelled', 'refunded');

-- ================================================
-- TABELAS PRINCIPAIS
-- ================================================

-- Carteiras de shhhhcoin
CREATE TABLE IF NOT EXISTS shhhhcoin_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_earned DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_spent DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_purchased DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id),
    CONSTRAINT positive_balance CHECK (balance >= 0),
    CONSTRAINT positive_totals CHECK (total_earned >= 0 AND total_spent >= 0 AND total_purchased >= 0)
);

-- Histórico de transações
CREATE TABLE IF NOT EXISTS shhhhcoin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES shhhhcoin_wallets(id) ON DELETE CASCADE,
    transaction_type shhhhcoin_transaction_type NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    reference_id UUID,
    reference_type TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Convites de referral
CREATE TABLE IF NOT EXISTS referral_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invite_code TEXT NOT NULL UNIQUE,
    status referral_status NOT NULL DEFAULT 'pending',
    reward_amount DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    ip_address INET,
    user_agent TEXT,
    country_code TEXT,
    city TEXT,
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT different_users CHECK (inviter_id != invited_user_id),
    CONSTRAINT valid_reward CHECK (reward_amount >= 0)
);

-- Produtos/funcionalidades disponíveis
CREATE TABLE IF NOT EXISTS shhhhcoin_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category TEXT NOT NULL,
    status product_status NOT NULL DEFAULT 'active',
    duration_days INTEGER,
    is_permanent BOOLEAN DEFAULT false,
    max_uses INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT positive_price CHECK (price > 0)
);

-- Compras realizadas
CREATE TABLE IF NOT EXISTS shhhhcoin_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES shhhhcoin_products(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES shhhhcoin_transactions(id) ON DELETE CASCADE,
    amount_paid DECIMAL(10,2) NOT NULL,
    status purchase_status NOT NULL DEFAULT 'completed',
    uses_remaining INTEGER,
    activated_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT positive_amount_paid CHECK (amount_paid > 0)
);

-- Detecção de fraude
CREATE TABLE IF NOT EXISTS fraud_detection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invite_id UUID REFERENCES referral_invites(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    event_type TEXT NOT NULL,
    risk_score INTEGER DEFAULT 0,
    is_blocked BOOLEAN DEFAULT false,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- ÍNDICES PARA PERFORMANCE
-- ================================================

-- Índices para carteiras
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_wallets_user_id ON shhhhcoin_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_wallets_balance ON shhhhcoin_wallets(balance);

-- Índices para transações
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_transactions_user_id ON shhhhcoin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_transactions_wallet_id ON shhhhcoin_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_transactions_type ON shhhhcoin_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_transactions_created_at ON shhhhcoin_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_transactions_reference ON shhhhcoin_transactions(reference_id, reference_type);

-- Índices para convites
CREATE INDEX IF NOT EXISTS idx_referral_invites_inviter_id ON referral_invites(inviter_id);
CREATE INDEX IF NOT EXISTS idx_referral_invites_invited_user_id ON referral_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_invites_status ON referral_invites(status);
CREATE INDEX IF NOT EXISTS idx_referral_invites_expires_at ON referral_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_referral_invites_ip_address ON referral_invites(ip_address);

-- Índices para produtos
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_products_category ON shhhhcoin_products(category);
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_products_status ON shhhhcoin_products(status);
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_products_price ON shhhhcoin_products(price);

-- Índices para compras
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_purchases_user_id ON shhhhcoin_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_purchases_product_id ON shhhhcoin_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_purchases_status ON shhhhcoin_purchases(status);
CREATE INDEX IF NOT EXISTS idx_shhhhcoin_purchases_expires_at ON shhhhcoin_purchases(expires_at);

-- Índices para detecção de fraude
CREATE INDEX IF NOT EXISTS idx_fraud_detection_logs_user_id ON fraud_detection_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_detection_logs_invite_id ON fraud_detection_logs(invite_id);
CREATE INDEX IF NOT EXISTS idx_fraud_detection_logs_ip_address ON fraud_detection_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_fraud_detection_logs_event_type ON fraud_detection_logs(event_type);

-- ================================================
-- FUNÇÕES UTILITÁRIAS
-- ================================================

-- Função para criar carteira automaticamente
CREATE OR REPLACE FUNCTION create_shhhhcoin_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO shhhhcoin_wallets (user_id, balance, total_earned, total_spent, total_purchased)
    VALUES (NEW.id, 0.00, 0.00, 0.00, 0.00);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para detectar fraude por IP
CREATE OR REPLACE FUNCTION detect_ip_fraud(
    p_ip_address INET,
    p_user_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_risk_score INTEGER := 0;
    v_invite_count INTEGER;
    v_recent_count INTEGER;
BEGIN
    -- Verificar quantos convites foram criados do mesmo IP
    SELECT COUNT(*) INTO v_invite_count
    FROM referral_invites
    WHERE ip_address = p_ip_address
    AND created_at > NOW() - INTERVAL '1 day';
    
    -- Verificar convites recentes do mesmo usuário
    IF p_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_recent_count
        FROM referral_invites
        WHERE inviter_id = p_user_id
        AND created_at > NOW() - INTERVAL '1 hour';
        
        IF v_recent_count > 5 THEN
            v_risk_score := v_risk_score + 50;
        END IF;
    END IF;
    
    -- Aumentar score baseado na quantidade de convites do IP
    IF v_invite_count > 10 THEN
        v_risk_score := v_risk_score + 80;
    ELSIF v_invite_count > 5 THEN
        v_risk_score := v_risk_score + 40;
    ELSIF v_invite_count > 2 THEN
        v_risk_score := v_risk_score + 20;
    END IF;
    
    RETURN v_risk_score;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar shhhhcoins com segurança
CREATE OR REPLACE FUNCTION add_shhhhcoins(
    p_user_id UUID,
    p_amount DECIMAL(10,2),
    p_description TEXT,
    p_transaction_type shhhhcoin_transaction_type DEFAULT 'earned',
    p_reference_id UUID DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_wallet_id UUID;
    v_transaction_id UUID;
BEGIN
    -- Validar parâmetros
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;
    
    -- Obter carteira do usuário
    SELECT id INTO v_wallet_id
    FROM shhhhcoin_wallets
    WHERE user_id = p_user_id;
    
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found for user';
    END IF;
    
    -- Atualizar saldo da carteira
    UPDATE shhhhcoin_wallets
    SET 
        balance = balance + p_amount,
        total_earned = total_earned + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- Criar transação
    INSERT INTO shhhhcoin_transactions (
        user_id, wallet_id, transaction_type, amount, description,
        reference_id, reference_type
    ) VALUES (
        p_user_id, v_wallet_id, p_transaction_type, p_amount, p_description,
        p_reference_id, p_reference_type
    ) RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Função para gastar shhhhcoins com segurança
CREATE OR REPLACE FUNCTION spend_shhhhcoins(
    p_user_id UUID,
    p_amount DECIMAL(10,2),
    p_description TEXT,
    p_reference_id UUID DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance DECIMAL(10,2);
    v_transaction_id UUID;
BEGIN
    -- Validar parâmetros
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;
    
    -- Obter carteira e saldo atual
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM shhhhcoin_wallets
    WHERE user_id = p_user_id;
    
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found for user';
    END IF;
    
    -- Verificar se tem saldo suficiente
    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    -- Atualizar saldo da carteira
    UPDATE shhhhcoin_wallets
    SET 
        balance = balance - p_amount,
        total_spent = total_spent + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- Criar transação
    INSERT INTO shhhhcoin_transactions (
        user_id, wallet_id, transaction_type, amount, description,
        reference_id, reference_type
    ) VALUES (
        p_user_id, v_wallet_id, 'spent', p_amount, p_description,
        p_reference_id, p_reference_type
    ) RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Função para processar convite completado
CREATE OR REPLACE FUNCTION process_referral_completion(
    p_invite_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_invite_record referral_invites%ROWTYPE;
    v_transaction_id UUID;
    v_fraud_score INTEGER;
BEGIN
    -- Obter dados do convite
    SELECT * INTO v_invite_record
    FROM referral_invites
    WHERE id = p_invite_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar fraude
    SELECT detect_ip_fraud(v_invite_record.ip_address, v_invite_record.inviter_id) INTO v_fraud_score;
    
    -- Se score de fraude for muito alto, cancelar convite
    IF v_fraud_score > 70 THEN
        UPDATE referral_invites
        SET status = 'cancelled'
        WHERE id = p_invite_id;
        
        INSERT INTO fraud_detection_logs (
            user_id, invite_id, ip_address, event_type, risk_score, is_blocked, reason
        ) VALUES (
            v_invite_record.inviter_id, p_invite_id, v_invite_record.ip_address, 
            'referral_completion', v_fraud_score, true, 'High fraud risk score'
        );
        
        RETURN FALSE;
    END IF;
    
    -- Marcar convite como completado
    UPDATE referral_invites
    SET 
        status = 'completed',
        used_at = NOW()
    WHERE id = p_invite_id;
    
    -- Creditar pontos para o usuário que fez o convite
    SELECT add_shhhhcoins(
        v_invite_record.inviter_id,
        v_invite_record.reward_amount,
        'Bônus por convite de amigo',
        'bonus',
        p_invite_id,
        'referral'
    ) INTO v_transaction_id;
    
    -- Log do evento
    INSERT INTO fraud_detection_logs (
        user_id, invite_id, ip_address, event_type, risk_score, is_blocked
    ) VALUES (
        v_invite_record.inviter_id, p_invite_id, v_invite_record.ip_address, 
        'referral_completion', v_fraud_score, false
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Função para processar primeiro post de áudio
CREATE OR REPLACE FUNCTION process_first_audio_post()
RETURNS TRIGGER AS $$
DECLARE
    v_invite_id UUID;
    v_is_first_post BOOLEAN;
BEGIN
    -- Verificar se é o primeiro post do usuário
    SELECT COUNT(*) = 1 INTO v_is_first_post
    FROM audio_posts
    WHERE user_id = NEW.user_id;
    
    IF v_is_first_post THEN
        -- Procurar convite pendente para este usuário
        SELECT id INTO v_invite_id
        FROM referral_invites
        WHERE invited_user_id = NEW.user_id 
        AND status = 'pending'
        AND expires_at > NOW()
        LIMIT 1;
        
        -- Se encontrou convite, processa
        IF v_invite_id IS NOT NULL THEN
            PERFORM process_referral_completion(v_invite_id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- TRIGGERS
-- ================================================

-- Trigger para criar carteira para novos usuários
DROP TRIGGER IF EXISTS create_wallet_on_user_creation ON auth.users;
CREATE TRIGGER create_wallet_on_user_creation
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_shhhhcoin_wallet();

-- Trigger para processar convite quando usuário posta primeiro áudio
-- Só criar se a tabela audio_posts existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audio_posts') THEN
        DROP TRIGGER IF EXISTS process_referral_on_first_post ON audio_posts;
        CREATE TRIGGER process_referral_on_first_post
            AFTER INSERT ON audio_posts
            FOR EACH ROW
            EXECUTE FUNCTION process_first_audio_post();
    END IF;
END $$;

-- ================================================
-- PRODUTOS INICIAIS
-- ================================================

-- Inserir produtos iniciais
INSERT INTO shhhhcoin_products (name, description, price, category, duration_days, is_permanent, metadata) VALUES
('Filtro de Voz Premium', 'Acesso a filtros de voz exclusivos e efeitos especiais', 50.00, 'filters', 30, false, '{"filters": ["robot", "alien", "echo", "reverb"]}'),
('Tema Escuro Premium', 'Interface escura elegante com cores personalizadas', 25.00, 'themes', null, true, '{"theme": "dark_premium"}'),
('Destaque no Feed', 'Seu áudio aparece em destaque no feed por 24 horas', 15.00, 'promotion', 1, false, '{"highlight_duration": 24}'),
('Áudio Estendido', 'Grave áudios de até 5 minutos (limite normal: 2 minutos)', 40.00, 'features', 7, false, '{"max_duration": 300}'),
('Badge Verificado', 'Badge especial de usuário verificado no seu perfil', 100.00, 'badges', null, true, '{"badge_type": "verified"}'),
('Filtro Robô', 'Efeito de voz robótica premium', 20.00, 'filters', 15, false, '{"filter": "robot"}'),
('Filtro Alienígena', 'Efeito de voz alienígena premium', 20.00, 'filters', 15, false, '{"filter": "alien"}'),
('Tema Neon', 'Interface com cores neon vibrantes', 30.00, 'themes', null, true, '{"theme": "neon"}'),
('Prioridade no Feed', 'Seus áudios aparecem primeiro no feed por 7 dias', 60.00, 'promotion', 7, false, '{"priority_duration": 168}'),
('Reações Premium', 'Acesso a reações especiais e emojis exclusivos', 35.00, 'features', 30, false, '{"reactions": ["fire", "crown", "diamond"]}')
ON CONFLICT (name) DO NOTHING;

-- ================================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- ================================================

-- Ativar RLS
ALTER TABLE shhhhcoin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE shhhhcoin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE shhhhcoin_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shhhhcoin_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_detection_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para carteiras
CREATE POLICY "Users can view their own wallet" ON shhhhcoin_wallets
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Políticas para transações
CREATE POLICY "Users can view their own transactions" ON shhhhcoin_transactions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Políticas para convites
CREATE POLICY "Users can view their own invites" ON referral_invites
    FOR SELECT TO authenticated
    USING (auth.uid() = inviter_id OR auth.uid() = invited_user_id);

CREATE POLICY "Users can create invites" ON referral_invites
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update their own invites" ON referral_invites
    FOR UPDATE TO authenticated
    USING (auth.uid() = inviter_id);

-- Políticas para produtos
CREATE POLICY "Anyone can view active products" ON shhhhcoin_products
    FOR SELECT TO authenticated
    USING (status = 'active');

-- Políticas para compras
CREATE POLICY "Users can view their own purchases" ON shhhhcoin_purchases
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create purchases" ON shhhhcoin_purchases
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Políticas para logs de fraude (apenas admins)
CREATE POLICY "Admins can view fraud logs" ON fraud_detection_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'moderator')
        )
    );

-- ================================================
-- COMENTÁRIOS
-- ================================================

COMMENT ON TABLE shhhhcoin_wallets IS 'Carteiras de shhhhcoin dos usuários';
COMMENT ON TABLE shhhhcoin_transactions IS 'Histórico de todas as transações de shhhhcoin';
COMMENT ON TABLE referral_invites IS 'Sistema de convites por referral com detecção de fraude';
COMMENT ON TABLE shhhhcoin_products IS 'Produtos e funcionalidades disponíveis para compra';
COMMENT ON TABLE shhhhcoin_purchases IS 'Compras realizadas pelos usuários';
COMMENT ON TABLE fraud_detection_logs IS 'Logs de detecção de fraude para auditoria';

-- ================================================
-- FINALIZAÇÃO
-- ================================================

-- Expirar convites antigos
UPDATE referral_invites 
SET status = 'expired' 
WHERE status = 'pending' 
AND expires_at < NOW();

-- Atualizar estatísticas
ANALYZE shhhhcoin_wallets;
ANALYZE shhhhcoin_transactions;
ANALYZE referral_invites;
ANALYZE shhhhcoin_products;
ANALYZE shhhhcoin_purchases;
ANALYZE fraud_detection_logs;

-- Sucesso
SELECT 'Sistema shhhhcoin instalado com sucesso!' as message; 