import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Shield, 
  BarChart3, 
  CheckSquare, 
  Activity,
  AlertTriangle,
  Database
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();

  const menuItems = [
    {
      path: '/dashboard',
      name: 'Overview',
      icon: Shield,
      description: 'System overview and status'
    },
    {
      path: '/analytics',
      name: 'Analytics',
      icon: BarChart3,
      description: 'Logs, graphs, and alerts'
    },
    {
      path: '/tasks',
      name: 'Daily Tasks',
      icon: CheckSquare,
      description: 'Administrative tasks'
    }
  ];

  return (
    <div className="bg-gray-900 text-white w-64 min-h-screen p-4">
      <div className="flex items-center mb-8">
        <Shield className="w-8 h-8 text-blue-400 mr-3" />
        <h1 className="text-xl font-bold">SIEM Dashboard</h1>
      </div>
      
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center p-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-gray-400">{item.description}</div>
              </div>
            </Link>
          );
        })}
      </nav>
      
      <div className="mt-8 p-4 bg-gray-800 rounded-lg">
        <div className="flex items-center mb-2">
          <Activity className="w-5 h-5 text-green-400 mr-2" />
          <span className="text-sm font-medium">System Status</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span>Log Collector</span>
            <span className="text-green-400">Active</span>
          </div>
          <div className="flex justify-between">
            <span>Intrusion Detection</span>
            <span className="text-green-400">Active</span>
          </div>
          <div className="flex justify-between">
            <span>Correlation Engine</span>
            <span className="text-green-400">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;