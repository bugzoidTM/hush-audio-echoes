
-- Phase 1: Critical RLS Policy Implementation (Fixed version)
-- Drop existing policies that might exist
DROP POLICY IF EXISTS "Users can view active audio posts" ON audio_posts;
DROP POLICY IF EXISTS "Users can create their own audio posts" ON audio_posts;
DROP POLICY IF EXISTS "Users can update their own audio posts" ON audio_posts;
DROP POLICY IF EXISTS "Users can delete their own audio posts" ON audio_posts;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all likes" ON likes;
DROP POLICY IF EXISTS "Users can create likes" ON likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON likes;
DROP POLICY IF EXISTS "Users can view all follows" ON followers;
DROP POLICY IF EXISTS "Users can create follow relationships" ON followers;
DROP POLICY IF EXISTS "Users can delete their own follow relationships" ON followers;
DROP POLICY IF EXISTS "Users can view replies" ON audio_replies;
DROP POLICY IF EXISTS "Users can create replies" ON audio_replies;
DROP POLICY IF EXISTS "Users can delete their own replies" ON audio_replies;
DROP POLICY IF EXISTS "Users can view reposts" ON audio_reposts;
DROP POLICY IF EXISTS "Users can create reposts" ON audio_reposts;
DROP POLICY IF EXISTS "Users can delete their own reposts" ON audio_reposts;
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Moderators can view all reports" ON reports;
DROP POLICY IF EXISTS "Moderators can update reports" ON reports;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view hashtags" ON audio_hashtags;
DROP POLICY IF EXISTS "Users can create hashtags for their posts" ON audio_hashtags;
DROP POLICY IF EXISTS "Users can view active challenges" ON daily_challenges;
DROP POLICY IF EXISTS "Admins can manage challenges" ON daily_challenges;
DROP POLICY IF EXISTS "Users can view hashtags" ON hashtags;
DROP POLICY IF EXISTS "Users can create hashtags" ON hashtags;
DROP POLICY IF EXISTS "Members can view their groups" ON private_groups;
DROP POLICY IF EXISTS "Users can create groups" ON private_groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON private_groups;
DROP POLICY IF EXISTS "Members can view group membership" ON group_members;
DROP POLICY IF EXISTS "Group admins can manage members" ON group_members;
DROP POLICY IF EXISTS "Users can view all stats" ON user_stats;
DROP POLICY IF EXISTS "Users can update their own stats" ON user_stats;

-- Ensure RLS is enabled on all tables
ALTER TABLE audio_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Create secure RLS policies for audio_posts
CREATE POLICY "Users can view active audio posts" ON audio_posts
  FOR SELECT TO authenticated
  USING (status = 'active');

CREATE POLICY "Users can create their own audio posts" ON audio_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'active');

CREATE POLICY "Users can update their own audio posts" ON audio_posts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audio posts" ON audio_posts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create secure RLS policies for profiles
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create secure RLS policies for likes
CREATE POLICY "Users can view all likes" ON likes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create likes" ON likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create secure RLS policies for followers
CREATE POLICY "Users can view all follows" ON followers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create follow relationships" ON followers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id AND follower_id != following_id);

CREATE POLICY "Users can delete their own follow relationships" ON followers
  FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- Create secure RLS policies for audio_replies
CREATE POLICY "Users can view replies" ON audio_replies
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create replies" ON audio_replies
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replies" ON audio_replies
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create secure RLS policies for audio_reposts
CREATE POLICY "Users can view reposts" ON audio_reposts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create reposts" ON audio_reposts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reposts" ON audio_reposts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create secure RLS policies for reports
CREATE POLICY "Users can view their own reports" ON reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create reports" ON reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Moderators can view all reports" ON reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can update reports" ON reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

-- Create admin-only policies for user_roles
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage user roles" ON user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create secure RLS policies for audio_hashtags
CREATE POLICY "Users can view hashtags" ON audio_hashtags
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create hashtags for their posts" ON audio_hashtags
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM audio_posts 
      WHERE id = audio_id AND user_id = auth.uid()
    )
  );

-- Create policies for daily_challenges
CREATE POLICY "Users can view active challenges" ON daily_challenges
  FOR SELECT TO authenticated
  USING (status = 'active');

CREATE POLICY "Admins can manage challenges" ON daily_challenges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create policies for hashtags
CREATE POLICY "Users can view hashtags" ON hashtags
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create hashtags" ON hashtags
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Create policies for private_groups
CREATE POLICY "Members can view their groups" ON private_groups
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create groups" ON private_groups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update groups" ON private_groups
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = id AND user_id = auth.uid() AND is_admin = true)
  );

-- Create policies for group_members
CREATE POLICY "Members can view group membership" ON group_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
  );

CREATE POLICY "Group admins can manage members" ON group_members
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND is_admin = true)
  );

-- Create policies for user_stats
CREATE POLICY "Users can view all stats" ON user_stats
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update their own stats" ON user_stats
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Phase 2: Storage Security Setup (only if not exists)
DO $$
BEGIN
  -- Create the audio-files bucket if it doesn't exist
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'audio-files', 
    'audio-files', 
    false, 
    52428800, -- 50MB
    ARRAY['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Storage bucket already exists or could not be created';
END $$;

-- Drop existing storage policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;

-- Create secure storage policies
CREATE POLICY "Authenticated users can upload audio files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'audio-files' 
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can view audio files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audio-files');

CREATE POLICY "Users can update their own audio files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'audio-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own audio files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'audio-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Add database constraints for data integrity (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audio_posts_duration_check') THEN
    ALTER TABLE audio_posts ADD CONSTRAINT audio_posts_duration_check CHECK (duration > 0 AND duration <= 600);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audio_posts_title_length') THEN
    ALTER TABLE audio_posts ADD CONSTRAINT audio_posts_title_length CHECK (char_length(title) <= 200);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audio_posts_description_length') THEN
    ALTER TABLE audio_posts ADD CONSTRAINT audio_posts_description_length CHECK (char_length(description) <= 1000);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_length') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_length CHECK (char_length(username) BETWEEN 3 AND 30);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-zA-Z0-9_]+$');
  END IF;
END $$;

-- Ensure user_id columns are not nullable where they should be required
ALTER TABLE audio_posts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE likes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE followers ALTER COLUMN follower_id SET NOT NULL;
ALTER TABLE followers ALTER COLUMN following_id SET NOT NULL;
ALTER TABLE audio_replies ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE audio_reposts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_roles ALTER COLUMN user_id SET NOT NULL;

-- Add unique constraints to prevent duplicate relationships (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'followers_unique_relationship') THEN
    ALTER TABLE followers ADD CONSTRAINT followers_unique_relationship UNIQUE (follower_id, following_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'likes_unique_user_audio') THEN
    ALTER TABLE likes ADD CONSTRAINT likes_unique_user_audio UNIQUE (user_id, audio_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reposts_unique_user_audio') THEN
    ALTER TABLE audio_reposts ADD CONSTRAINT reposts_unique_user_audio UNIQUE (user_id, original_audio_id);
  END IF;
END $$;

-- Create indexes for better performance and security
CREATE INDEX IF NOT EXISTS idx_audio_posts_user_status ON audio_posts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_audio_posts_status_created ON audio_posts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_likes_user_audio ON likes(user_id, audio_id);
CREATE INDEX IF NOT EXISTS idx_followers_relationships ON followers(follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
