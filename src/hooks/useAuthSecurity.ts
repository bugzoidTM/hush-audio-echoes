
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useSecurityLogger } from './useSecurityLogger';

interface LoginAttempt {
  email: string;
  timestamp: number;
  success: boolean;
}

export const useAuthSecurity = () => {
  const { user } = useAuth();
  const { logLoginAttempt, logSuspiciousActivity } = useSecurityLogger();
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [isAccountLocked, setIsAccountLocked] = useState(false);

  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  const ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    // Load login attempts from localStorage
    const storedAttempts = localStorage.getItem('login_attempts');
    if (storedAttempts) {
      setLoginAttempts(JSON.parse(storedAttempts));
    }
  }, []);

  const cleanOldAttempts = (attempts: LoginAttempt[]) => {
    const now = Date.now();
    return attempts.filter(attempt => now - attempt.timestamp < ATTEMPT_WINDOW);
  };

  const checkAccountLockout = (email: string): boolean => {
    const now = Date.now();
    const recentAttempts = cleanOldAttempts(loginAttempts.filter(attempt => 
      attempt.email === email.toLowerCase() && !attempt.success
    ));

    if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
      const lastAttempt = recentAttempts[recentAttempts.length - 1];
      const lockoutExpires = lastAttempt.timestamp + LOCKOUT_DURATION;
      
      if (now < lockoutExpires) {
        setIsAccountLocked(true);
        logSuspiciousActivity('account_lockout', {
          email: email.toLowerCase(),
          attempts: recentAttempts.length,
          lockout_expires: new Date(lockoutExpires).toISOString()
        });
        return true;
      }
    }

    setIsAccountLocked(false);
    return false;
  };

  const recordLoginAttempt = (email: string, success: boolean, error?: string) => {
    const attempt: LoginAttempt = {
      email: email.toLowerCase(),
      timestamp: Date.now(),
      success
    };

    const updatedAttempts = cleanOldAttempts([...loginAttempts, attempt]);
    setLoginAttempts(updatedAttempts);
    localStorage.setItem('login_attempts', JSON.stringify(updatedAttempts));

    logLoginAttempt(email, success, error);

    if (!success) {
      checkAccountLockout(email);
    }
  };

  const getRemainingLockoutTime = (email: string): number => {
    const now = Date.now();
    const failedAttempts = loginAttempts.filter(attempt => 
      attempt.email === email.toLowerCase() && !attempt.success
    );

    if (failedAttempts.length >= MAX_LOGIN_ATTEMPTS) {
      const lastAttempt = failedAttempts[failedAttempts.length - 1];
      const lockoutExpires = lastAttempt.timestamp + LOCKOUT_DURATION;
      return Math.max(0, lockoutExpires - now);
    }

    return 0;
  };

  const clearLoginAttempts = (email: string) => {
    const filteredAttempts = loginAttempts.filter(attempt => 
      attempt.email !== email.toLowerCase()
    );
    setLoginAttempts(filteredAttempts);
    localStorage.setItem('login_attempts', JSON.stringify(filteredAttempts));
    setIsAccountLocked(false);
  };

  return {
    checkAccountLockout,
    recordLoginAttempt,
    getRemainingLockoutTime,
    clearLoginAttempts,
    isAccountLocked,
    maxAttempts: MAX_LOGIN_ATTEMPTS
  };
};
