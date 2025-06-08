
const AudioWave = () => {
  const bars = Array.from({ length: 20 }, (_, i) => i);

  return (
    <div className="flex items-end space-x-1 h-16">
      {bars.map((bar) => (
        <div
          key={bar}
          className="w-2 bg-gradient-to-t from-primary to-accent rounded-t animate-audio-wave"
          style={{
            height: `${Math.random() * 60 + 20}%`,
            animationDelay: `${bar * 0.1}s`
          }}
        />
      ))}
    </div>
  );
};

export default AudioWave;
