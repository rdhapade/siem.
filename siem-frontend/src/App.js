import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Welcome from './pages/Welcome';
import Analytics from './pages/Analytics';
import DailyTasks from './pages/DailyTasks';
import io from 'socket.io-client';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [showLogin, setShowLogin] = useState(true);

  useEffect(() => {
    // Check for existing authentication
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
      
      // Initialize socket connection
      const socketConnection = io('http://localhost:5000', {
        auth: { token }
      });
      setSocket(socketConnection);
      
      return () => socketConnection.close();
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
    
    // Initialize socket connection
    const socketConnection = io('http://localhost:5000', {
      auth: { token }
    });
    setSocket(socketConnection);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    if (socket) {
      socket.close();
      setSocket(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full">
          {showLogin ? (
            <Login 
              onLogin={handleLogin} 
              onToggle={() => setShowLogin(false)} 
            />
          ) : (
            <Signup 
              onSignup={handleLogin} 
              onToggle={() => setShowLogin(true)} 
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header user={user} onLogout={handleLogout} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={<Welcome socket={socket} />} />
              <Route path="/analytics" element={<Analytics socket={socket} />} />
              <Route path="/tasks" element={<DailyTasks socket={socket} />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;