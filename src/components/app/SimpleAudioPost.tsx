
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import SimplePostHeader from './SimplePostHeader';
import SimplePostDescription from './SimplePostDescription';
import SimpleAudioPlayer from './SimpleAudioPlayer';
import SimpleLikeButton from './SimpleLikeButton';

interface AudioPost {
  id: string;
  description: string;
  audio_url: string;
  duration: number;
  created_at: string;
  user_id: string;
  likes_count: number;
  voice_filter?: string;
  profiles?: {
    username?: string;
    avatar_url?: string;
  } | null;
  likes?: Array<{ user_id: string }>;
}

interface SimpleAudioPostProps {
  post: AudioPost;
}

const SimpleAudioPost = ({ post }: SimpleAudioPostProps) => {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <SimplePostHeader 
          username={post.profiles?.username}
          avatarUrl={post.profiles?.avatar_url}
          createdAt={post.created_at}
        />
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Descrição */}
          <SimplePostDescription description={post.description} />

          {/* Player de Áudio */}
          <SimpleAudioPlayer 
            audioUrl={post.audio_url}
            duration={post.duration}
            voiceFilter={post.voice_filter}
          />

          {/* Ações */}
          <div className="flex items-center space-x-4">
            <SimpleLikeButton 
              postId={post.id}
              initialLikesCount={post.likes_count}
              userLikes={post.likes}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleAudioPost;
