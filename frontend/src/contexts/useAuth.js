import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { message } from 'antd';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false); // Для блокировки повторных запросов
  const messageShownRef = useRef(false); // Для предотвращения дублирования сообщений

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    
    const timer = setTimeout(() => {
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (error) {
          console.error("Ошибка парсинга сохраненного пользователя:", error);
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const login = async (username, password) => {
    // Предотвращаем повторные запросы во время выполнения
    if (authLoading) {
      console.log("Запрос уже выполняется");
      return { success: false, error: "Запрос уже выполняется" };
    }

    setAuthLoading(true);
    messageShownRef.current = false;

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      
      if (res.ok) {
        const userData = await res.json();
        console.log("Данные пользователя при логине:", userData);
        
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Показываем только одно сообщение об успехе
        if (!messageShownRef.current) {
          messageShownRef.current = true;
          message.success('Вход выполнен успешно!');
        }
        
        setAuthLoading(false);
        return { success: true, data: userData };
      } else {
        const errorData = await res.json();
        
        // Показываем только одно сообщение об ошибке
        if (!messageShownRef.current) {
          messageShownRef.current = true;
          message.error(errorData.message || 'Неверный логин или пароль');
        }
        
        setAuthLoading(false);
        return { success: false, error: errorData.message };
      }
    } catch (error) {
      console.error("Login error:", error);
      
      // Показываем только одно сообщение об ошибке
      if (!messageShownRef.current) {
        messageShownRef.current = true;
        message.error('Ошибка соединения с сервером');
      }
      
      setAuthLoading(false);
      return { success: false, error: 'Ошибка соединения' };
    }
  };

  const logout = () => {
  // Очищаем состояние пользователя
  setUser(null);
  // Очищаем localStorage
  localStorage.removeItem('user');
  // Принудительно перезагружаем страницу для полного сброса состояния
  window.location.href = '/login';
};

  const register = async (userData) => {
    // Предотвращаем повторные запросы
    if (authLoading) {
      return { success: false, error: "Запрос уже выполняется" };
    }

    setAuthLoading(true);

    try {
      console.log("Отправляем на сервер:", userData);

      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      if (res.ok) {
        const result = await res.json();
        console.log("Регистрация успешна:", result);
        message.success('Регистрация успешна!');
        
        // Автоматически логиним после регистрации
        const loginResult = await login(userData.username, userData.password);
        
        setAuthLoading(false);
        return { success: true, data: result };
      } else {
        const errorData = await res.json();
        console.error("Ошибка регистрации с сервера:", errorData);
        message.error(errorData.message || "Ошибка регистрации");
        setAuthLoading(false);
        return { success: false, error: errorData.message };
      }
    } catch (error) {
      console.error("Ошибка регистрации:", error);
      message.error('Ошибка соединения с сервером');
      setAuthLoading(false);
      return { success: false, error: 'Ошибка соединения' };
    }
  };

  const value = {
    user,
    loading,
    authLoading, // Добавляем состояние загрузки авторизации
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);