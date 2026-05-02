import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import EmployeeDashboard from './pages/EmployeeDashboard';
import GroupLeaderDashboard from './pages/GroupLeaderDashboard';
import Leaderboard from "./pages/Leaderboard";
import KnowledgeBase from "./pages/KnowledgeBase";
import ChatPage from "./pages/ChatPage";
import JoinInvite from "./pages/JoinInvite";



function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Для обычных сотрудников */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['Сотрудник']}>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          
          {/* Для всех авторизованных */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/join/:code" element={<JoinInvite />} />

          <Route path="/employee-dashboard" element={
            <ProtectedRoute allowedRoles={['Сотрудник']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          } />

          {/* Для руководителей группы */}
          <Route path="/group-leader" element={
            <ProtectedRoute allowedRoles={['Руководитель группы', 'Руководитель отдела']}>
              <GroupLeaderDashboard />
            </ProtectedRoute>
          } />
          
          {/* Перенаправление в зависимости от роли */}
          <Route path="/" element={
            <ProtectedRoute>
              {(user) => {
                if (user.role === 'Руководитель группы' || user.role === 'Руководитель отдела') {
                  return <Navigate to="/group-leader" replace />;
                } else {
                  return <Navigate to="/dashboard" replace />;
                }
              }}
            </ProtectedRoute>
          } />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />


          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;