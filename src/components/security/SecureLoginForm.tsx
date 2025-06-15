
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { validateEmail, validatePassword } from '@/utils/inputSanitization';
import { useAuthSecurity } from '@/hooks/useAuthSecurity';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle } from 'lucide-react';

const SecureLoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const { 
    checkAccountLockout, 
    recordLoginAttempt, 
    getRemainingLockoutTime,
    clearLoginAttempts,
    isAccountLocked 
  } = useAuthSecurity();

  const formatLockoutTime = (ms: number): string => {
    const minutes = Math.ceil(ms / (60 * 1000));
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please enter both email and password",
        variant: "destructive"
      });
      return;
    }

    // Validate email format
    if (!validateEmail(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    // Check account lockout
    if (checkAccountLockout(email)) {
      const remainingTime = getRemainingLockoutTime(email);
      toast({
        title: "Account temporarily locked",
        description: `Too many failed attempts. Try again in ${formatLockoutTime(remainingTime)}`,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        recordLoginAttempt(email, false, error.message);
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        recordLoginAttempt(email, true);
        clearLoginAttempts(email);
        toast({
          title: "Login successful",
          description: "Welcome back!"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      recordLoginAttempt(email, false, errorMessage);
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const lockoutTime = email ? getRemainingLockoutTime(email) : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isAccountLocked && lockoutTime > 0 && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="text-sm text-red-800">
            Account locked. Try again in {formatLockoutTime(lockoutTime)}
          </span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          disabled={isLoading || (isAccountLocked && lockoutTime > 0)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          disabled={isLoading || (isAccountLocked && lockoutTime > 0)}
          required
        />
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isLoading || (isAccountLocked && lockoutTime > 0)}
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>

      <div className="text-xs text-gray-500 space-y-1">
        <p>• Maximum 5 login attempts per 5-minute window</p>
        <p>• Account locked for 15 minutes after 5 failed attempts</p>
        <p>• Use strong passwords with mixed case, numbers, and symbols</p>
      </div>
    </form>
  );
};

export default SecureLoginForm;
