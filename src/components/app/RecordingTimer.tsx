
interface RecordingTimerProps {
  duration: number;
  isRecording: boolean;
}

const RecordingTimer = ({ duration, isRecording }: RecordingTimerProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRemainingTime = () => {
    return Math.max(0, 20 - duration);
  };

  console.log('⏱️ [RecordingTimer] Props recebidas:', { duration, isRecording });

  return (
    <div className="text-center space-y-2">
      <div className="text-3xl font-mono font-bold text-primary">
        {formatTime(duration)}
      </div>
      
      {isRecording && (
        <div className="text-sm text-muted-foreground">
          <div className="animate-pulse text-red-500 flex items-center justify-center gap-1 mb-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            Gravando
          </div>
          <div className="text-orange-600">
            {getRemainingTime()}s restantes (máx. 20s)
          </div>
        </div>
      )}
      
      {!isRecording && duration === 0 && (
        <div className="text-sm text-muted-foreground">
          Pressione o botão para começar a gravar
        </div>
      )}
      
      {!isRecording && duration > 0 && (
        <div className="text-sm text-green-600">
          Gravação finalizada ({duration}s)
        </div>
      )}
    </div>
  );
};

export default RecordingTimer;
