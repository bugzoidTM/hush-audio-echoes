
interface ShhhhAudioPostStatsProps {
  likesCount: number;
  repliesCount: number;
}

const ShhhhAudioPostStats = ({ likesCount, repliesCount }: ShhhhAudioPostStatsProps) => {
  const safelikesCount = likesCount || 0;
  const safeRepliesCount = repliesCount || 0;

  return (
    <div className="px-4 pb-4">
      <p className="text-sm font-semibold mb-1">
        {safelikesCount} {safelikesCount === 1 ? 'curtida' : 'curtidas'}
      </p>
      
      {safeRepliesCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Ver todos os {safeRepliesCount} comentários
        </p>
      )}
    </div>
  );
};

export default ShhhhAudioPostStats;
