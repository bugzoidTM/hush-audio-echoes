
import { useState, useEffect } from 'react';

interface AudioCountdownTimerProps {
  expiresAt?: string;
}

const AudioCountdownTimer = ({ expiresAt }: AudioCountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState('');

  // Calculate countdown timer
  const calculateTimeLeft = () => {
    if (!expiresAt) return '';

    const now = new Date().getTime();
    const expiresAtTime = new Date(expiresAt).getTime();
    const difference = expiresAtTime - now;

    if (difference > 0) {
      const hours = Math.floor(difference % (1000 * 60 * 60 * 24) / (1000 * 60 * 60));
      const minutes = Math.floor(difference % (1000 * 60 * 60) / (1000 * 60));
      const seconds = Math.floor(difference % (1000 * 60) / 1000);

      if (hours > 0) {
        return `${hours}h ${minutes}m restantes`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s restantes`;
      } else {
        return `${seconds}s restantes`;
      }
    } else {
      return 'Expirado';
    }
  };

  useEffect(() => {
    if (!expiresAt) return;

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!expiresAt || !timeLeft) return null;

  return (
    <div
      className="flex items-center justify-center text-xs text-muted-foreground mt-1"
      data-testid="countdown-timer"
    >
      <span>{timeLeft}</span>
    </div>
  );
};

export default AudioCountdownTimer;
