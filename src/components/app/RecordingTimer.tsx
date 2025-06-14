
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
    return Math.max(0, 60 - duration);
  };

  console.log('⏱️ RecordingTimer render:', { duration, isRecording });

  return (
    <div className="text-center space-y-2">
      <div className="text-3xl font-mono font-bold">
        {formatTime(duration)}
      </div>
      {isRecording && (
        <div className="text-sm text-muted-foreground">
          <span className="animate-pulse text-red-500">● Gravando</span>
          <span className="ml-2">
            (máx. {getRemainingTime()}s restantes)
          </span>
        </div>
      )}
      {!isRecording && duration === 0 && (
        <div className="text-sm text-muted-foreground">
          Pressione o botão para começar a gravar
        </div>
      )}
    </div>
  );
};

export default RecordingTimer;
