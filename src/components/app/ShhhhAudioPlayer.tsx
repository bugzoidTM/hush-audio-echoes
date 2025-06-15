
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Clock } from 'lucide-react';
import AudioCountdownTimer from './AudioCountdownTimer';
import { getFilterDisplayName } from '@/utils/audioUtils';

interface ShhhhAudioPlayerProps {
  post: {
    id: string;
    audio_url: string;
    duration: number;
    expires_at: string;
    voice_filter?: string;
  };
}

const ShhhhAudioPlayer = ({ post }: ShhhhAudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const handlePlay = () => {
    if (!audio) {
      const newAudio = new Audio(post.audio_url);
      newAudio.addEventListener('ended', () => setIsPlaying(false));
      setAudio(newAudio);
      newAudio.play();
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="bg-muted rounded-lg p-3">
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handlePlay}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </Button>
        
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <div className="h-8 flex items-center space-x-1">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1 bg-primary/40 rounded-full ${
                    isPlaying ? 'animate-pulse' : ''
                  }`}
                  style={{
                    height: `${Math.random() * 20 + 8}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-muted-foreground">
              {Math.floor(post.duration / 60)}:{(post.duration % 60).toString().padStart(2, '0')}
            </p>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Filtro: {getFilterDisplayName(post.voice_filter)}</span>
            </div>
          </div>
        </div>
      </div>
      
      <AudioCountdownTimer expiresAt={post.expires_at} />
    </div>
  );
};

export default ShhhhAudioPlayer;
