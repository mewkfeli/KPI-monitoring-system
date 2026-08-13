// frontend/src/App.jsx
import React, { useEffect } from 'react';  // 👈 ДОБАВЬ ЭТУ СТРОКУ
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/useAuth';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
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
import AdminDashboard from './pages/AdminDashboard';
import TasksPage from './pages/TasksPage';
import ClientDashboard from "./pages/ClientDashboard";
import OperatorTickets from "./pages/OperatorTickets";
import ReportsAnalytics from "./pages/ReportsAnalytics";
import ClientRegister from "./pages/ClientRegister";
import './index.css';
import VerifyEmail from "./pages/VerifyEmail";
import AuthCallback from './pages/AuthCallback';
import CalendarPage from './pages/CalendarPage';
import EmployeeStatsDetails from './pages/EmployeeStatsDetails';

// Компонент-обертка, который объединяет все провайдеры
const AppProviders = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

function App() {
  // Запрос разрешения на уведомления
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <AppProviders>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/client-register" element={<ClientRegister />} />
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
          
          <Route path="/knowledge" element={
            <ProtectedRoute>
              <KnowledgeBase />
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
          
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['Администратор']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/tasks" element={
            <ProtectedRoute>
              <TasksPage />
            </ProtectedRoute>
          } />
          
          <Route path="/client" element={
            <ProtectedRoute allowedRoles={['Клиент']}>
              <ClientDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/tickets/operator" element={
            <ProtectedRoute allowedRoles={['Сотрудник', 'Руководитель группы', 'Руководитель отдела']}>
              <OperatorTickets />
            </ProtectedRoute>
          } />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route path="/reports" element={
            <ProtectedRoute allowedRoles={['Руководитель группы', 'Руководитель отдела', 'Администратор']}>
              <ReportsAnalytics />
            </ProtectedRoute>
          } />
          <Route path="/auth/callback" element={<AuthCallback />} />
<Route path="/employee-stats/:employeeId" element={
  <ProtectedRoute allowedRoles={['Руководитель группы', 'Руководитель отдела', 'Администратор']}>
    <EmployeeStatsDetails />
  </ProtectedRoute>
} />
<Route path="/calendar" element={
  <ProtectedRoute allowedRoles={['Сотрудник', 'Руководитель группы', 'Руководитель отдела', 'Администратор']}>
    <CalendarPage />
  </ProtectedRoute>
} />

        </Routes>
      </Router>
    </AppProviders>
  );
}

export default App;