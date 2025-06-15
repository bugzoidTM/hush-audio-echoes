
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, RotateCcw } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

interface RecordingInterfaceProps {
  isRecording: boolean;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  duration: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onResetRecording: () => void;
}

const RecordingInterface = ({
  isRecording,
  recordedBlob,
  recordedUrl,
  duration,
  onStartRecording,
  onStopRecording,
  onResetRecording
}: RecordingInterfaceProps) => {
  return (
    <div className="text-center space-y-4">
      {!recordedBlob ? (
        <div className="space-y-4">
          <div className="w-24 h-24 mx-auto gradient-bg rounded-full flex items-center justify-center">
            <Mic className="w-12 h-12 text-white" />
          </div>
          
          {!isRecording ? (
            <Button onClick={onStartRecording} className="gradient-bg">
              <Mic className="w-4 h-4 mr-2" />
              Começar Gravação
            </Button>
          ) : (
            <div className="space-y-3">
              <Button onClick={onStopRecording} variant="destructive">
                <Square className="w-4 h-4 mr-2" />
                Parar Gravação
              </Button>
              <p className="text-sm text-muted-foreground animate-pulse">
                Gravando... (máx. 20s)
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <AudioPlayer audioUrl={recordedUrl!} duration={duration} />
          
          <div className="flex justify-center space-x-2">
            <Button variant="outline" onClick={onResetRecording} size="sm">
              <RotateCcw className="w-4 h-4 mr-2" />
              Gravar Novamente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordingInterface;
