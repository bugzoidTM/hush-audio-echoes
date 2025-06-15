
import { Button } from '@/components/ui/button';
import { Play, Pause, Clock } from 'lucide-react';
import { formatTime, getFilterDisplayName } from '@/utils/audioUtils';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import AudioCountdownTimer from './AudioCountdownTimer';

interface SimpleAudioPlayerProps {
  audioUrl: string;
  duration: number;
  voiceFilter?: string;
  expiresAt?: string;
}

const SimpleAudioPlayer = ({ audioUrl, duration, voiceFilter, expiresAt }: SimpleAudioPlayerProps) => {
  const { isPlaying, isLoading, togglePlayback } = useAudioPlayback({
    audioUrl,
    voiceFilter
  });

  return (
    <div className="bg-muted rounded-lg p-4">
      <div className="flex items-center space-x-3">
        <Button
          onClick={togglePlayback}
          size="sm"
          variant="outline"
          className="rounded-full w-10 h-10 p-0"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </Button>

        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{isLoading ? 'Carregando...' : 'Áudio'}</span>
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <div className="mt-1 w-full bg-background rounded-full h-2">
            <div className="bg-primary h-2 rounded-full w-0"></div>
          </div>
        </div>
      </div>

      {/* Filtro aplicado e contador logo abaixo */}
      <div className="mt-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Filtro aplicado:</span>
          <span className="font-medium">{getFilterDisplayName(voiceFilter)}</span>
        </div>
        <AudioCountdownTimer expiresAt={expiresAt} />
      </div>
    </div>
  );
};

export default SimpleAudioPlayer;
