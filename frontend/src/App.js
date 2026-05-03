// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/useAuth';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import Profile from './pages/Profile';
import EmployeeProfile from './pages/EmployeeProfile';
import ChatPage from './pages/ChatPage';
import GroupLeaderDashboard from './pages/GroupLeaderDashboard';
import Leaderboard from './pages/Leaderboard';
import KnowledgeBase from './pages/KnowledgeBase';
import JoinInvite from './pages/JoinInvite';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/join/:code" element={<JoinInvite />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['Сотрудник']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/employee-dashboard" element={
              <ProtectedRoute>
                <EmployeeDashboard />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/employee/:employeeId" element={
              <ProtectedRoute>
                <EmployeeProfile />
              </ProtectedRoute>
            } />
            <Route path="/chat" element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            } />
            <Route path="/group-leader" element={
              <ProtectedRoute allowedRoles={['Руководитель группы', 'Руководитель отдела']}>
                <GroupLeaderDashboard />
              </ProtectedRoute>
            } />
            <Route path="/leaderboard" element={
              <ProtectedRoute allowedRoles={['Руководитель группы', 'Руководитель отдела']}>
                <Leaderboard />
              </ProtectedRoute>
            } />
            <Route path="/knowledge" element={
              <ProtectedRoute>
                <KnowledgeBase />
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;