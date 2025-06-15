
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, AlertTriangle, Activity, Users } from 'lucide-react';

interface SecurityEvent {
  event_type: string;
  user_id: string;
  timestamp: string;
  details: Record<string, any>;
  ip_address: string;
  user_agent: string;
}

const SecurityMonitorDashboard: React.FC = () => {
  const [securityLogs, setSecurityLogs] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    failedLogins: 0,
    suspiciousActivity: 0,
    activeUsers: 0
  });

  useEffect(() => {
    const loadSecurityLogs = () => {
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      setSecurityLogs(logs);
      
      // Calculate statistics
      const now = Date.now();
      const last24Hours = now - (24 * 60 * 60 * 1000);
      
      const recentLogs = logs.filter((log: SecurityEvent) => 
        new Date(log.timestamp).getTime() > last24Hours
      );
      
      setStats({
        totalEvents: recentLogs.length,
        failedLogins: recentLogs.filter((log: SecurityEvent) => 
          log.event_type === 'login_failure'
        ).length,
        suspiciousActivity: recentLogs.filter((log: SecurityEvent) => 
          log.event_type === 'suspicious_activity'
        ).length,
        activeUsers: new Set(recentLogs.map((log: SecurityEvent) => log.user_id)).size
      });
    };

    loadSecurityLogs();
    // Refresh every 30 seconds
    const interval = setInterval(loadSecurityLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const getEventBadgeVariant = (eventType: string) => {
    switch (eventType) {
      case 'login_failure':
      case 'suspicious_activity':
        return 'destructive';
      case 'login_success':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const clearLogs = () => {
    localStorage.removeItem('security_logs');
    setSecurityLogs([]);
    setStats({
      totalEvents: 0,
      failedLogins: 0,
      suspiciousActivity: 0,
      activeUsers: 0
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Security Monitor
        </h2>
        <button
          onClick={clearLogs}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Clear Logs
        </button>
      </div>

      {/* Security Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failedLogins}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspicious Activity</CardTitle>
            <Shield className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.suspiciousActivity}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Security Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Events</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Events</TabsTrigger>
              <TabsTrigger value="failures">Failed Logins</TabsTrigger>
              <TabsTrigger value="suspicious">Suspicious Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-2 mt-4">
              {securityLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No security events recorded</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {securityLogs.slice(-20).reverse().map((log, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Badge variant={getEventBadgeVariant(log.event_type)}>
                          {log.event_type.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm">User: {log.user_id}</span>
                        <span className="text-xs text-gray-500">{formatTimestamp(log.timestamp)}</span>
                      </div>
                      {log.details && (
                        <span className="text-xs text-gray-600 max-w-xs truncate">
                          {JSON.stringify(log.details)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="failures" className="space-y-2 mt-4">
              {securityLogs.filter(log => log.event_type === 'login_failure').length === 0 ? (
                <p className="text-gray-500 text-center py-4">No failed login attempts</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {securityLogs
                    .filter(log => log.event_type === 'login_failure')
                    .slice(-10).reverse()
                    .map((log, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge variant="destructive">Failed Login</Badge>
                          <span className="text-sm">User: {log.user_id}</span>
                          <span className="text-xs text-gray-500">{formatTimestamp(log.timestamp)}</span>
                        </div>
                        <span className="text-xs text-red-600 max-w-xs truncate">
                          {log.details?.email || 'Unknown email'}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="suspicious" className="space-y-2 mt-4">
              {securityLogs.filter(log => log.event_type === 'suspicious_activity').length === 0 ? (
                <p className="text-gray-500 text-center py-4">No suspicious activity detected</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {securityLogs
                    .filter(log => log.event_type === 'suspicious_activity')
                    .slice(-10).reverse()
                    .map((log, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge variant="destructive">Suspicious</Badge>
                          <span className="text-sm">User: {log.user_id}</span>
                          <span className="text-xs text-gray-500">{formatTimestamp(log.timestamp)}</span>
                        </div>
                        <span className="text-xs text-orange-600 max-w-xs truncate">
                          {log.details?.activity || 'Unknown activity'}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityMonitorDashboard;
