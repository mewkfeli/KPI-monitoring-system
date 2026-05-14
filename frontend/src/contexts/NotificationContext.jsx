// frontend/src/contexts/NotificationContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { io } from 'socket.io-client';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [hasNewChatMessages, setHasNewChatMessages] = useState(false);
  const socketRef = useRef(null);

  // Подключение к Socket.IO
  useEffect(() => {
    if (!user?.employee_id) {
      console.log('❌ Нет user_id');
      return;
    }

    console.log('🔌 Подключаем сокет для user:', user.employee_id);

    const socket = io('http://localhost:5000', {
      auth: { employeeId: user.employee_id },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Сокет подключен');
    });

    // Слушаем новые сообщения
    socket.on('new_message', (message) => {
      console.log('📨 Получено новое сообщение:', message);
      
      // Если сообщение не от текущего пользователя
      if (message.sender_id !== user?.employee_id) {
        console.log('🔴 Включаем индикатор чата');
        setHasNewChatMessages(true);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Ошибка сокета:', err);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user?.employee_id]);

  // Сброс индикатора чата
  const resetChatIndicator = useCallback(() => {
    console.log('🔴 Сбрасываем индикатор чата');
    setHasNewChatMessages(false);
  }, []);

  return (
    <NotificationContext.Provider value={{
      hasNewChatMessages,
      resetChatIndicator,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};