
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause } from 'lucide-react';

interface RecordingControlsProps {
  isRecording: boolean;
  isPlaying: boolean;
  audioBlob: Blob | null;
  isUploading: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlayAudio: () => void;
}

const RecordingControls = ({
  isRecording,
  isPlaying,
  audioBlob,
  isUploading,
  onStartRecording,
  onStopRecording,
  onPlayAudio
}: RecordingControlsProps) => {
  return (
    <div className="flex space-x-4">
      {!isRecording ? (
        <Button
          onClick={onStartRecording}
          className="rounded-full w-16 h-16 gradient-bg"
          disabled={isUploading}
        >
          <Mic className="w-6 h-6" />
        </Button>
      ) : (
        <Button
          onClick={onStopRecording}
          variant="destructive"
          className="rounded-full w-16 h-16"
        >
          <Square className="w-6 h-6" />
        </Button>
      )}
      
      {audioBlob && (
        <Button
          onClick={onPlayAudio}
          variant="outline"
          className="rounded-full w-16 h-16"
          disabled={isRecording || isUploading}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </Button>
      )}
    </div>
  );
};

export default RecordingControls;
