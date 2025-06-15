
interface ShhhhAudioPostStatsProps {
  likesCount: number;
  repliesCount: number;
}

const ShhhhAudioPostStats = ({ likesCount, repliesCount }: ShhhhAudioPostStatsProps) => {
  return (
    <div className="px-4 pb-4">
      {likesCount > 0 && (
        <p className="text-sm font-semibold mb-1">
          {likesCount} {likesCount === 1 ? 'curtida' : 'curtidas'}
        </p>
      )}
      
      {repliesCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Ver todos os {repliesCount} comentários
        </p>
      )}
    </div>
  );
};

export default ShhhhAudioPostStats;
