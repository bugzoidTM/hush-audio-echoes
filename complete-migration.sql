-- ================================================================================================
-- MIGRAÇÃO COMPLETA PARA SUPABASE SELF-HOSTED
-- Sistema: Hush Audio Echoes
-- Arquivo consolidado com todas as migrações
-- ================================================================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================================================
-- ENUMS
-- ================================================================================================

-- Enum para status de áudio
DO $$ BEGIN
    CREATE TYPE public.audio_status AS ENUM ('active', 'expired', 'reported', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para status de desafios
DO $$ BEGIN
    CREATE TYPE public.challenge_status AS ENUM ('active', 'ended', 'draft');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para status de relatórios
DO $$ BEGIN
    CREATE TYPE public.report_status AS ENUM ('pending', 'resolved', 'dismissed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para roles de usuário
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ================================================================================================
-- TABELAS PRINCIPAIS
-- ================================================================================================

-- Tabela de profiles (usuários)
CREATE TABLE IF NOT EXISTS public.profiles (
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

-- Tabela de roles de usuário
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- Tabela de desafios diários
CREATE TABLE IF NOT EXISTS public.daily_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    hashtag TEXT NOT NULL,
    status public.challenge_status NOT NULL DEFAULT 'draft',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela principal de áudios
CREATE TABLE IF NOT EXISTS public.audio_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    audio_url TEXT NOT NULL,
    duration INTEGER NOT NULL,
    voice_filter TEXT,
    transcription TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    status public.audio_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    challenge_id UUID REFERENCES public.daily_challenges(id),
    likes_count INTEGER NOT NULL DEFAULT 0,
    replies_count INTEGER NOT NULL DEFAULT 0,
    reposts_count INTEGER NOT NULL DEFAULT 0,
    parent_id UUID REFERENCES public.audio_posts(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de hashtags
CREATE TABLE IF NOT EXISTS public.hashtags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de relacionamento entre áudios e hashtags
CREATE TABLE IF NOT EXISTS public.audio_hashtags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audio_id UUID REFERENCES public.audio_posts(id) ON DELETE CASCADE NOT NULL,
    hashtag_id UUID REFERENCES public.hashtags(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (audio_id, hashtag_id)
);

-- Tabela de curtidas
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    audio_id UUID REFERENCES public.audio_posts(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, audio_id)
);

-- Tabela de seguidores
CREATE TABLE IF NOT EXISTS public.followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Tabela de grupos privados
CREATE TABLE IF NOT EXISTS public.private_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de membros dos grupos
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.private_groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, user_id)
);

-- Tabela de respostas de áudio
CREATE TABLE IF NOT EXISTS public.audio_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_audio_id UUID NOT NULL REFERENCES public.audio_posts(id) ON DELETE CASCADE,
    reply_audio_id UUID NOT NULL REFERENCES public.audio_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(parent_audio_id, reply_audio_id)
);

-- Tabela de reposts
CREATE TABLE IF NOT EXISTS public.audio_reposts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_audio_id UUID NOT NULL REFERENCES public.audio_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, original_audio_id)
);

-- Tabela de denúncias
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    audio_id UUID REFERENCES public.audio_posts(id) ON DELETE CASCADE NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    status public.report_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de estatísticas de usuário
CREATE TABLE IF NOT EXISTS public.user_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    total_posts INTEGER NOT NULL DEFAULT 0,
    total_likes_received INTEGER NOT NULL DEFAULT 0,
    total_likes_given INTEGER NOT NULL DEFAULT 0,
    total_replies INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ================================================================================================
-- FUNÇÕES UTILITÁRIAS
-- ================================================================================================

-- Função para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'display_name'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Função para expirar posts automaticamente
CREATE OR REPLACE FUNCTION public.expire_old_posts()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.audio_posts 
  SET status = 'expired'
  WHERE expires_at < NOW() AND status = 'active';
END;
$$;

-- Função para deletar posts expirados
CREATE OR REPLACE FUNCTION public.delete_expired_posts()
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

-- ================================================================================================
-- TRIGGERS
-- ================================================================================================

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger para atualizar contador de likes
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.audio_posts 
        SET likes_count = likes_count + 1 
        WHERE id = NEW.audio_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.audio_posts 
        SET likes_count = likes_count - 1 
        WHERE id = OLD.audio_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS likes_count_trigger ON public.likes;
CREATE TRIGGER likes_count_trigger
    AFTER INSERT OR DELETE ON public.likes
    FOR EACH ROW
    EXECUTE FUNCTION update_likes_count();

-- Trigger para atualizar contador de seguidores
CREATE OR REPLACE FUNCTION update_followers_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.profiles 
        SET following_count = following_count + 1 
        WHERE id = NEW.follower_id;
        
        UPDATE public.profiles 
        SET followers_count = followers_count + 1 
        WHERE id = NEW.following_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.profiles 
        SET following_count = following_count - 1 
        WHERE id = OLD.follower_id;
        
        UPDATE public.profiles 
        SET followers_count = followers_count - 1 
        WHERE id = OLD.following_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS followers_count_trigger ON public.followers;
CREATE TRIGGER followers_count_trigger
    AFTER INSERT OR DELETE ON public.followers
    FOR EACH ROW
    EXECUTE FUNCTION update_followers_count();

-- ================================================================================================
-- ÍNDICES PARA PERFORMANCE
-- ================================================================================================

-- Índices para audio_posts
CREATE INDEX IF NOT EXISTS idx_audio_posts_user_id ON public.audio_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_posts_created_at ON public.audio_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_posts_status ON public.audio_posts(status);
CREATE INDEX IF NOT EXISTS idx_audio_posts_expires_at ON public.audio_posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_audio_posts_parent_id ON public.audio_posts(parent_id);

-- Índices para likes
CREATE INDEX IF NOT EXISTS idx_likes_audio_id ON public.likes(audio_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);

-- Índices para followers
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON public.followers(following_id);

-- ================================================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- ================================================================================================
-- POLÍTICAS RLS
-- ================================================================================================

-- Políticas para profiles
DROP POLICY IF EXISTS "Profiles são públicos para leitura" ON public.profiles;
CREATE POLICY "Profiles são públicos para leitura" ON public.profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários podem atualizar próprio profile" ON public.profiles;
CREATE POLICY "Usuários podem atualizar próprio profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem inserir próprio profile" ON public.profiles;
CREATE POLICY "Usuários podem inserir próprio profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para audio_posts
DROP POLICY IF EXISTS "Posts ativos são públicos" ON public.audio_posts;
CREATE POLICY "Posts ativos são públicos" ON public.audio_posts
    FOR SELECT USING (status = 'active' AND expires_at > NOW());

DROP POLICY IF EXISTS "Usuários podem criar posts" ON public.audio_posts;
CREATE POLICY "Usuários podem criar posts" ON public.audio_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar próprios posts" ON public.audio_posts;
CREATE POLICY "Usuários podem atualizar próprios posts" ON public.audio_posts
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem deletar próprios posts" ON public.audio_posts;
CREATE POLICY "Usuários podem deletar próprios posts" ON public.audio_posts
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para likes
DROP POLICY IF EXISTS "Likes são públicos para leitura" ON public.likes;
CREATE POLICY "Likes são públicos para leitura" ON public.likes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários podem gerenciar próprios likes" ON public.likes;
CREATE POLICY "Usuários podem gerenciar próprios likes" ON public.likes
    FOR ALL USING (auth.uid() = user_id);

-- Políticas para followers
DROP POLICY IF EXISTS "Follows são públicos para leitura" ON public.followers;
CREATE POLICY "Follows são públicos para leitura" ON public.followers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários podem gerenciar próprios follows" ON public.followers;
CREATE POLICY "Usuários podem gerenciar próprios follows" ON public.followers
    FOR ALL USING (auth.uid() = follower_id);

-- Políticas básicas para demais tabelas
DROP POLICY IF EXISTS "Hashtags são públicas" ON public.hashtags;
CREATE POLICY "Hashtags são públicas" ON public.hashtags
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Audio hashtags são públicas" ON public.audio_hashtags;
CREATE POLICY "Audio hashtags são públicas" ON public.audio_hashtags
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem acessar desafios" ON public.daily_challenges;
CREATE POLICY "Usuários autenticados podem acessar desafios" ON public.daily_challenges
    FOR SELECT USING (auth.role() = 'authenticated');

-- ================================================================================================
-- STORAGE BUCKET E POLÍTICAS
-- ================================================================================================

-- Criar bucket para arquivos de áudio
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
DROP POLICY IF EXISTS "Usuários podem fazer upload de áudios" ON storage.objects;
CREATE POLICY "Usuários podem fazer upload de áudios" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'audio-files' AND 
        auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Áudios são públicos para leitura" ON storage.objects;
CREATE POLICY "Áudios são públicos para leitura" ON storage.objects
    FOR SELECT USING (bucket_id = 'audio-files');

DROP POLICY IF EXISTS "Usuários podem deletar próprios áudios" ON storage.objects;
CREATE POLICY "Usuários podem deletar próprios áudios" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'audio-files' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- ================================================================================================
-- FINALIZAÇÃO
-- ================================================================================================

-- Criar função para estatísticas do sistema
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_users', (SELECT COUNT(*) FROM public.profiles),
        'total_posts', (SELECT COUNT(*) FROM public.audio_posts),
        'active_posts', (SELECT COUNT(*) FROM public.audio_posts WHERE status = 'active'),
        'total_likes', (SELECT COUNT(*) FROM public.likes),
        'total_follows', (SELECT COUNT(*) FROM public.followers),
        'total_hashtags', (SELECT COUNT(*) FROM public.hashtags)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Concluir migração
SELECT 'Migração concluída com sucesso! 🎉' as status; 