
import { useState, useEffect } from 'react';

interface RateLimiterConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

export const useRateLimiter = (key: string, config: RateLimiterConfig) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(config.maxAttempts);

  const getStorageKey = () => `rateLimit_${key}`;
  const getBlockKey = () => `rateLimit_block_${key}`;

  const checkRateLimit = (): boolean => {
    const now = Date.now();
    const storageKey = getStorageKey();
    const blockKey = getBlockKey();

    // Check if currently blocked
    const blockUntil = localStorage.getItem(blockKey);
    if (blockUntil && now < parseInt(blockUntil)) {
      setIsBlocked(true);
      return false;
    } else if (blockUntil) {
      localStorage.removeItem(blockKey);
      setIsBlocked(false);
    }

    // Get current attempts
    const attemptsData = localStorage.getItem(storageKey);
    let attempts: number[] = [];

    if (attemptsData) {
      attempts = JSON.parse(attemptsData);
      // Filter out attempts outside the time window
      attempts = attempts.filter(timestamp => now - timestamp < config.windowMs);
    }

    if (attempts.length >= config.maxAttempts) {
      // Block user
      if (config.blockDurationMs) {
        localStorage.setItem(blockKey, (now + config.blockDurationMs).toString());
      }
      setIsBlocked(true);
      setRemainingAttempts(0);
      return false;
    }

    // Add current attempt
    attempts.push(now);
    localStorage.setItem(storageKey, JSON.stringify(attempts));
    setRemainingAttempts(config.maxAttempts - attempts.length);
    return true;
  };

  const reset = () => {
    localStorage.removeItem(getStorageKey());
    localStorage.removeItem(getBlockKey());
    setIsBlocked(false);
    setRemainingAttempts(config.maxAttempts);
  };

  return {
    checkRateLimit,
    isBlocked,
    remainingAttempts,
    reset,
  };
};
