// frontend/src/pages/AuthCallback.jsx
import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Spin, message } from 'antd';

const AuthCallback = () => {
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Предотвращаем двойной вызов
    if (hasProcessed.current) return;
    
    const params = new URLSearchParams(location.search);
    const employee_id = params.get('employee_id');
    const username = decodeURIComponent(params.get('username') || '');
    const first_name = decodeURIComponent(params.get('first_name') || '');
    const last_name = decodeURIComponent(params.get('last_name') || '');
    const role = params.get('role');
    const avatar_url = decodeURIComponent(params.get('avatar_url') || '');

    console.log('📊 Auth callback:', { employee_id, username, role });

    if (employee_id) {
      hasProcessed.current = true;
      
      const user = {
        employee_id: parseInt(employee_id),
        username,
        first_name,
        last_name,
        role,
        avatar_url: avatar_url || null,
      };
      
      localStorage.setItem('user', JSON.stringify(user));
      message.success('Вход выполнен успешно!');
      
      // Определяем путь для редиректа
      let redirectPath = '/dashboard';
      if (role === 'Клиент') {
        redirectPath = '/client';
      } else if (role === 'Администратор') {
        redirectPath = '/admin';
      } else if (role === 'Руководитель группы' || role === 'Руководитель отдела') {
        redirectPath = '/group-leader';
      }
      
      console.log('📊 Перенаправление на:', redirectPath);
      
      // Используем прямую навигацию через window.location
      window.location.href = redirectPath;
    } else {
      message.error('Ошибка авторизации через Google');
      window.location.href = '/login';
    }
  }, [location]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Spin size="large" tip="Выполняется вход..." />
    </div>
  );
};

export default AuthCallback;