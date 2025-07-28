import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Database, 
  TrendingUp,
  Clock,
  Server,
  Users
} from 'lucide-react';

const Welcome = ({ socket }) => {
  const [systemStats, setSystemStats] = useState({
    totalLogs: 0,
    activeAlerts: 0,
    threatsBlocked: 0,
    systemUptime: '99.9%'
  });
  
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [systemHealth, setSystemHealth] = useState({
    logCollector: 'healthy',
    intrusionDetector: 'healthy',
    correlationEngine: 'healthy',
    database: 'healthy'
  });

  useEffect(() => {
    // Simulate real-time data updates
    const interval = setInterval(() => {
      setSystemStats(prev => ({
        ...prev,
        totalLogs: prev.totalLogs + Math.floor(Math.random() * 10),
        activeAlerts: Math.floor(Math.random() * 5),
        threatsBlocked: prev.threatsBlocked + Math.floor(Math.random() * 2)
      }));
    }, 5000);

    // Mock recent alerts
    setRecentAlerts([
      {
        id: 1,
        type: 'high',
        message: 'Multiple failed login attempts from IP 192.168.1.100',
        timestamp: new Date().toISOString(),
        source: 'Authentication System'
      },
      {
        id: 2,
        type: 'medium',
        message: 'Unusual network traffic pattern detected',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        source: 'Network Monitor'
      },
      {
        id: 3,
        type: 'low',
        message: 'System backup completed successfully',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        source: 'Backup Service'
      }
    ]);

    return () => clearInterval(interval);
  }, []);

  const StatCard = ({ icon: Icon, title, value, change, color = 'blue' }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change > 0 ? '+' : ''}{change}% from last hour
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full bg-${color}-100`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  const getAlertColor = (type) => {
    switch (type) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg">
        <div className="flex items-center">
          <Shield className="w-12 h-12 mr-4" />
          <div>
            <h1 className="text-3xl font-bold">Welcome to SIEM Dashboard</h1>
            <p className="text-blue-100 mt-2">
              Your security operations center is actively monitoring and protecting your infrastructure
            </p>
          </div>
        </div>
      </div>

      {/* System Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Database}
          title="Total Logs Processed"
          value={systemStats.totalLogs.toLocaleString()}
          change={12}
          color="blue"
        />
        <StatCard
          icon={AlertTriangle}
          title="Active Alerts"
          value={systemStats.activeAlerts}
          change={-5}
          color="red"
        />
        <StatCard
          icon={Shield}
          title="Threats Blocked"
          value={systemStats.threatsBlocked}
          change={8}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          title="System Uptime"
          value={systemStats.systemUptime}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Security Alerts */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Security Alerts</h2>
            <AlertTriangle className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${getAlertColor(alert.type)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{alert.message}</p>
                    <div className="flex items-center mt-2 text-sm">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>{new Date(alert.timestamp).toLocaleString()}</span>
                      <span className="mx-2">•</span>
                      <span>{alert.source}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    alert.type === 'high' ? 'bg-red-100 text-red-800' :
                    alert.type === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {alert.type.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Health Status */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">System Health</h2>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {Object.entries(systemHealth).map(([component, status]) => (
              <div key={component} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <Server className="w-5 h-5 text-gray-400 mr-3" />
                  <span className="font-medium text-gray-900 capitalize">
                    {component.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${
                    status === 'healthy' ? 'bg-green-500' :
                    status === 'warning' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}></div>
                  <span className={`font-medium capitalize ${getHealthColor(status)}`}>
                    {status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
            <Database className="w-6 h-6 text-blue-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-gray-900">View All Logs</p>
              <p className="text-sm text-gray-600">Access complete log history</p>
            </div>
          </button>
          <button className="flex items-center p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-gray-900">Manage Alerts</p>
              <p className="text-sm text-gray-600">Configure alert rules</p>
            </div>
          </button>
          <button className="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
            <Users className="w-6 h-6 text-green-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-gray-900">User Management</p>
              <p className="text-sm text-gray-600">Manage system users</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Welcome;