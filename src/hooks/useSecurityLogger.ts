
import { supabase } from '@/integrations/supabase/client';

interface SecurityEvent {
  event_type: 'login_attempt' | 'login_success' | 'login_failure' | 'suspicious_activity' | 'data_access';
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
}

export const useSecurityLogger = () => {
  const logSecurityEvent = async (event: SecurityEvent) => {
    try {
      // Get current user from Supabase session instead of useAuth to avoid circular dependency
      const { data: { session } } = await supabase.auth.getSession();
      
      // Get client info
      const clientInfo = {
        ip_address: event.ip_address || 'unknown',
        user_agent: event.user_agent || navigator.userAgent,
        timestamp: new Date().toISOString(),
        user_id: event.user_id || session?.user?.id || 'anonymous'
      };

      // Log to console for immediate visibility
      console.log(`🔒 Security Event: ${event.event_type}`, {
        ...event,
        ...clientInfo
      });

      // In a production environment, you would send this to a security monitoring service
      // For now, we'll store critical events in local storage for admin review
      const securityLogs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      securityLogs.push({
        ...event,
        ...clientInfo
      });
      
      // Keep only last 100 events to prevent storage bloat
      if (securityLogs.length > 100) {
        securityLogs.splice(0, securityLogs.length - 100);
      }
      
      localStorage.setItem('security_logs', JSON.stringify(securityLogs));

    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  };

  const logLoginAttempt = (email: string, success: boolean, error?: string) => {
    logSecurityEvent({
      event_type: success ? 'login_success' : 'login_failure',
      details: {
        email: email.toLowerCase(),
        error: error || undefined,
        timestamp: Date.now()
      }
    });
  };

  const logSuspiciousActivity = (activity: string, details?: Record<string, any>) => {
    logSecurityEvent({
      event_type: 'suspicious_activity',
      details: {
        activity,
        ...details,
        timestamp: Date.now()
      }
    });
  };

  const logDataAccess = (resource: string, action: string) => {
    logSecurityEvent({
      event_type: 'data_access',
      details: {
        resource,
        action,
        timestamp: Date.now()
      }
    });
  };

  return {
    logSecurityEvent,
    logLoginAttempt,
    logSuspiciousActivity,
    logDataAccess
  };
};
