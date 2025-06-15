
-- Create trigger function to update likes_count in audio_posts table
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.audio_posts 
    SET likes_count = likes_count + 1 
    WHERE id = NEW.audio_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.audio_posts 
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.audio_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Create trigger on likes table to automatically update likes_count
DROP TRIGGER IF EXISTS update_likes_count_trigger ON public.likes;
CREATE TRIGGER update_likes_count_trigger
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();
