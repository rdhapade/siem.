import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Filter,
  Download,
  RefreshCw,
  Search
} from 'lucide-react';

const Analytics = ({ socket }) => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Mock log data
    const mockLogs = [
      {
        id: 1,
        timestamp: new Date().toISOString(),
        level: 'error',
        source: 'Web Server',
        message: 'Failed login attempt from 192.168.1.100',
        details: 'User: admin, Attempts: 5'
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 300000).toISOString(),
        level: 'warning',
        source: 'Database',
        message: 'Slow query detected',
        details: 'Query execution time: 5.2s'
      },
      {
        id: 3,
        timestamp: new Date(Date.now() - 600000).toISOString(),
        level: 'info',
        source: 'System',
        message: 'Backup completed successfully',
        details: 'Size: 2.3GB, Duration: 45min'
      },
      {
        id: 4,
        timestamp: new Date(Date.now() - 900000).toISOString(),
        level: 'error',
        source: 'Firewall',
        message: 'Blocked suspicious traffic',
        details: 'Source: 10.0.0.50, Port: 22'
      },
      {
        id: 5,
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        level: 'warning',
        source: 'Application',
        message: 'High memory usage detected',
        details: 'Usage: 85%, Threshold: 80%'
      }
    ];

    const mockAlerts = [
      {
        id: 1,
        type: 'intrusion',
        severity: 'high',
        title: 'Brute Force Attack Detected',
        description: 'Multiple failed login attempts from single IP',
        timestamp: new Date().toISOString(),
        status: 'active'
      },
      {
        id: 2,
        type: 'anomaly',
        severity: 'medium',
        title: 'Unusual Network Traffic',
        description: 'Traffic volume 300% above normal baseline',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        status: 'investigating'
      },
      {
        id: 3,
        type: 'policy',
        severity: 'low',
        title: 'Policy Violation',
        description: 'User accessed restricted resource',
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        status: 'resolved'
      }
    ];

    setLogs(mockLogs);
    setFilteredLogs(mockLogs);
    setAlerts(mockAlerts);
  }, []);

  useEffect(() => {
    let filtered = logs;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.source.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply level filter
    if (filterLevel !== 'all') {
      filtered = filtered.filter(log => log.level === filterLevel);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, filterLevel]);

  const refreshData = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-red-600 bg-red-100';
      case 'investigating': return 'text-yellow-600 bg-yellow-100';
      case 'resolved': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Security Analytics</h1>
          <p className="text-gray-600 mt-1">Monitor logs, analyze patterns, and manage security alerts</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={refreshData}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Logs Today</p>
              <p className="text-3xl font-bold text-gray-900">1,247</p>
              <p className="text-sm text-green-600">+12% from yesterday</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Threats</p>
              <p className="text-3xl font-bold text-gray-900">3</p>
              <p className="text-sm text-red-600">Requires attention</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Detection Rate</p>
              <p className="text-3xl font-bold text-gray-900">98.7%</p>
              <p className="text-sm text-green-600">Above target</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Logs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Security Logs</h2>
              <Filter className="w-5 h-5 text-gray-400" />
            </div>
            
            {/* Search and Filter Controls */}
            <div className="flex space-x-4 mb-4">
              <div className="flex-1 relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Levels</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLevelColor(log.level)}`}>
                        {log.level.toUpperCase()}
                      </span>
                      <span className="ml-2 text-sm text-gray-600">{log.source}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">{log.message}</p>
                    <p className="text-xs text-gray-500">{log.details}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Alerts */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Security Alerts</h2>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-4 border-b border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{alert.title}</h3>
                  <div className="flex space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(alert.status)}`}>
                      {alert.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Type: {alert.type}</span>
                  <span>{new Date(alert.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Threat Intelligence Graph Placeholder */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Threat Intelligence Timeline</h2>
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Interactive threat timeline chart would be displayed here</p>
            <p className="text-sm text-gray-400">Integration with Chart.js for real-time visualization</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;