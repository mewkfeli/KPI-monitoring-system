import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = async (username, password) => {
    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        return { success: false, error: err.message };
      }

      const data = await res.json();
      setUser(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => setUser(null);

  const register = async (userData) => {
  try {
    console.log("Отправляем на сервер:", userData);

    const res = await fetch("http://localhost:5000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Ошибка регистрации с сервера:", errorData);
      return { success: false, message: errorData.message || "Ошибка регистрации" };
    }

    return { success: true };
  } catch (error) {
    console.error("Ошибка регистрации:", error);
    return { success: false, message: error.message || "Ошибка регистрации" };
  }
};

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
