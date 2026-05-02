import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { message } from 'antd';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const messageShownRef = useRef(false);

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
        
        if (!messageShownRef.current) {
          messageShownRef.current = true;
          message.success('Вход выполнен успешно!');
        }
        
        setAuthLoading(false);
        return { success: true, data: userData };
      } else {
        const errorData = await res.json();
        
        if (!messageShownRef.current) {
          messageShownRef.current = true;
          message.error(errorData.message || 'Неверный логин или пароль');
        }
        
        setAuthLoading(false);
        return { success: false, error: errorData.message };
      }
    } catch (error) {
      console.error("Login error:", error);
      
      if (!messageShownRef.current) {
        messageShownRef.current = true;
        message.error('Ошибка соединения с сервером');
      }
      
      setAuthLoading(false);
      return { success: false, error: 'Ошибка соединения' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const register = async (userData) => {
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

  // Добавляем функцию обновления пользователя (для аватарки)
  const updateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const value = {
    user,
    loading,
    authLoading,
    login,
    register,
    logout,
    updateUser, // ← добавляем функцию обновления
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);