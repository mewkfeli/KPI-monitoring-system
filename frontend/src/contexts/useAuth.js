import React, { createContext, useContext, useState, useEffect } from "react";
import { message } from 'antd';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    
    // Используем setTimeout чтобы избежать синхронного setState в эффекте
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
    }, 0); // setTimeout с 0 задержкой

    return () => clearTimeout(timer);
  }, []);

  const login = async (username, password) => {
    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      
      if (res.ok) {
        const userData = await res.json();
        console.log("Данные пользователя при логине:", userData);
        
        // Обновляем состояние асинхронно
        setTimeout(() => {
          setUser(userData);
        }, 0);
        
        localStorage.setItem('user', JSON.stringify(userData));
        message.success('Вход выполнен успешно!');
        return { success: true, data: userData };
      } else {
        const errorData = await res.json();
        message.error(errorData.message || 'Ошибка входа');
        return { success: false, error: errorData.message };
      }
    } catch (error) {
      message.error('Ошибка соединения с сервером');
      return { success: false, error: 'Ошибка соединения' };
    }
  };

  const logout = () => {
    // Используем setTimeout для асинхронного обновления
    setTimeout(() => {
      setUser(null);
    }, 0);
    
    localStorage.removeItem('user');
    message.info('Вы вышли из системы');
  };

  const register = async (userData) => {
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
        return { success: true, data: result };
      } else {
        const errorData = await res.json();
        console.error("Ошибка регистрации с сервера:", errorData);
        message.error(errorData.message || "Ошибка регистрации");
        return { success: false, error: errorData.message };
      }
    } catch (error) {
      console.error("Ошибка регистрации:", error);
      message.error('Ошибка соединения с сервером');
      return { success: false, error: 'Ошибка соединения' };
    }
  };

  const value = {
    user,
    loading,
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