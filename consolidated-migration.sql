-- ================================================================================================
-- MIGRAÇÃO CONSOLIDADA PARA SUPABASE SELF-HOSTED
-- Sistema: Hush Audio Echoes
-- Data: $(date)
-- ================================================================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================================================
-- ENUMS
-- ================================================================================================

-- Enum para status de áudio
CREATE TYPE audio_status AS ENUM ('active', 'expired', 'reported', 'deleted');

-- Enum para status de desafios
CREATE TYPE challenge_status AS ENUM ('active', 'ended', 'draft');

-- Enum para status de relatórios
CREATE TYPE report_status AS ENUM ('pending', 'resolved', 'dismissed');

-- Enum para roles de usuário
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

-- ================================================================================================
-- TABELAS PRINCIPAIS
-- ================================================================================================

-- Tabela de profiles (usuários)
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

-- Tabela de posts de áudio
CREATE TABLE IF NOT EXISTS audio_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    audio_url TEXT NOT NULL,
    duration INTEGER NOT NULL, -- em segundos
    voice_filter TEXT,
    transcription TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    status audio_status DEFAULT 'active',
    likes_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    reposts_count INTEGER DEFAULT 0,
    parent_id UUID REFERENCES audio_posts(id) ON DELETE CASCADE, -- Para respostas
    challenge_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de likes
CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    audio_id UUID NOT NULL REFERENCES audio_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, audio_id)
);

-- Tabela de seguidores
CREATE TABLE IF NOT EXISTS followers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Tabela de hashtags
CREATE TABLE IF NOT EXISTS hashtags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de relacionamento entre posts e hashtags
CREATE TABLE IF NOT EXISTS audio_hashtags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audio_id UUID NOT NULL REFERENCES audio_posts(id) ON DELETE CASCADE,
    hashtag_id UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(audio_id, hashtag_id)
);

-- Tabela de desafios diários
CREATE TABLE IF NOT EXISTS daily_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    hashtag TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status challenge_status DEFAULT 'draft',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de grupos privados
CREATE TABLE IF NOT EXISTS private_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de membros de grupos
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES private_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_admin BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Tabela de respostas de áudio
CREATE TABLE IF NOT EXISTS audio_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_audio_id UUID NOT NULL REFERENCES audio_posts(id) ON DELETE CASCADE,
    reply_audio_id UUID NOT NULL REFERENCES audio_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(parent_audio_id, reply_audio_id)
);

-- Tabela de reposts
CREATE TABLE IF NOT EXISTS audio_reposts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_audio_id UUID NOT NULL REFERENCES audio_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, original_audio_id)
);

-- Tabela de relatórios
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audio_id UUID NOT NULL REFERENCES audio_posts(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    description TEXT,
    status report_status DEFAULT 'pending',
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de roles de usuário
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Tabela de estatísticas de usuário
CREATE TABLE IF NOT EXISTS user_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    total_posts INTEGER DEFAULT 0,
    total_likes_given INTEGER DEFAULT 0,
    total_likes_received INTEGER DEFAULT 0,
    total_replies INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================================
-- ÍNDICES PARA PERFORMANCE
-- ================================================================================================

-- Índices para audio_posts
CREATE INDEX IF NOT EXISTS idx_audio_posts_user_id ON audio_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_posts_created_at ON audio_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_posts_status ON audio_posts(status);
CREATE INDEX IF NOT EXISTS idx_audio_posts_expires_at ON audio_posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_audio_posts_parent_id ON audio_posts(parent_id);

-- Índices para likes
CREATE INDEX IF NOT EXISTS idx_likes_audio_id ON likes(audio_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

-- Índices para followers
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON followers(following_id);

-- Índices para hashtags
CREATE INDEX IF NOT EXISTS idx_hashtags_name ON hashtags(name);
CREATE INDEX IF NOT EXISTS idx_hashtags_usage_count ON hashtags(usage_count DESC);

-- ================================================================================================
-- FUNÇÕES UTILITÁRIAS
-- ================================================================================================

-- Função para limpar posts expirados
CREATE OR REPLACE FUNCTION delete_expired_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE audio_posts 
    SET status = 'expired' 
    WHERE expires_at < NOW() 
    AND status = 'active';
END;
$$;

-- Função para expirar posts antigos (alternativa)
CREATE OR REPLACE FUNCTION expire_old_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE audio_posts 
    SET status = 'expired' 
    WHERE expires_at < NOW() 
    AND status = 'active';
END;
$$;

-- Função para verificar se usuário tem determinado role
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = _user_id AND role = _role
    );
END;
$$;

-- ================================================================================================
-- TRIGGERS PARA MANTER CONTADORES
-- ================================================================================================

-- Trigger para atualizar contador de likes
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE audio_posts 
        SET likes_count = likes_count + 1 
        WHERE id = NEW.audio_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE audio_posts 
        SET likes_count = likes_count - 1 
        WHERE id = OLD.audio_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS likes_count_trigger ON likes;
CREATE TRIGGER likes_count_trigger
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW
    EXECUTE FUNCTION update_likes_count();

-- Trigger para atualizar contador de seguidores
CREATE OR REPLACE FUNCTION update_followers_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Incrementar following_count do seguidor
        UPDATE profiles 
        SET following_count = following_count + 1 
        WHERE id = NEW.follower_id;
        
        -- Incrementar followers_count do seguido
        UPDATE profiles 
        SET followers_count = followers_count + 1 
        WHERE id = NEW.following_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrementar following_count do seguidor
        UPDATE profiles 
        SET following_count = following_count - 1 
        WHERE id = OLD.follower_id;
        
        -- Decrementar followers_count do seguido
        UPDATE profiles 
        SET followers_count = followers_count - 1 
        WHERE id = OLD.following_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS followers_count_trigger ON followers;
CREATE TRIGGER followers_count_trigger
    AFTER INSERT OR DELETE ON followers
    FOR EACH ROW
    EXECUTE FUNCTION update_followers_count();

-- ================================================================================================
-- STORAGE BUCKET PARA ÁUDIOS
-- ================================================================================================

-- Criar bucket para arquivos de áudio (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', true)
ON CONFLICT (id) DO NOTHING;

-- ================================================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================================================

-- Habilitar RLS para todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- ================================================================================================
-- POLÍTICAS RLS BÁSICAS
-- ================================================================================================

-- Políticas para profiles
DROP POLICY IF EXISTS "Profiles são públicos para leitura" ON profiles;
CREATE POLICY "Profiles são públicos para leitura" ON profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários podem atualizar próprio profile" ON profiles;
CREATE POLICY "Usuários podem atualizar próprio profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem inserir próprio profile" ON profiles;
CREATE POLICY "Usuários podem inserir próprio profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para audio_posts
DROP POLICY IF EXISTS "Posts ativos são públicos" ON audio_posts;
CREATE POLICY "Posts ativos são públicos" ON audio_posts
    FOR SELECT USING (status = 'active' AND expires_at > NOW());

DROP POLICY IF EXISTS "Usuários podem criar posts" ON audio_posts;
CREATE POLICY "Usuários podem criar posts" ON audio_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar próprios posts" ON audio_posts;
CREATE POLICY "Usuários podem atualizar próprios posts" ON audio_posts
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem deletar próprios posts" ON audio_posts;
CREATE POLICY "Usuários podem deletar próprios posts" ON audio_posts
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para likes
DROP POLICY IF EXISTS "Likes são públicos para leitura" ON likes;
CREATE POLICY "Likes são públicos para leitura" ON likes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários podem gerenciar próprios likes" ON likes;
CREATE POLICY "Usuários podem gerenciar próprios likes" ON likes
    FOR ALL USING (auth.uid() = user_id);

-- Políticas para followers
DROP POLICY IF EXISTS "Follows são públicos para leitura" ON followers;
CREATE POLICY "Follows são públicos para leitura" ON followers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários podem gerenciar próprios follows" ON followers;
CREATE POLICY "Usuários podem gerenciar próprios follows" ON followers
    FOR ALL USING (auth.uid() = follower_id);

-- Políticas básicas para demais tabelas (permitir acesso autenticado)
DROP POLICY IF EXISTS "Hashtags são públicas" ON hashtags;
CREATE POLICY "Hashtags são públicas" ON hashtags
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Audio hashtags são públicas" ON audio_hashtags;
CREATE POLICY "Audio hashtags são públicas" ON audio_hashtags
    FOR SELECT USING (true);

-- ================================================================================================
-- DADOS INICIAIS DE TESTE
-- ================================================================================================

-- Inserir role de admin para primeiro usuário (será criado manualmente depois)
-- Este comando será executado após criar o primeiro usuário

-- ================================================================================================
-- STORAGE POLICIES
-- ================================================================================================

-- Política para permitir upload de áudios autenticados
DROP POLICY IF EXISTS "Usuários podem fazer upload de áudios" ON storage.objects;
CREATE POLICY "Usuários podem fazer upload de áudios" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'audio-files' AND 
        auth.role() = 'authenticated'
    );

-- Política para permitir acesso público aos áudios
DROP POLICY IF EXISTS "Áudios são públicos para leitura" ON storage.objects;
CREATE POLICY "Áudios são públicos para leitura" ON storage.objects
    FOR SELECT USING (bucket_id = 'audio-files');

-- Política para permitir deleção de próprios áudios
DROP POLICY IF EXISTS "Usuários podem deletar próprios áudios" ON storage.objects;
CREATE POLICY "Usuários podem deletar próprios áudios" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'audio-files' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- ================================================================================================
-- FINALIZAÇÃO
-- ================================================================================================

COMMENT ON DATABASE postgres IS 'Banco de dados do sistema Hush Audio Echoes - Migrado para Supabase Self-hosted';

-- Criar função para gerar estatísticas do sistema
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_users', (SELECT COUNT(*) FROM profiles),
        'total_posts', (SELECT COUNT(*) FROM audio_posts),
        'active_posts', (SELECT COUNT(*) FROM audio_posts WHERE status = 'active'),
        'total_likes', (SELECT COUNT(*) FROM likes),
        'total_follows', (SELECT COUNT(*) FROM followers),
        'total_hashtags', (SELECT COUNT(*) FROM hashtags)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Finalizar
SELECT 'Migração concluída com sucesso! 🎉' as status; 